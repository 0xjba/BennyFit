/**
 * Value of information: deciding which question is worth asking.
 *
 * This is the part that is not plumbing. Every other system built on a typed readout
 * treats the model's probabilities as the output. Here they are a control signal: a
 * flat distribution over a criterion's options is the engine reporting that the
 * narrative does not settle that criterion, and the system's job is then to work out
 * which of those unsettled criteria is worth a person's time to answer.
 *
 * Uncertainty alone is not a reason to ask. A criterion can be entirely uncertain and
 * entirely irrelevant: if forcing every one of its options produces the same dollar
 * total across all programs, the answer cannot change anything and the question is
 * never asked. That is the whole definition of load-bearing, and it replaces any prose
 * rule about which questions matter.
 */

import { Cents } from './money';
import { InstantiatedCriterion } from './criteria';
import { EngineAnswer } from './engine/types';
import { Answers, ScreeningState, evaluate, totalAnnualValue } from './evaluate';

export interface VoiResult {
  /** Spread in total annual dollars between the best and worst option. */
  spreadCents: Cents;
  /** How many programs change verdict across the options. */
  programsAffected: number;
  byOption: Record<string, { totalCents: Cents; eligiblePrograms: string[] }>;
}

/** An answer pinned to a particular option, standing in for a real engine answer. */
function pinned(option: string, options: string[]): EngineAnswer {
  return {
    choice: option,
    probabilities: Object.fromEntries(options.map((o) => [o, o === option ? 1 : 0])),
    confidence: 1,
  };
}

export function voi(
  criterion: InstantiatedCriterion,
  state: ScreeningState,
  answers: Answers
): VoiResult {
  const options = Object.keys(criterion.criteria);
  const byOption: VoiResult['byOption'] = {};
  const eligibilitySets: string[][] = [];

  for (const option of options) {
    const forced: Answers = {
      ...answers,
      [criterion.instanceId]: pinned(option, options),
    };
    const verdicts = evaluate(state, forced);
    const eligible = Object.values(verdicts)
      .filter((v) => v.eligible)
      .map((v) => v.programId)
      .sort();

    byOption[option] = { totalCents: totalAnnualValue(verdicts), eligiblePrograms: eligible };
    eligibilitySets.push(eligible);
  }

  const totals = options.map((o) => byOption[o].totalCents);
  const spreadCents = Math.max(...totals) - Math.min(...totals);

  // How many distinct programs flip verdict somewhere across the options. This is the
  // tie-break that makes a question settling two programs outrank one settling one.
  const everEligible = new Set(eligibilitySets.flat());
  let programsAffected = 0;
  for (const programId of everEligible) {
    const appears = eligibilitySets.filter((set) => set.includes(programId)).length;
    if (appears > 0 && appears < eligibilitySets.length) programsAffected++;
  }

  return { spreadCents, programsAffected, byOption };
}

export interface Candidate {
  criterion: InstantiatedCriterion;
  confidence: number;
  voi: VoiResult;
}

export interface SelectionOptions {
  /** Criteria at or above this confidence are treated as settled. */
  tau: number;
  /** Instance ids already asked about, which are never asked again. */
  asked?: Set<string>;
}

/**
 * The single question worth asking next, or null when there is none.
 *
 * A criterion is a candidate when the engine is unsure about it and its answer would
 * move money. Candidates are ranked by how much money, then by how many programs it
 * would settle at once, then by id so that the same household always produces the same
 * question and the evaluation is reproducible.
 */
export function nextQuestion(
  state: ScreeningState,
  answers: Answers,
  criteria: InstantiatedCriterion[],
  options: SelectionOptions
): Candidate | null {
  const asked = options.asked ?? new Set<string>();
  const candidates: Candidate[] = [];

  for (const criterion of criteria) {
    if (asked.has(criterion.instanceId)) continue;
    const answer = answers[criterion.instanceId];
    if (!answer) continue;
    if (answer.confidence >= options.tau) continue;

    const result = voi(criterion, state, answers);
    if (result.spreadCents <= 0) continue;
    candidates.push({ criterion, confidence: answer.confidence, voi: result });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.voi.spreadCents !== a.voi.spreadCents) return b.voi.spreadCents - a.voi.spreadCents;
    if (b.voi.programsAffected !== a.voi.programsAffected) {
      return b.voi.programsAffected - a.voi.programsAffected;
    }
    return a.criterion.instanceId.localeCompare(b.criterion.instanceId);
  });

  return candidates[0];
}

/** A one-line reason a question is being asked, for display under it. */
export function reasonFor(candidate: Candidate, programNames: Record<string, string>): string {
  const affected = new Set<string>();
  const sets = Object.values(candidate.voi.byOption).map((o) => o.eligiblePrograms);
  const all = new Set(sets.flat());
  for (const programId of all) {
    const appears = sets.filter((s) => s.includes(programId)).length;
    if (appears > 0 && appears < sets.length) affected.add(programId);
  }

  const names = [...affected].map((id) => programNames[id] ?? id);
  if (names.length === 0) return 'this changes the amount you could receive';
  if (names.length === 1) return `this decides ${names[0]}`;
  if (names.length === 2) return `this decides ${names[0]} and ${names[1]} together`;
  return `this decides ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} together`;
}
