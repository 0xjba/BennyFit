/**
 * Turning assumptions into stated conditions.
 *
 * Some criteria ask about facts a household description never mentions — whether
 * someone has a Social Security number valid for work, whether the children lived with
 * them for most of the year. Reading silence as "no" disqualifies nearly everybody, so
 * those criteria carry a presumption.
 *
 * But a presumption that is quietly applied and then displayed as an answer is the
 * worst of both: the household is shown a fact about themselves that they never said
 * and that may not be true. So a presumption is only ever silent when it does not
 * matter. When flipping it would change whether a program comes out eligible, it stops
 * being an assumption and becomes a condition printed on the result:
 *
 *     Likely eligible, provided that the children lived with you for more than half
 *     the year.
 *
 * That is honest, and unlike a hidden assumption it is something a person can check.
 */

import { InstantiatedCriterion, baseId } from './criteria';
import { EngineAnswer } from './engine/types';
import { Answers, DEFAULT_PRESUMPTION_TAU, ScreeningState, effectiveChoice, evaluate } from './evaluate';

export interface Condition {
  instanceId: string;
  /** Plain-language statement of what is being taken as true. */
  text: string;
  /** The question that would settle it, if the household wants to. */
  question: string;
  subjectLabel: string | null;
  /** Whether a different answer removes the benefit or just changes the amount. */
  effect: 'eligibility' | 'amount';
  /** For an amount effect, how many dollars a year are at stake. */
  amountAtStakeCents?: number;
}

/**
 * How much an amount has to move before it is worth telling someone about.
 *
 * A few dollars either way is noise in a screening estimate. Several hundred is the
 * difference between one household's weekly shop and another's.
 */
const MATERIAL_SWING_CENTS = 30000;

function pinned(option: string, options: string[]): EngineAnswer {
  return {
    choice: option,
    probabilities: Object.fromEntries(options.map((o) => [o, o === option ? 1 : 0])),
    confidence: 1,
  };
}

/**
 * The conditions each program's verdict rests on.
 *
 * A presumed criterion earns a place here only if some other answer would flip that
 * program's verdict. An assumption that changes nothing is not worth a household's
 * attention and is left off.
 */
export function conditionsByProgram(
  state: ScreeningState,
  answers: Answers,
  criteria: InstantiatedCriterion[]
): Record<string, Condition[]> {
  const tau = state.tau ?? DEFAULT_PRESUMPTION_TAU;
  const baseline = evaluate(state, answers);
  const out: Record<string, Condition[]> = {};
  for (const programId of Object.keys(baseline)) out[programId] = [];

  for (const criterion of criteria) {
    if (criterion.presumption === undefined) continue;
    // A routine assumption holds for almost every household; putting it on the card
    // buries the one or two that a person should actually check.
    if (criterion.assumptionStrength === 'routine') continue;
    const answer = answers[criterion.instanceId];
    if (!answer) continue;

    // Only an assumption actually in force is a condition. Where the engine settled
    // the criterion from the description, nothing is being assumed.
    const { presumed } = effectiveChoice(criterion, answer, tau);
    if (!presumed) continue;

    const options = Object.keys(criterion.criteria).filter((o) => o !== criterion.presumption);

    for (const option of options) {
      const forced: Answers = {
        ...answers,
        [criterion.instanceId]: pinned(option, Object.keys(criterion.criteria)),
      };
      const flipped = evaluate(state, forced);

      let recorded = false;
      for (const programId of Object.keys(baseline)) {
        if (recorded) break;

        // Only an eligible verdict needs a condition attached: an ineligible one is
        // not a promise, and hedging it would read as a reason to give up.
        if (!baseline[programId].eligible) continue;
        // One entry per underlying rule, not one per person. A condition about the
        // children is a single thing to check, however many children there are.
        if (out[programId].some((c) => baseId(c.instanceId) === baseId(criterion.instanceId))) {
          continue;
        }

        const flipsEligibility = baseline[programId].eligible !== flipped[programId].eligible;
        const swing = Math.abs(
          (baseline[programId].annualValueCents ?? 0) - (flipped[programId].annualValueCents ?? 0)
        );

        // An assumption that only moves the figure a little is not worth raising; one
        // that moves it by hundreds a year is, even where eligibility holds either way.
        if (!flipsEligibility && swing < MATERIAL_SWING_CENTS) continue;

        out[programId].push({
          instanceId: criterion.instanceId,
          text: criterion.assumption ?? criterion.askIfUnsure,
          question: criterion.askIfUnsure,
          subjectLabel: criterion.scope === 'household' ? criterion.subjectLabel : null,
          effect: flipsEligibility ? 'eligibility' : 'amount',
          ...(flipsEligibility ? {} : { amountAtStakeCents: swing }),
        });
        recorded = true;
      }
      if (recorded) break;
    }
  }

  // What could remove the benefit outright comes first, then what moves the most money.
  for (const programId of Object.keys(out)) {
    out[programId].sort((a, b) => {
      if (a.effect !== b.effect) return a.effect === 'eligibility' ? -1 : 1;
      return (b.amountAtStakeCents ?? 0) - (a.amountAtStakeCents ?? 0);
    });
  }

  return out;
}
