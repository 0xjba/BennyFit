/**
 * The decision engine interface.
 *
 * The engine is asked, in one request, to read a household description and resolve
 * every criterion of every program against it. It does not generate text: each answer
 * is a probability distribution over the options the criterion itself supplies, so an
 * answer is structurally guaranteed to be one of them.
 *
 * The confidence that comes back with each answer is what the elicitation loop runs
 * on. It is normalised entropy, 1 - H(p)/ln K, which is 1 when the distribution is a
 * point mass and 0 when it is uniform. A flat distribution is the engine saying it
 * cannot tell from what it has been given, which is the signal that a question is
 * worth asking.
 */

export type QuestionType = 'noul' | 'choice' | 'score';

export interface EngineQuestion {
  type: QuestionType;
  instructions: string;
  /** For noul, `{true, false}`. For choice, option id to description. */
  criteria: Record<string, string> | string[];
}

export interface EngineRequest {
  state: string;
  questions: Record<string, EngineQuestion>;
}

export interface EngineAnswer {
  /** The chosen option id. For a noul this is 'true' or 'false'. */
  choice: string;
  probabilities: Record<string, number>;
  /** Normalised entropy, in [0, 1]. */
  confidence: number;
}

export interface EngineResponse {
  model: string;
  answers: Record<string, EngineAnswer>;
  usage: { inputTokens: number; outputTokens: number };
  /** Wall-clock milliseconds for the round trip, measured by the caller. */
  elapsedMs: number;
  /** How many forward passes the engine reported, when it reports them. */
  passes?: number;
}

export interface EngineClient {
  readonly name: string;
  /** True when answers come from a local fixture rather than a model. */
  readonly isFixture: boolean;
  ask(request: EngineRequest): Promise<EngineResponse>;
}

/**
 * Normalised entropy of a distribution: 1 - H(p) / ln K.
 *
 * Returned as 1 for a single-option distribution, where ln K is zero and the engine
 * has no choice to be uncertain about.
 */
export function confidenceOf(probabilities: Record<string, number>): number {
  const values = Object.values(probabilities).filter((p) => p > 0);
  const k = Object.keys(probabilities).length;
  if (k <= 1) return 1;
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const entropy = -values
    .map((p) => p / total)
    .reduce((acc, p) => acc + p * Math.log(p), 0);
  return Math.max(0, Math.min(1, 1 - entropy / Math.log(k)));
}

export function argmax(probabilities: Record<string, number>): string {
  let best: string | null = null;
  let bestValue = -Infinity;
  // Sorted so that ties resolve the same way on every run.
  for (const key of Object.keys(probabilities).sort()) {
    if (probabilities[key] > bestValue) {
      bestValue = probabilities[key];
      best = key;
    }
  }
  if (best === null) throw new Error('Empty probability distribution');
  return best;
}

export class EngineUnavailable extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'EngineUnavailable';
  }
}
