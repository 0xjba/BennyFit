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
import { NOT_STATED } from './not-stated';

export interface VoiResult {
  /** Spread in total annual dollars between the best and worst option. */
  spreadCents: Cents;
  /**
   * Expected change in total annual dollars from learning the true answer: each
   * option's change from the result as it stands, weighted by the engine's probability
   * for that option. This is what ranks questions.
   */
  expectedCents: Cents;
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
  answers: Answers,
  currentTotalCents?: Cents
): VoiResult {
  // "Not stated" is not an answer a household can give, so it is never pinned.
  const options = Object.keys(criterion.criteria).filter((o) => o !== NOT_STATED);
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

  const now = currentTotalCents ?? totalAnnualValue(evaluate(state, answers));
  const probabilities = beliefFor(criterion, answers[criterion.instanceId]?.probabilities ?? {});
  const expectedCents = Math.round(
    options.reduce((sum, o) => sum + (probabilities[o] ?? 0) * Math.abs(byOption[o].totalCents - now), 0)
  );

  // How many distinct programs flip verdict somewhere across the options. This is the
  // tie-break that makes a question settling two programs outrank one settling one.
  const everEligible = new Set(eligibilitySets.flat());
  let programsAffected = 0;
  for (const programId of everEligible) {
    const appears = eligibilitySets.filter((set) => set.includes(programId)).length;
    if (appears > 0 && appears < eligibilitySets.length) programsAffected++;
  }

  return { spreadCents, expectedCents, programsAffected, byOption };
}

/**
 * How likely each option is to be the truth, for weighing a question.
 *
 * Where the paragraph is silent and the rule declares a presumption, the engine's
 * distribution measures whether the text says so, which for silence is close to even.
 * It is not the chance that the presumption is wrong: most people asked whether they
 * have a Social Security number do. So a presumed criterion is weighed by how often
 * its kind of presumption fails, and every other criterion by the engine's own
 * distribution, which is what a calibrated readout is for.
 *
 * The two rates are declared assumptions, not measured population figures, and they
 * are deliberately not tuned on the validation households: in those synthetic
 * households a presumption is never wrong, so tuning would drive both rates to zero and
 * stop the questions that matter for, say, a grandparent raising grandchildren.
 */
export const PRESUMPTION_FAILURE_RATE = { routine: 0.05, material: 0.2 };

function beliefFor(
  criterion: InstantiatedCriterion,
  engine: Record<string, number>
): Record<string, number> {
  if (criterion.presumption === undefined) return engine;
  const options = Object.keys(criterion.criteria);
  const others = options.filter((o) => o !== criterion.presumption);
  const failure = PRESUMPTION_FAILURE_RATE[criterion.assumptionStrength ?? 'material'];
  return Object.fromEntries(
    options.map((o) => [o, o === criterion.presumption ? 1 - failure : failure / Math.max(1, others.length)])
  );
}

export interface Candidate {
  criterion: InstantiatedCriterion;
  confidence: number;
  voi: VoiResult;
  /** True when a declared presumption is standing in for the engine's answer. */
  presumed: boolean;
}

export interface SelectionOptions {
  /** Criteria at or above this confidence are treated as settled. */
  tau: number;
  /** Instance ids already asked about, which are never asked again. */
  asked?: Set<string>;
  /**
   * A question whose expected dollar change is below this is not worth a person's
   * time, and is not asked.
   */
  minExpectedCents?: Cents;
}

/**
 * $25 a year. Chosen on the development households: any floor from $25 to $250 cut the
 * questions asked by a third with no loss of accuracy, and $25 is the lowest of them,
 * so a question is still asked whenever real money turns on it.
 */
export const DEFAULT_MIN_EXPECTED_CENTS = 2500;

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
  const now = totalAnnualValue(evaluate(state, answers));
  const floor = options.minExpectedCents ?? DEFAULT_MIN_EXPECTED_CENTS;

  for (const criterion of criteria) {
    if (asked.has(criterion.instanceId)) continue;
    const answer = answers[criterion.instanceId];
    if (!answer) continue;
    if (answer.confidence >= options.tau) continue;

    const result = voi(criterion, state, answers, now);
    if (result.spreadCents <= 0) continue;
    if (result.expectedCents < floor) continue;
    candidates.push({
      criterion,
      confidence: answer.confidence,
      voi: result,
      presumed: criterion.presumption !== undefined,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // Ranked by expected dollar change, not by the spread between best and worst case.
    // The spread ignores how likely each option is: whether someone served in wartime
    // swings a veterans pension of $17,000 a year, so it topped the list for everyone,
    // however sure the engine was that they had not. Weighting by the engine's own
    // probabilities is what a calibrated readout is for.
    if (b.voi.expectedCents !== a.voi.expectedCents) return b.voi.expectedCents - a.voi.expectedCents;
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
