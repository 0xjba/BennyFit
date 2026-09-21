/**
 * The "not stated" escape hatch on a choice.
 *
 * A choice with no way to say "the description does not say" forces the engine to
 * pick a real option, and it will, confidently: "I'm 64 and get about $1,025 a month"
 * reads as benefits, so the question that would have found a part-time job was never
 * asked. TypeSafe's extraction guides give every choice a "none of these" option for
 * this reason.
 *
 * Where a criterion offers `not_stated`, its answer is folded before anything uses it:
 * the probability on `not_stated` comes off, the rest is renormalised so the engine's
 * lean among the real options still decides the provisional verdict, and the
 * confidence is capped at the probability that the description did say. An answer the
 * engine calls unstated is therefore unsure, and the loop weighs asking about it.
 */

import { EngineAnswer, argmax, confidenceOf } from './engine/types';

export const NOT_STATED = 'not_stated';

export function foldNotStated(answer: EngineAnswer): EngineAnswer {
  if (!(NOT_STATED in answer.probabilities)) return answer;
  const unstated = answer.probabilities[NOT_STATED] ?? 0;
  const rest = Object.fromEntries(Object.entries(answer.probabilities).filter(([o]) => o !== NOT_STATED));
  const total = Object.values(rest).reduce((a, b) => a + b, 0);
  const options = Object.keys(rest);
  const probabilities =
    total > 0
      ? Object.fromEntries(options.map((o) => [o, rest[o] / total]))
      : Object.fromEntries(options.map((o) => [o, 1 / options.length]));
  return {
    choice: argmax(probabilities),
    probabilities,
    confidence: Math.min(confidenceOf(probabilities), 1 - unstated),
  };
}

export function foldAll(answers: Record<string, EngineAnswer>): Record<string, EngineAnswer> {
  return Object.fromEntries(Object.entries(answers).map(([id, a]) => [id, foldNotStated(a)]));
}
