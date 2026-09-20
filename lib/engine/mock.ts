/**
 * A local fixture standing in for the decision engine.
 *
 * This exists so the loop, the evaluation harness and both interfaces can be built and
 * run without a key. It is not a model and makes no claim to be one. Every response it
 * produces is marked as a fixture, and anything computed from it is labelled as such
 * on screen and in results.json, so a fixture run can never be mistaken for a measured
 * one.
 *
 * What it does reproduce is the shape of a typed readout: a distribution over exactly
 * the options the criterion offers, deterministic for a given state, and genuinely
 * uncertain when the description does not settle the question. That last property is
 * what makes it useful — the elicitation loop needs criteria that come back flat, and
 * a fixture that always answered confidently would exercise none of the interesting
 * paths.
 */

import { baseId } from '../criteria';
import {
  EngineAnswer,
  EngineClient,
  EngineRequest,
  EngineResponse,
  argmax,
  confidenceOf,
} from './types';

/**
 * Cues that make a criterion answerable from a household description.
 *
 * Only the fixture knows about these. A real engine reads the narrative; this table is
 * how a keyword matcher approximates that well enough to exercise the loop.
 */
const CUES: Record<string, { true?: string[]; false?: string[]; options?: Record<string, string[]> }> = {
  'snap.categorical': {
    options: {
      ssi: ['ssi', 'supplemental security income'],
      tanf: ['tanf', 'welfare', 'cash assistance'],
      ga: ['general assistance'],
      none: ['no benefits', 'not on any'],
    },
  },
  'snap.member_elderly_or_disabled': {
    true: ['disabled', 'disability', 'wheelchair', 'retired', 'medicare'],
    false: ['healthy', 'able-bodied'],
  },
  'snap.income_source': {
    options: {
      earned: ['job', 'work', 'wages', 'salary', 'paycheck', 'hourly', 'shifts'],
      unearned: ['social security', 'ssi', 'ssdi', 'pension', 'unemployment', 'disability check'],
      mixed: ['and also work', 'plus my job'],
      none: ['no income', 'nothing coming in'],
    },
  },
  'snap.income_period': {
    options: {
      weekly: ['a week', 'per week', 'weekly', 'every week'],
      biweekly: ['every two weeks', 'biweekly', 'every other week'],
      monthly: ['a month', 'per month', 'monthly'],
      annual: ['a year', 'per year', 'annually'],
    },
  },
  'snap.shelter_costs_reported': { true: ['rent', 'mortgage', 'housing'], false: ['no rent', 'live with'] },
  'snap.utilities_paid_separately': {
    true: ['gas and electric', 'utilities', 'electric', 'heating'],
    false: ['utilities included', 'all bills included'],
  },
  'snap.all_members_homeless': { true: ['homeless', 'shelter', 'no fixed address', 'car'], false: ['apartment', 'house', 'rent'] },
  'snap.dependent_care_paid': { true: ['daycare', 'child care', 'childcare', 'babysitter'], false: [] },
  'snap.child_support_paid': { true: ['child support'], false: [] },
  'snap.medical_expenses': { true: ['medical', 'prescription', 'medication', 'doctor'], false: [] },
  'snap.resources_over_limit': { true: ['savings', 'in the bank', 'inheritance'], false: ['no savings', 'nothing saved'] },
  'snap.member_student': { true: ['college', 'university', 'student'], false: [] },
  'snap.member_student_exemption': { true: ['work-study', 'works 20 hours', 'part-time job'], false: [] },
  'snap.member_citizenship': {
    options: { citizen: ['citizen', 'born in'], qualified_noncitizen: ['green card', 'permanent resident'], other: [], unknown: [] },
  },
  'snap.household_purchases_together': { true: ['we cook', 'we buy food', 'family'], false: ['separately', 'roommate'] },
  'snap.self_employment': { true: ['self-employed', 'my own business', 'freelance', 'gig'], false: [] },

  'eitc.has_earned_income': { true: ['job', 'work', 'wages', 'salary', 'self-employed'], false: ['no income', 'do not work', "don't work"] },
  'eitc.filing_status': {
    options: {
      single: ['single', 'live alone', 'not married'],
      hoh: ['head of household'],
      mfj: ['married', 'my wife', 'my husband', 'we file'],
      qss: ['widowed', 'widow'],
      mfs: ['separated', 'filing separately'],
    },
  },
  'eitc.separated_spouse_rules': { true: ['lived apart', 'separated since'], false: [] },
  'eitc.investment_income_over_limit': { true: ['investments', 'dividends', 'rental income'], false: [] },
  'eitc.valid_ssn': { true: ['social security number', 'citizen'], false: [] },
  'eitc.foreign_earned_income': { true: ['abroad', 'overseas'], false: [] },
  'eitc.claimed_as_dependent': { true: ['my parents claim', 'claimed by'], false: [] },
  'eitc.child_relationship': { true: ['my son', 'my daughter', 'my kids', 'my children', 'my child'], false: ['nephew', 'niece', 'grandchild'] },
  'eitc.child_age': { true: ['years old', 'toddler', 'baby', 'in school', 'kindergarten'], false: [] },
  'eitc.child_residency': { true: ['lives with me', 'live with me', 'at home'], false: ['lives with', 'every other weekend', 'custody'] },
  'eitc.child_joint_return': { true: ['married'], false: [] },
  'eitc.child_claimed_elsewhere': { true: ['their father claims', 'their mother claims', 'ex claims'], false: [] },
  'eitc.claimant_age_band': {
    options: { under25: ['i am 1', 'i am 2'], '25to64': ['i am 3', 'i am 4', 'i am 5', 'i am 6'], '65plus': ['i am 7', 'i am 8', 'retired'] },
  },

  'lifeline.receives_snap': { true: ['snap', 'food stamps', 'ebt'], false: [] },
  'lifeline.receives_medicaid': { true: ['medicaid'], false: [] },
  'lifeline.receives_ssi': { true: ['ssi', 'supplemental security income'], false: [] },
  'lifeline.receives_fpha': { true: ['section 8', 'public housing', 'housing voucher'], false: [] },
  'lifeline.receives_veterans_pension': { true: ['veterans pension', 'survivors pension', 'va pension'], false: [] },
  'lifeline.tribal_lands': { true: ['tribal', 'reservation'], false: [] },
  'lifeline.tribal_programs': {
    options: { bia_general_assistance: ['bureau of indian affairs'], tribal_tanf: ['tribal tanf'], tribal_head_start: ['head start'], fdpir: ['fdpir', 'commodities'], none: [] },
  },
  'lifeline.one_per_household': { true: ['already have lifeline'], false: [] },
};

/** A stable hash, so the same state and criterion always produce the same answer. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function distribute(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) out[k] = v / total;
  return out;
}

/** Any age the state reports, from the figures the parser already established. */
function agesIn(state: string): number[] {
  const line = state.match(/Ages mentioned: ([0-9, ]+)/i);
  if (!line) return [];
  return line[1]
    .split(',')
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

/**
 * Whether a cue appears inside a negation.
 *
 * "No, I have almost nothing saved" contains the word "saved", and a bare keyword
 * matcher reads that as a household with savings. A real readout follows the negation;
 * the fixture approximates it by looking back a few words from the hit.
 */
function negated(haystack: string, cue: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(cue, from);
    if (at === -1) return false;
    const before = haystack.slice(Math.max(0, at - 40), at);
    const isNegated =
      /\b(no|not|never|hardly|barely|without)\b[^.;]*$/.test(before) ||
      /\b(n't|nothing|none|nobody)\b[^.;]*$/.test(before);
    if (!isNegated) return false;
    from = at + cue.length;
  }
}

function hits(haystack: string, keys: string[]): number {
  return keys.filter((k) => haystack.includes(k) && !negated(haystack, k)).length;
}

/**
 * The part of the state a keyword matcher should read.
 *
 * Questions put to the household are dropped. "Does everyone here get SSI, TANF, or
 * General Assistance?" contains every keyword that would answer it, so a matcher that
 * reads the question along with the answer concludes yes no matter what was said. A
 * model reading the narrative has no such problem; this is a limitation of the fixture
 * and of nothing else.
 */
function readable(state: string): string {
  return state
    .split('\n')
    .filter((line) => !/^\s*-\s*Q:/.test(line))
    .join('\n')
    .toLowerCase();
}

function answerFor(state: string, id: string, options: string[]): EngineAnswer {
  const haystack = readable(state);
  const cues = CUES[baseId(id)];
  const noise = hash(`${state}::${id}`);

  const weights: Record<string, number> = {};
  for (const option of options) weights[option] = 1;

  let matched = false;

  if (cues?.options) {
    for (const [option, keys] of Object.entries(cues.options)) {
      if (!options.includes(option)) continue;
      const n = hits(haystack, keys);
      if (n > 0) {
        weights[option] += 8 * n;
        matched = true;
      }
    }
  }
  if (cues?.true && options.includes('true')) {
    const n = hits(haystack, cues.true);
    const negatedCount = cues.true.filter((k) => haystack.includes(k) && negated(haystack, k)).length;
    if (n > 0) {
      weights['true'] += 8 * n;
      matched = true;
    } else if (negatedCount > 0) {
      weights['false'] += 8 * negatedCount;
      matched = true;
    }
  }
  if (cues?.false && options.includes('false')) {
    const n = hits(haystack, cues.false);
    if (n > 0) {
      weights['false'] += 8 * n;
      matched = true;
    }
  }

  // An age already established in the state settles the elderly test outright, the
  // way a reader would treat it, rather than leaving it to keyword luck.
  if (baseId(id) === 'snap.member_elderly_or_disabled') {
    const ages = agesIn(state);
    if (ages.some((a) => a >= 60)) {
      weights['true'] += 12;
      matched = true;
    } else if (ages.length > 0 && ages.every((a) => a < 60) && !matched) {
      weights['false'] += 6;
      matched = true;
    }
  }

  // Nothing in the description pointing either way leans slightly toward the neutral
  // answer, the way a reader would, but not far enough to look settled.
  if (!matched) {
    for (const neutral of ['false', 'none', 'unknown']) {
      if (options.includes(neutral)) {
        weights[neutral] += 0.35;
        break;
      }
    }
  }

  // A little deterministic jitter so distributions are not exactly uniform, which
  // would make every unmatched criterion tie at precisely the same confidence.
  let i = 0;
  for (const option of options) {
    weights[option] += hash(`${id}::${option}::${noise}`) * 0.25;
    i++;
  }

  const probabilities = distribute(weights);
  return {
    choice: argmax(probabilities),
    probabilities,
    confidence: confidenceOf(probabilities),
  };
}

export class MockEngine implements EngineClient {
  readonly name = 'fixture-local';
  readonly isFixture = true;

  async ask(request: EngineRequest): Promise<EngineResponse> {
    const started = performance.now();
    const answers: Record<string, EngineAnswer> = {};

    for (const [id, question] of Object.entries(request.questions)) {
      const options = Array.isArray(question.criteria)
        ? question.criteria
        : Object.keys(question.criteria);
      answers[id] = answerFor(request.state, id, options);
    }

    // A single batched pass over one prefilled state, which is the shape of the real
    // thing. No artificial delay: the timings a fixture run reports are its own.
    return {
      model: this.name,
      answers,
      usage: { inputTokens: Math.ceil(request.state.length / 4), outputTokens: 0 },
      elapsedMs: performance.now() - started,
      passes: 1,
    };
  }
}
