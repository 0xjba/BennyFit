/**
 * The remote decision engine.
 *
 * Jev and OpenJev speak the same wire API, so one adapter covers both and the choice
 * is configuration rather than code. The request shape is taken from OpenJev's README,
 * which states Jev compatibility; the field names have not been confirmed against
 * Jev's own documentation, so `WIRE_FORMAT_UNCONFIRMED` marks what to re-check when a
 * key exists.
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
  'Request field names: model, state, questions{id:{type,instructions,criteria}}',
  'Whether a noul answer returns {noul: P(yes)} or a two-option distribution',
  'Whether confidence is returned directly, and on the same 1 - H/lnK definition',
  'Whether the response reports forward passes',
];

export interface RemoteEngineConfig {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  /** Requests above this many criteria are split, to stay under the choice cardinality. */
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
      passes += response.passes ?? 1;
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
      model: this.config.model,
      answers,
      usage: { inputTokens, outputTokens },
      elapsedMs: performance.now() - started,
      passes,
    };
  }

  /** Split a request that exceeds the engine's choice cardinality. */
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
    answers?: Record<string, unknown>;
    usage?: { input_tokens?: number; output_tokens?: number };
    passes?: number;
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
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
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
