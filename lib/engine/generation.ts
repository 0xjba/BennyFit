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

import { EngineQuestion, EngineUnavailable } from './types';

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
}

export interface GenerationConfig {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  timeoutMs?: number;
}

function buildPrompt(state: string, questions: Record<string, EngineQuestion>): string {
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
    lines.push(`- ${id}: ${question.instructions}`);
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

  async run(
    state: string,
    questions: Record<string, EngineQuestion>
  ): Promise<GenerationResult> {
    if (!this.config.apiKey) {
      throw new EngineUnavailable(
        `${this.config.name} has no API key configured, so the generation baseline did not run.`
      );
    }

    const prompt = buildPrompt(state, questions);
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
          temperature: 0,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new EngineUnavailable(
          `${this.config.name} returned ${response.status}.`,
          response.status,
          response.status >= 500 || response.status === 429
        );
      }

      const body = await response.json();
      const elapsedMs = performance.now() - started;
      const text: string = body?.choices?.[0]?.message?.content ?? '';
      const parsed = extractJson(text);

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
 * the mechanism: same weights, same prompt, same state. The second changes the model
 * as well, which answers the obvious objection that a more capable model would not
 * make these mistakes.
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
      name: 'frontier model, generating JSON',
      baseUrl: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
      model: env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.5',
      apiKey: env.OPENROUTER_API_KEY,
    }),
  };
}
