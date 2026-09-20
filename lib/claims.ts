/**
 * Every number that appears on the marketing pages, in one place.
 *
 * A claim is either `measured`, in which case it names where the measurement came
 * from, or `pending`, in which case the page renders a placeholder instead of a
 * figure. Nothing on a public page may be a number that was not produced by something.
 *
 * This file exists so that filling in a claim is a deliberate edit in one place rather
 * than a plausible-looking figure typed into a component.
 */

export type Claim =
  | { status: 'measured'; value: string; caption: string; source: string }
  | { status: 'pending'; caption: string; needs: string };

export const CLAIMS: Record<string, Claim> = {
  programs: {
    status: 'measured',
    value: '11',
    caption: 'benefit programs checked at once',
    source:
      'SNAP, the Earned Income Tax Credit, the Child Tax Credit, Lifeline, WIC, school ' +
      'meals, CSFP, LIHEAP, Head Start, Medicare Savings Programs and Extra Help, each ' +
      'against its federal rule set.',
  },

  checks: {
    status: 'measured',
    value: '40+',
    caption: 'eligibility checks per household',
    source:
      'Counted from the rule files. A single adult produces 41 checks and a family with ' +
      'children produces 65, because several tests are per person.',
  },

  averageValue: {
    status: 'measured',
    value: '$10,418',
    caption: 'average a qualifying household is entitled to, per year',
    source:
      'Computed from the federal rules applied to the 150 validation households, not ' +
      'from any model: 120 of them qualify for something, and the average of those is ' +
      '$10,418 a year. The median is $5,912 and the largest is $26,186. These describe ' +
      'the validation set, which is synthetic, rather than the population.',
  },

  programsPerHousehold: {
    status: 'measured',
    value: '4.3',
    caption: 'programs the average household qualifies for',
    source:
      'Across the 150 validation households. 120 of the 150 qualify for three or more.',
  },

  intake: {
    status: 'measured',
    value: '1',
    caption: 'paragraph instead of eleven applications',
    source: 'The separate application paths cover dozens of questions between them.',
  },

  questions: {
    status: 'measured',
    value: '≤ 3',
    caption: 'follow-up questions, only when they change the answer',
    source:
      'A hard cap. A question is only asked when the answer would change the outcome ' +
      'or the amount.',
  },

  // --- Pending a run against the production model -------------------------

  timeToAnswer: {
    status: 'pending',
    caption: 'to a full screening result',
    needs: 'A timed run against the production model rather than the local test harness.',
  },

  accuracy: {
    status: 'pending',
    caption: 'agreement with the federal rules',
    needs:
      'A run of the 150-household validation set against the production model. The ' +
      'current figure comes from a local test harness and is not a measurement of the ' +
      'model.',
  },

  costPerScreening: {
    status: 'pending',
    caption: 'per completed screening',
    needs: 'Token accounting from a production run, at contracted rates.',
  },

  throughput: {
    status: 'pending',
    caption: 'screenings per hour, per seat',
    needs: 'A production run, measured against a staffed baseline.',
  },
};

export function claimValue(key: string): string | null {
  const claim = CLAIMS[key];
  return claim && claim.status === 'measured' ? claim.value : null;
}

/**
 * Figures cited from published research and federal sources.
 *
 * These describe the problem rather than this product, and each is attributed. None of
 * them is a result this software has produced, and the pages that use them say so.
 */
export const CITED = {
  eitcUnclaimedPeople: {
    value: '~5 million',
    claim: 'eligible taxpayers do not claim the Earned Income Tax Credit each year',
    source: 'Tax Policy Center, citing TIGTA',
    href: 'https://taxpolicycenter.org/briefing-book/who-receives-eitc',
  },
  eitcUnclaimedDollars: {
    value: '~$7 billion',
    claim: 'in Earned Income Tax Credit goes unclaimed each year',
    source: 'Tax Policy Center, citing TIGTA',
    href: 'https://taxpolicycenter.org/briefing-book/who-receives-eitc',
  },
  snapTakeUp: {
    value: '~4 in 5',
    claim: 'of eligible people receive SNAP, leaving one in five who do not',
    source: 'USDA Economic Research Service',
    href: 'https://www.ers.usda.gov/topics/food-nutrition-assistance/supplemental-nutrition-assistance-program-snap/key-statistics-and-research',
  },
  unawareShare: {
    value: '~half',
    claim: 'of eligible non-participants are unaware they qualify',
    source: 'Finkelstein & Notowidigdo, NBER WP-18-03',
    href: 'https://www.nber.org/papers/w24652',
  },
  assistanceLift: {
    value: '11% → 18%',
    claim:
      'enrollment among likely-eligible households when outreach was paired with help ' +
      'completing the application, in a randomized trial of about 30,000 people',
    source: 'Finkelstein & Notowidigdo, NBER WP-18-03',
    href: 'https://www.nber.org/papers/w24652',
  },
  lifelineParticipation: {
    value: '~22%',
    claim: 'of eligible households take up the Lifeline communications benefit',
    source: 'Congressional Research Service IF13283',
    href: 'https://www.congress.gov/crs-product/IF13283',
  },
} as const;
