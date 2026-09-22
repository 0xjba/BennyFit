/**
 * The generation baseline: the same job done by asking a model to write JSON.
 *
 * This exists to make the comparison concrete rather than asserted. A typed readout
 * returns a distribution over exactly the options a criterion offers, so an answer is
 * structurally one of them. A model writing JSON can return anything that parses,
 * including an option id belonging to a different criterion, and a schema validator
 * that only checks shape will pass it.
 *
 * Every failure this reports is detected mechanically:
 *
 *   - `unparseable`   the response was not JSON at all
 *   - `missing`       a criterion the request asked about has no answer
 *   - `crossWired`    the answer is a valid option id, but of another criterion
 *   - `invented`      the answer is not an option id anywhere in the request
 *
 * There is no fixture here. Without a key the lane reports that it did not run, and
 * the comparison is simply absent. A simulated failure would demonstrate nothing: the
 * whole point is that these are things a real model really does, and a fabricated
 * example would be evidence of nothing but the fabrication.
 */

import {
  EngineAnswer,
  EngineClient,
  EngineQuestion,
  EngineRequest,
  EngineResponse,
  EngineUnavailable,
  argmax,
  confidenceOf,
} from './types';

export type GenerationFault = 'unparseable' | 'missing' | 'crossWired' | 'invented';

export interface GenerationAnswer {
  criterionId: string;
  raw: unknown;
  choice: string | null;
  /** What the model said about its own confidence, if it said anything. */
  selfReportedConfidence: number | null;
  fault: GenerationFault | null;
  /** For a cross-wired answer, the criterion the option actually belongs to. */
  borrowedFrom?: string;
}

export interface GenerationResult {
  model: string;
  answers: Record<string, GenerationAnswer>;
  elapsedMs: number;
  usage: { inputTokens: number; outputTokens: number };
  faults: Record<GenerationFault, number>;
  parsed: boolean;
  /** Whether the answer was constrained by a JSON schema listing each criterion's options. */
  structured: boolean;
}

export interface GenerationConfig {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  timeoutMs?: number;
  /**
   * Constrain the reply with a JSON schema whose every answer is an enum of that
   * criterion's own options, which makes invented and cross-wired answers
   * impossible. On by default. Under a schema a whole household exceeds the provider's
   * grammar limit, so the criteria go in batches; with it off, every criterion goes in
   * one request and answers are validated in code. The report compares both.
   */
  structured?: boolean;
  /**
   * Under a schema, how many criteria go in one call. Anthropic refuses a schema whose
   * compiled grammar is too large, and a full screening of about 80 criteria, each
   * with its own enum, is over that line. Batches run in parallel, and each carries the
   * whole household description, so no batch answers with less to go on.
   */
  batchSize?: number;
  /** Where the evaluation harness caches responses. Never set by the app. */
  cacheDir?: string;
}

/**
 * Criterion ids as JSON property names. Ids like `eitc.child_age#1` carry characters
 * some providers reject in schema property names, so each is mapped to a safe key and
 * back. The prompt uses the same keys, so the model sees one name per criterion.
 */
export function safeKeys(ids: string[]): { toSafe: Map<string, string>; toId: Map<string, string> } {
  const toSafe = new Map<string, string>();
  const toId = new Map<string, string>();
  for (const id of ids) {
    let key = id.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 60);
    while (toId.has(key)) key = `${key}_`;
    toSafe.set(id, key);
    toId.set(key, id);
  }
  return { toSafe, toId };
}

export function answerSchema(
  questions: Record<string, EngineQuestion>,
  toSafe: Map<string, string>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [id, question] of Object.entries(questions)) {
    const options = Array.isArray(question.criteria) ? question.criteria : Object.keys(question.criteria);
    properties[toSafe.get(id)!] = {
      type: 'object',
      properties: {
        choice: { type: 'string', enum: options },
        confidence: { type: 'number' },
      },
      required: ['choice', 'confidence'],
      additionalProperties: false,
    };
  }
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function buildPrompt(
  state: string,
  questions: Record<string, EngineQuestion>,
  keyOf: (id: string) => string = (id) => id
): string {
  const lines: string[] = [
    'You are screening a household for federal benefit programs.',
    'Below is a description of the household, followed by a list of criteria.',
    'For each criterion, choose exactly one of the options listed for that criterion.',
    '',
    'Respond with JSON only, in this shape, with one entry per criterion id:',
    '{"<criterion id>": {"choice": "<option id>", "confidence": <number between 0 and 1>}}',
    '',
    'HOUSEHOLD',
    state,
    '',
    'CRITERIA',
  ];

  for (const [id, question] of Object.entries(questions)) {
    const options = Array.isArray(question.criteria)
      ? question.criteria
      : Object.entries(question.criteria).map(([k, v]) => `${k} (${v})`);
    lines.push(`- ${keyOf(id)}: ${question.instructions}`);
    lines.push(`  options: ${options.join(' | ')}`);
  }

  return lines.join('\n');
}

/** Extract the first JSON object in a response that may be wrapped in prose or fences. */
function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function classify(
  parsed: unknown,
  questions: Record<string, EngineQuestion>
): { answers: Record<string, GenerationAnswer>; faults: Record<GenerationFault, number> } {
  const answers: Record<string, GenerationAnswer> = {};
  const faults: Record<GenerationFault, number> = {
    unparseable: 0,
    missing: 0,
    crossWired: 0,
    invented: 0,
  };

  // Which criterion each option id belongs to, so a borrowed id can be traced home.
  const owner = new Map<string, string[]>();
  for (const [id, question] of Object.entries(questions)) {
    const options = Array.isArray(question.criteria)
      ? question.criteria
      : Object.keys(question.criteria);
    for (const option of options) {
      owner.set(option, [...(owner.get(option) ?? []), id]);
    }
  }

  const record = (parsed ?? {}) as Record<string, unknown>;

  for (const [id, question] of Object.entries(questions)) {
    const options = Array.isArray(question.criteria)
      ? question.criteria
      : Object.keys(question.criteria);
    const raw = record[id];

    if (raw === undefined || raw === null) {
      answers[id] = {
        criterionId: id,
        raw,
        choice: null,
        selfReportedConfidence: null,
        fault: 'missing',
      };
      faults.missing++;
      continue;
    }

    const value =
      typeof raw === 'string'
        ? { choice: raw, confidence: null }
        : (raw as { choice?: unknown; confidence?: unknown });

    const choice = typeof value.choice === 'string' ? value.choice : null;
    const confidence =
      typeof value.confidence === 'number' && Number.isFinite(value.confidence)
        ? Math.max(0, Math.min(1, value.confidence))
        : null;

    if (choice === null) {
      answers[id] = { criterionId: id, raw, choice: null, selfReportedConfidence: confidence, fault: 'missing' };
      faults.missing++;
      continue;
    }

    if (options.includes(choice)) {
      answers[id] = { criterionId: id, raw, choice, selfReportedConfidence: confidence, fault: null };
      continue;
    }

    const owners = (owner.get(choice) ?? []).filter((o) => o !== id);
    if (owners.length > 0) {
      // A valid option id, for a different criterion. This is the failure a schema
      // validator cannot see: the document is well formed and the answer is wrong in
      // a way that only knowing which options belong to which criterion reveals.
      answers[id] = {
        criterionId: id,
        raw,
        choice: null,
        selfReportedConfidence: confidence,
        fault: 'crossWired',
        borrowedFrom: owners[0],
      };
      faults.crossWired++;
      continue;
    }

    answers[id] = {
      criterionId: id,
      raw,
      choice: null,
      selfReportedConfidence: confidence,
      fault: 'invented',
    };
    faults.invented++;
  }

  return { answers, faults };
}

export class GenerationBaseline {
  constructor(private readonly config: GenerationConfig) {}

  get name(): string {
    return this.config.name;
  }

  get model(): string {
    return this.config.model;
  }

  get configured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async run(state: string, questions: Record<string, EngineQuestion>): Promise<GenerationResult> {
    const structured = this.config.structured ?? true;
    const size = this.config.batchSize ?? 15;
    const ids = Object.keys(questions);
    if (!structured || ids.length <= size) return this.runOne(state, questions);

    const batches: Record<string, EngineQuestion>[] = [];
    for (let i = 0; i < ids.length; i += size) {
      batches.push(Object.fromEntries(ids.slice(i, i + size).map((id) => [id, questions[id]])));
    }
    const started = performance.now();
    const results = await Promise.all(batches.map((b) => this.runOne(state, b)));
    const faults: Record<GenerationFault, number> = { unparseable: 0, missing: 0, crossWired: 0, invented: 0 };
    for (const r of results) for (const k of Object.keys(faults) as GenerationFault[]) faults[k] += r.faults[k];
    return {
      model: this.config.model,
      answers: Object.assign({}, ...results.map((r) => r.answers)),
      elapsedMs: performance.now() - started,
      usage: {
        inputTokens: results.reduce((n, r) => n + r.usage.inputTokens, 0),
        outputTokens: results.reduce((n, r) => n + r.usage.outputTokens, 0),
      },
      faults,
      parsed: results.every((r) => r.parsed),
      structured,
    };
  }

  /**
   * One call, retried, and cached when a cache directory is configured.
   *
   * A long evaluation makes thousands of calls, and a single dropped connection used
   * to abort the whole run after it had already been paid for. Transient failures are
   * retried with backoff. The cache is keyed by the exact request, so re-running after
   * a failure pays only for the calls that never completed; it is only ever set by the
   * evaluation harness, never by the app.
   */
  private async runOne(state: string, questions: Record<string, EngineQuestion>): Promise<GenerationResult> {
    const dir = this.config.cacheDir;
    let cachePath: string | null = null;
    if (dir) {
      const { createHash } = await import('node:crypto');
      const key = createHash('sha256')
        .update(JSON.stringify({ m: this.config.model, s: this.config.structured ?? true, state, questions }))
        .digest('hex');
      cachePath = `${dir}/${key}.json`;
      const { existsSync, readFileSync } = await import('node:fs');
      if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf8')) as GenerationResult;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await this.attemptOne(state, questions);
        if (cachePath) {
          const { mkdirSync, writeFileSync } = await import('node:fs');
          mkdirSync(dir!, { recursive: true });
          writeFileSync(cachePath, JSON.stringify(result));
        }
        return result;
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof EngineUnavailable && (error.retryable || error.status === undefined);
        if (!retryable) throw error;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
    throw lastError;
  }

  private async attemptOne(
    state: string,
    questions: Record<string, EngineQuestion>
  ): Promise<GenerationResult> {
    if (!this.config.apiKey) {
      throw new EngineUnavailable(
        `${this.config.name} has no API key configured, so the generation baseline did not run.`
      );
    }

    const structured = this.config.structured ?? true;
    const { toSafe, toId } = safeKeys(Object.keys(questions));
    const prompt = structured
      ? buildPrompt(state, questions, (id) => toSafe.get(id)!)
      : buildPrompt(state, questions);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120000);
    const started = performance.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          // No temperature: Claude Sonnet 5 does not accept one, and with
          // require_parameters on, OpenRouter refuses a request carrying a parameter the
          // model does not support rather than dropping it. Runs are therefore not
          // guaranteed to repeat exactly, which the comparison reports.
          max_tokens: 8000,
          ...(structured
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: { name: 'screening_answers', strict: true, schema: answerSchema(questions, toSafe) },
                },
                // Route only to providers that honour the schema, rather than silently
                // falling back to one that ignores it.
                provider: { require_parameters: true },
              }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // The body says why (an unknown model, no provider for the parameters asked
        // for); a bare status code leaves that to guesswork.
        const detail = (await response.text().catch(() => '')).slice(0, 2000);
        throw new EngineUnavailable(
          `${this.config.name} returned ${response.status}.${detail ? ` ${detail}` : ''}`,
          response.status,
          response.status >= 500 || response.status === 429
        );
      }

      const body = await response.json();
      const elapsedMs = performance.now() - started;
      const text: string = body?.choices?.[0]?.message?.content ?? '';
      const extracted = extractJson(text);
      // Under a schema the keys are the safe ones; map them back to criterion ids.
      const parsed =
        structured && extracted && typeof extracted === 'object'
          ? Object.fromEntries(
              Object.entries(extracted as Record<string, unknown>).map(([k, v]) => [toId.get(k) ?? k, v])
            )
          : extracted;

      if (parsed === null) {
        const { answers, faults } = classify({}, questions);
        return {
          model: this.config.model,
          answers,
          elapsedMs,
          usage: {
            inputTokens: body?.usage?.prompt_tokens ?? 0,
            outputTokens: body?.usage?.completion_tokens ?? 0,
          },
          faults: { ...faults, unparseable: 1 },
          parsed: false,
          structured,
        };
      }

      const { answers, faults } = classify(parsed, questions);
      return {
        model: this.config.model,
        answers,
        elapsedMs,
        usage: {
          inputTokens: body?.usage?.prompt_tokens ?? 0,
          outputTokens: body?.usage?.completion_tokens ?? 0,
        },
        faults,
        parsed: true,
        structured,
      };
    } catch (error) {
      if (error instanceof EngineUnavailable) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new EngineUnavailable(`${this.config.name} did not respond in time.`, undefined, true);
      }
      throw new EngineUnavailable(
        `${this.config.name} could not be reached: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * The two generation lanes.
 *
 * The first holds the model fixed and changes only the readout method, which isolates
 * the mechanism: same weights, same prompt, same state. It needs OpenJev: Jev itself is
 * not trained to generate text (TypeSafe's jaggedness notes say so), so with only a Jev
 * key this lane does not run.
 *
 * The second is a general-purpose model writing JSON under a schema, the way most teams
 * would build this today. It defaults to Claude Sonnet 5: strong enough that its
 * results cannot be put down to a weak model, cheap enough to run on every validation
 * household.
 */
export function generationLanes(env: NodeJS.ProcessEnv = process.env): {
  sameModel: GenerationBaseline;
  frontier: GenerationBaseline;
} {
  return {
    sameModel: new GenerationBaseline({
      name: 'same model, generating JSON',
      baseUrl: env.OPENJEV_GENERATION_BASE_URL ?? 'https://api.codiv.ai/v1',
      model: env.OPENJEV_GENERATION_MODEL ?? 'openjev-latest',
      apiKey: env.OPENJEV_API_KEY,
    }),
    frontier: new GenerationBaseline({
      name: 'general-purpose model, generating JSON',
      baseUrl: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
      model: env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-5',
      apiKey: env.OPENROUTER_API_KEY,
      structured: env.OPENROUTER_STRUCTURED !== '0',
      batchSize: Number(env.OPENROUTER_BATCH_SIZE) || undefined,
      cacheDir: env.GENERATION_CACHE_DIR || undefined,
    }),
  };
}

/**
 * The generation baseline behind the same interface as the typed engine.
 *
 * This is what makes the comparison fair: the baseline runs through the identical
 * loop, with the same parser, rules, follow-up questions and answer key, and only the
 * source of the answers changes.
 *
 * A generating model returns one option and a confidence it wrote itself, not a
 * distribution. That number is spread into one the loop can use: the chosen option
 * gets the stated confidence (never less than an even share, or the choice would
 * flip), and the rest is split evenly. This is how a team would have to use such a
 * model, and it is the thing being compared. An answer that is missing or unusable
 * becomes an even distribution, which the loop treats as unknown, the same as a typed
 * answer it cannot trust.
 */
export class GenerationEngine implements EngineClient {
  readonly isFixture = false;
  readonly faultTotals: Record<GenerationFault, number> = { unparseable: 0, missing: 0, crossWired: 0, invented: 0 };
  /** Self-reported confidence alongside the answer chosen, for calibration. */
  readonly selfReports: { criterionId: string; choice: string; confidence: number }[] = [];

  constructor(private readonly baseline: GenerationBaseline) {}

  get name(): string {
    return `${this.baseline.model} (generating JSON)`;
  }

  async ask(request: EngineRequest): Promise<EngineResponse> {
    const result = await this.baseline.run(request.state, request.questions);
    for (const k of Object.keys(this.faultTotals) as GenerationFault[]) this.faultTotals[k] += result.faults[k];

    const answers: Record<string, EngineAnswer> = {};
    for (const [id, question] of Object.entries(request.questions)) {
      const options = Array.isArray(question.criteria) ? question.criteria : Object.keys(question.criteria);
      const a = result.answers[id];
      let probabilities: Record<string, number>;
      if (a && a.choice && options.includes(a.choice)) {
        const even = 1 / options.length;
        const stated = a.selfReportedConfidence ?? 1;
        const top = options.length === 1 ? 1 : Math.max(stated, even + 1e-6);
        probabilities = Object.fromEntries(
          options.map((o) => [o, o === a.choice ? top : (1 - top) / (options.length - 1)])
        );
        if (a.selfReportedConfidence !== null) {
          this.selfReports.push({ criterionId: id, choice: a.choice, confidence: a.selfReportedConfidence });
        }
      } else {
        probabilities = Object.fromEntries(options.map((o) => [o, 1 / options.length]));
      }
      answers[id] = { choice: argmax(probabilities), probabilities, confidence: confidenceOf(probabilities) };
    }

    return {
      model: result.model,
      answers,
      usage: result.usage,
      elapsedMs: result.elapsedMs,
      passes: 1,
    };
  }
}
