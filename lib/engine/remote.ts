/**
 * The remote decision engine.
 *
 * Jev and OpenJev speak the same wire API, so one adapter covers both and the choice
 * is configuration rather than code. The shape below is checked against TypeSafe's API
 * reference (docs.typesafe.ai/api, read 2026-09-21, cached in sources/raw/typesafe):
 *
 *   POST /v1/systemone  { model, state, questions: { id: { type, instructions, criteria } } }
 *   -> { model, answers: { id: answer }, usage: { input_tokens, output_tokens } }
 *
 * A noul answer is `{ type: 'noul', noul: P(yes) }` with no confidence. Choice and score
 * answers carry `probabilities` and a `confidence`, but TypeSafe's confidence is
 * (K * max p - 1) / (K - 1), not normalised entropy. The docs say to use your own
 * measure where it fits better, so confidence is recomputed here from the
 * probabilities, which puts every answer, noul included, on one definition.
 *
 * `WIRE_FORMAT_UNCONFIRMED` lists what the docs do not settle and a first live call
 * has to.
 *
 * The API key is read from the environment on the server and never reaches the
 * browser. Nothing in this file is imported by a client component.
 */

import {
  EngineAnswer,
  EngineClient,
  EngineRequest,
  EngineResponse,
  EngineUnavailable,
  argmax,
  confidenceOf,
} from './types';

export const WIRE_FORMAT_UNCONFIRMED = [
  'Whether OpenJev on Codiv serves the same /v1/systemone shape as Jev',
  'How the 422 body names an offending question, for error messages',
];

export interface RemoteEngineConfig {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  /** Requests above this many criteria are split. */
  maxQuestionsPerRequest?: number;
  timeoutMs?: number;
}

interface RawAnswer {
  noul?: number;
  choice?: string;
  score?: number;
  probabilities?: Record<string, number>;
  confidence?: number;
}

/**
 * Turn whatever the engine returned into a distribution over the options we asked
 * about. A noul answer may come back as a single probability of yes; a choice answer
 * as a distribution. Confidence is recomputed locally from the distribution rather
 * than trusted, so that every answer in the system is on one definition.
 */
export function normaliseAnswer(raw: RawAnswer, options: string[]): EngineAnswer {
  let probabilities: Record<string, number>;

  if (raw.probabilities && Object.keys(raw.probabilities).length > 0) {
    probabilities = { ...raw.probabilities };
    for (const option of options) {
      if (!(option in probabilities)) probabilities[option] = 0;
    }
  } else if (typeof raw.noul === 'number' && options.includes('true') && options.includes('false')) {
    probabilities = { true: raw.noul, false: 1 - raw.noul };
  } else if (raw.choice && options.includes(raw.choice)) {
    // A bare choice with no distribution carries no uncertainty information. Treat it
    // as a point mass and let the loop see it as fully confident, which is what it is.
    probabilities = Object.fromEntries(options.map((o) => [o, o === raw.choice ? 1 : 0]));
  } else {
    throw new Error(`Engine answer could not be read: ${JSON.stringify(raw)}`);
  }

  const total = Object.values(probabilities).reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error('Engine returned a zero-mass distribution');
  for (const key of Object.keys(probabilities)) probabilities[key] /= total;

  return {
    choice: argmax(probabilities),
    probabilities,
    confidence: confidenceOf(probabilities),
  };
}

const RETRY_STATUSES = new Set([429, 502, 503, 504, 529]);

export class RemoteEngine implements EngineClient {
  readonly isFixture = false;
  /** Returns distributions over the options asked, so it can read a paragraph too. */
  readonly typedReadout = true;

  constructor(private readonly config: RemoteEngineConfig) {}

  get name(): string {
    return this.config.name;
  }

  async ask(request: EngineRequest): Promise<EngineResponse> {
    if (!this.config.apiKey) {
      throw new EngineUnavailable(
        `${this.config.name} has no API key configured. Set it in the environment, or run against the local fixture.`
      );
    }

    const started = performance.now();
    const batches = this.batch(request);
    const answers: Record<string, EngineAnswer> = {};
    let inputTokens = 0;
    let outputTokens = 0;
    let passes = 0;
    // The versioned id that answered, e.g. jev-1.13.0, as the response reports it.
    let servedBy = this.config.model;

    for (const batch of batches) {
      const response = await this.post(batch);
      for (const [id, raw] of Object.entries(response.answers ?? {})) {
        const question = batch.questions[id];
        if (!question) continue;
        const options = Array.isArray(question.criteria)
          ? question.criteria
          : Object.keys(question.criteria);
        answers[id] = normaliseAnswer(raw as RawAnswer, options);
      }
      inputTokens += response.usage?.input_tokens ?? 0;
      outputTokens += response.usage?.output_tokens ?? 0;
      // Jev does not report forward passes; one request is counted as one.
      passes += 1;
      if (response.model) servedBy = response.model;
    }

    const missing = Object.keys(request.questions).filter((id) => !(id in answers));
    if (missing.length > 0) {
      // A partial verdict is worse than no verdict: it looks complete and is not.
      throw new EngineUnavailable(
        `${this.config.name} did not answer ${missing.length} of ${
          Object.keys(request.questions).length
        } criteria, so no verdict was produced.`
      );
    }

    return {
      model: servedBy,
      answers,
      usage: { inputTokens, outputTokens },
      elapsedMs: performance.now() - started,
      passes,
    };
  }

  /** Split a request that exceeds the configured question limit. */
  private batch(request: EngineRequest): EngineRequest[] {
    const limit = this.config.maxQuestionsPerRequest ?? 128;
    const ids = Object.keys(request.questions);
    if (ids.length <= limit) return [request];

    const batches: EngineRequest[] = [];
    for (let i = 0; i < ids.length; i += limit) {
      const slice = ids.slice(i, i + limit);
      batches.push({
        state: request.state,
        questions: Object.fromEntries(slice.map((id) => [id, request.questions[id]])),
      });
    }
    return batches;
  }

  private async post(request: EngineRequest, attempt = 0): Promise<{
    model?: string;
    answers?: Record<string, unknown>;
    usage?: { input_tokens?: number; output_tokens?: number };
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30000);

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/systemone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          state: request.state,
          questions: request.questions,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = RETRY_STATUSES.has(response.status);
        if (retryable && attempt < 3) {
          clearTimeout(timeout);
          // Honour retry-after when the response carries one, as TypeSafe asks.
          const retryAfter = Number(response.headers.get('retry-after'));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, Math.min(waitMs, 10_000)));
          return this.post(request, attempt + 1);
        }
        throw new EngineUnavailable(
          `${this.config.name} returned ${response.status}.` +
            (retryable ? ' The engine is busy; no verdict was produced.' : ''),
          response.status,
          retryable
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof EngineUnavailable) throw error;
      // A dropped connection or a timeout is retried like a busy response: over a run
      // of thousands of requests one of them will happen, and it should not end the run.
      if (attempt < 4) {
        clearTimeout(timeout);
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        return this.post(request, attempt + 1);
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new EngineUnavailable(`${this.config.name} did not respond in time.`, undefined, true);
      }
      throw new EngineUnavailable(
        `${this.config.name} could not be reached: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
