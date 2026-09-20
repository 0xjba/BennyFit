/**
 * The arithmetic. Pure functions over facts and a threshold set.
 *
 * Nothing in this file is ever sent to the decision engine. The engine reads a
 * household narrative and answers factual predicates about it; every comparison
 * between a number and a limit, every deduction and every dollar figure is computed
 * here first, and the computed figure is what the engine is shown.
 *
 * Each function returns its working as a list of steps so the interface can display
 * the derivation instead of asserting a total.
 */

import {
  Cents,
  ceilToDollar,
  dollars,
  formatDollars,
  percentOf,
} from './money';
import {
  EitcBracket,
  EitcThresholds,
  LifelineThresholds,
  SnapThresholds,
  bySize,
  standardDeductionFor,
} from './thresholds';

export interface Step {
  label: string;
  detail: string;
  amountCents: Cents;
  runningCents: Cents;
  citation?: string;
}

// ---------------------------------------------------------------------------
// SNAP
// ---------------------------------------------------------------------------

export interface SnapFacts {
  householdSize: number;
  earnedMonthlyCents: Cents;
  unearnedMonthlyCents: Cents;
  /** Out-of-pocket medical costs of elderly or disabled members. */
  medicalMonthlyCents: Cents;
  dependentCareMonthlyCents: Cents;
  childSupportPaidMonthlyCents: Cents;
  /** Rent or mortgage plus utilities. */
  shelterMonthlyCents: Cents;
  hasElderlyOrDisabledMember: boolean;
  allMembersHomeless: boolean;
  countableResourcesCents: Cents;
  /** Every member receives SSI, TANF or General Assistance. 7 CFR 273.2(j). */
  categoricallyEligible: boolean;
}

export interface SnapNetIncome {
  grossCents: Cents;
  netCents: Cents;
  steps: Step[];
  shelterCapApplied: boolean;
}

export function snapNetIncome(f: SnapFacts, t: SnapThresholds): SnapNetIncome {
  const steps: Step[] = [];
  const grossCents = f.earnedMonthlyCents + f.unearnedMonthlyCents;
  let running = grossCents;

  steps.push({
    label: 'Gross monthly income',
    detail: `${formatDollars(f.earnedMonthlyCents)} earned + ${formatDollars(
      f.unearnedMonthlyCents
    )} unearned`,
    amountCents: grossCents,
    runningCents: running,
    citation: '7 CFR 273.10(e)(1)(i)(A)',
  });

  const earnedDeduction = percentOf(f.earnedMonthlyCents, t.earnedIncomeDeductionRate);
  running -= earnedDeduction;
  steps.push({
    label: 'Earned income deduction',
    detail: `${t.earnedIncomeDeductionRate * 100}% of ${formatDollars(f.earnedMonthlyCents)} earned`,
    amountCents: -earnedDeduction,
    runningCents: running,
    citation: '7 CFR 273.9(d)(2)',
  });

  const standard = dollars(standardDeductionFor(t.standardDeductionBySize, f.householdSize));
  running -= standard;
  steps.push({
    label: 'Standard deduction',
    detail: `household of ${f.householdSize}`,
    amountCents: -standard,
    runningCents: running,
    citation: '7 CFR 273.9(d)(1)',
  });

  // Only households with an elderly or disabled member may take this deduction, and
  // only for the portion above the threshold.
  if (f.hasElderlyOrDisabledMember && f.medicalMonthlyCents > 0) {
    const threshold = dollars(t.excessMedicalThreshold);
    const excess = Math.max(0, f.medicalMonthlyCents - threshold);
    if (excess > 0) {
      running -= excess;
      steps.push({
        label: 'Excess medical deduction',
        detail: `${formatDollars(f.medicalMonthlyCents)} in medical costs above the ${formatDollars(
          threshold
        )} threshold`,
        amountCents: -excess,
        runningCents: running,
        citation: '7 CFR 273.9(d)(3)',
      });
    }
  }

  if (f.dependentCareMonthlyCents > 0) {
    running -= f.dependentCareMonthlyCents;
    steps.push({
      label: 'Dependent care deduction',
      detail: 'care needed to work, look for work or attend training',
      amountCents: -f.dependentCareMonthlyCents,
      runningCents: running,
      citation: '7 CFR 273.9(d)(4)',
    });
  }

  if (f.childSupportPaidMonthlyCents > 0) {
    running -= f.childSupportPaidMonthlyCents;
    steps.push({
      label: 'Child support deduction',
      detail: 'legally obligated child support paid',
      amountCents: -f.childSupportPaidMonthlyCents,
      runningCents: running,
      citation: '7 CFR 273.9(d)(5)',
    });
  }

  let shelterCapApplied = false;

  // A household taking the homeless shelter deduction cannot also claim shelter costs.
  if (f.allMembersHomeless && t.homelessShelterDeduction !== null) {
    const homeless = dollars(t.homelessShelterDeduction);
    running -= homeless;
    steps.push({
      label: 'Homeless shelter deduction',
      detail: 'all members homeless and not receiving free shelter for the month',
      amountCents: -homeless,
      runningCents: running,
      citation: '7 CFR 273.9(d)(6)(i)',
    });
  } else if (f.shelterMonthlyCents > 0) {
    // Shelter costs above half of what remains, capped unless a member is elderly or
    // disabled. This comes last because it depends on the running subtotal.
    const half = Math.round(running / 2);
    const excessShelter = Math.max(0, f.shelterMonthlyCents - half);
    let allowed = excessShelter;

    if (!f.hasElderlyOrDisabledMember && t.excessShelterCap !== null) {
      const cap = dollars(t.excessShelterCap);
      if (allowed > cap) {
        allowed = cap;
        shelterCapApplied = true;
      }
    }

    if (allowed > 0) {
      running -= allowed;
      steps.push({
        label: 'Excess shelter deduction',
        detail:
          `${formatDollars(f.shelterMonthlyCents)} shelter costs less half of the ` +
          `${formatDollars(half * 2)} remaining (${formatDollars(half)})` +
          (shelterCapApplied ? `, capped at ${formatDollars(dollars(t.excessShelterCap!))}` : '') +
          (f.hasElderlyOrDisabledMember ? ', uncapped for an elderly or disabled member' : ''),
        amountCents: -allowed,
        runningCents: running,
        citation: '7 CFR 273.9(d)(6)(ii)',
      });
    }
  }

  return { grossCents, netCents: Math.max(0, running), steps, shelterCapApplied };
}

export interface SnapResult {
  eligible: boolean;
  monthlyBenefitCents: Cents | null;
  annualValueCents: Cents | null;
  grossCents: Cents;
  netCents: Cents;
  steps: Step[];
  tests: { name: string; passed: boolean; detail: string }[];
  decidedBy: string;
  benefitUnavailableReason?: string;
}

export function snapEligibility(f: SnapFacts, t: SnapThresholds): SnapResult {
  // A partial set is missing figures that the arithmetic needs, and which ones are
  // missing varies by household size. Rather than fail part-way through for some
  // households and succeed for others, refuse the whole set and point at the fallback.
  if (t.status === 'partial') {
    throw new Error(
      `${t.label} is a partial threshold set and cannot decide eligibility. ` +
        'Call activeSnapSet(date) to get the set that should be used, and show its notice.'
    );
  }

  const income = snapNetIncome(f, t);
  const tests: SnapResult['tests'] = [];
  let decidedBy = 'net income test';

  // Categorically eligible households skip the income and resource tests entirely.
  if (f.categoricallyEligible) {
    tests.push({
      name: 'Categorical eligibility',
      passed: true,
      detail: 'every member receives SSI, TANF or General Assistance',
    });
    decidedBy = 'categorical eligibility';
  } else {
    const limit = f.hasElderlyOrDisabledMember
      ? t.resourceLimitElderlyDisabled
      : t.resourceLimit;
    if (limit !== null) {
      const passed = f.countableResourcesCents <= dollars(limit);
      tests.push({
        name: 'Resource test',
        passed,
        detail: `${formatDollars(f.countableResourcesCents)} in countable resources against a ${formatDollars(
          dollars(limit)
        )} limit${f.hasElderlyOrDisabledMember ? ' (elderly or disabled member)' : ''}`,
      });
      if (!passed) decidedBy = 'resource test';
    }

    // A household with an elderly or disabled member is tested on net income only.
    if (!f.hasElderlyOrDisabledMember) {
      const grossLimit = dollars(bySize(t.grossLimitBySize, f.householdSize));
      const passed = income.grossCents <= grossLimit;
      tests.push({
        name: 'Gross income test',
        passed,
        detail: `${formatDollars(income.grossCents)} against a ${formatDollars(grossLimit)} limit (130% of poverty)`,
      });
      if (!passed) decidedBy = 'gross income test';
    } else {
      tests.push({
        name: 'Gross income test',
        passed: true,
        detail: 'not applied: the household has a member aged 60 or older, or with a disability',
      });
    }

    const netLimit = dollars(bySize(t.netLimitBySize, f.householdSize));
    const passed = income.netCents <= netLimit;
    tests.push({
      name: 'Net income test',
      passed,
      detail: `${formatDollars(income.netCents)} against a ${formatDollars(netLimit)} limit (100% of poverty)`,
    });
  }

  const eligible = tests.every((t) => t.passed);
  if (eligible) decidedBy = f.categoricallyEligible ? 'categorical eligibility' : 'net income test';

  if (!eligible) {
    return {
      eligible: false,
      monthlyBenefitCents: null,
      annualValueCents: null,
      grossCents: income.grossCents,
      netCents: income.netCents,
      steps: income.steps,
      tests,
      decidedBy,
    };
  }

  if (t.maxAllotmentBySize === null || t.minimumAllotment === null) {
    return {
      eligible: true,
      monthlyBenefitCents: null,
      annualValueCents: null,
      grossCents: income.grossCents,
      netCents: income.netCents,
      steps: income.steps,
      tests,
      decidedBy,
      benefitUnavailableReason:
        t.statusNote ?? 'The allotment table for this period has not been published.',
    };
  }

  const maxAllotment = dollars(bySize(t.maxAllotmentBySize, f.householdSize));
  const contribution = ceilToDollar(percentOf(income.netCents, t.benefitContributionRate));
  let benefit = maxAllotment - contribution;

  // The minimum benefit applies to one- and two-person households only.
  if (f.householdSize <= 2) {
    benefit = Math.max(benefit, dollars(t.minimumAllotment));
  } else {
    benefit = Math.max(0, benefit);
  }

  return {
    eligible: benefit > 0,
    monthlyBenefitCents: benefit,
    annualValueCents: benefit * 12,
    grossCents: income.grossCents,
    netCents: income.netCents,
    steps: income.steps,
    tests,
    decidedBy,
  };
}

// ---------------------------------------------------------------------------
// EITC
// ---------------------------------------------------------------------------

export type FilingStatus = 'joint' | 'other';

export interface EitcFacts {
  earnedAnnualCents: Cents;
  agiAnnualCents: Cents;
  qualifyingChildren: number;
  filingStatus: FilingStatus;
  investmentIncomeAnnualCents: Cents;
  /** Age of the claimant, needed only when there are no qualifying children. */
  claimantAge: number | null;
  /**
   * Married, not filing jointly, and not meeting the separated-spouse rules of
   * IRC 32(d). Such a claimant is barred; one who does meet them is not.
   */
  marriedFilingSeparatelyIneligible: boolean;
}

export interface EitcResult {
  eligible: boolean;
  annualValueCents: Cents | null;
  steps: Step[];
  tests: { name: string; passed: boolean; detail: string }[];
  decidedBy: string;
}

/**
 * The phase-out rate implied by the published table, rather than the statutory rate.
 *
 * IRC 32(b) fixes the phase-out rates (15.98% for one child, 21.06% for two or more,
 * and so on) and the revenue procedures publish, for each bracket and filing status,
 * both the income at which the phase-out starts and the income at which the credit
 * reaches zero. Those three numbers are very nearly but not exactly consistent: at
 * the published completed phase-out for two children filing jointly in tax year 2025,
 * the statutory 21.06% leaves two cents of credit standing.
 *
 * Using the rate the published endpoints imply makes the credit reach exactly zero at
 * exactly the published point. `eitc-consistency.test.ts` checks that the implied rate
 * never departs from the statutory one by more than a hundredth of a percentage point,
 * so a genuine error in the table would still be caught.
 */
export function eitcPhaseOutRate(bracket: EitcBracket, status: FilingStatus): number {
  const span = bracket.completedPhaseout[status] - bracket.thresholdPhaseout[status];
  if (span <= 0) return bracket.phaseOutRate;
  return bracket.maxCredit / span;
}

export function eitcCredit(f: EitcFacts, t: EitcThresholds): EitcResult {
  const tests: EitcResult['tests'] = [];
  const steps: Step[] = [];
  const children = Math.min(Math.max(f.qualifyingChildren, 0), 3);
  const bracket = t.byChildren[String(children)];

  // Investment income is a cliff, not a phase-out: one dollar over forfeits it all.
  const investmentLimit = dollars(t.investmentIncomeLimit);
  const investmentOk = f.investmentIncomeAnnualCents <= investmentLimit;
  tests.push({
    name: 'Investment income limit',
    passed: investmentOk,
    detail: `${formatDollars(f.investmentIncomeAnnualCents)} against a ${formatDollars(
      investmentLimit
    )} limit; over the limit forfeits the whole credit`,
  });

  const filingOk = !f.marriedFilingSeparatelyIneligible;
  tests.push({
    name: 'Filing status',
    passed: filingOk,
    detail: filingOk
      ? 'filing status permits the credit'
      : 'married filing separately without meeting the separated-spouse rules of IRC 32(d)',
  });

  let ageOk = true;
  if (children === 0) {
    ageOk =
      f.claimantAge !== null &&
      f.claimantAge >= t.childlessMinAge &&
      f.claimantAge < t.childlessMaxAgeExclusive;
    tests.push({
      name: 'Age requirement',
      passed: ageOk,
      detail:
        f.claimantAge === null
          ? 'age not established, and a claimant with no qualifying children must be at least 25 and under 65'
          : `age ${f.claimantAge} against the requirement to be at least ${t.childlessMinAge} and under ${t.childlessMaxAgeExclusive}`,
    });
  }

  const gates = investmentOk && filingOk && ageOk;
  const decidedBy = !investmentOk
    ? 'investment income limit'
    : !filingOk
      ? 'filing status'
      : !ageOk
        ? 'age requirement'
        : 'income phase-out';

  if (!gates) {
    return { eligible: false, annualValueCents: null, steps, tests, decidedBy };
  }

  const phaseIn = Math.min(
    percentOf(f.earnedAnnualCents, bracket.phaseInRate),
    dollars(bracket.maxCredit)
  );
  const phaseOutRate = eitcPhaseOutRate(bracket, f.filingStatus);
  steps.push({
    label: 'Phase-in',
    detail: `${(bracket.phaseInRate * 100).toFixed(2)}% of ${formatDollars(
      f.earnedAnnualCents
    )} earned, capped at the ${formatDollars(dollars(bracket.maxCredit))} maximum for ${children === 3 ? '3 or more' : children} qualifying ${children === 1 ? 'child' : 'children'}`,
    amountCents: phaseIn,
    runningCents: phaseIn,
    citation: 'IRC 32(b)',
  });

  // The phase-out runs on whichever is greater, earned income or AGI.
  const measure = Math.max(f.earnedAnnualCents, f.agiAnnualCents);
  const threshold = dollars(bracket.thresholdPhaseout[f.filingStatus]);
  const over = Math.max(0, measure - threshold);
  const reduction = percentOf(over, phaseOutRate);

  if (over > 0) {
    steps.push({
      label: 'Phase-out',
      detail: `${(bracket.phaseOutRate * 100).toFixed(2)}% of the ${formatDollars(
        over
      )} by which ${formatDollars(measure)} exceeds the ${formatDollars(threshold)} threshold`,
      amountCents: -reduction,
      runningCents: Math.max(0, phaseIn - reduction),
      citation: 'IRC 32(a)(2)',
    });
  }

  const credit = Math.max(0, phaseIn - reduction);
  const completed = dollars(bracket.completedPhaseout[f.filingStatus]);

  tests.push({
    name: 'Income limit',
    passed: credit > 0,
    detail: `${formatDollars(measure)} against the ${formatDollars(
      completed
    )} point at which the credit reaches zero`,
  });

  return {
    eligible: credit > 0,
    annualValueCents: credit > 0 ? credit : null,
    steps,
    tests,
    decidedBy,
  };
}

// ---------------------------------------------------------------------------
// Lifeline
// ---------------------------------------------------------------------------

export interface LifelineFacts {
  householdSize: number;
  annualIncomeCents: Cents;
  /** Qualifying programs any member receives, by the ids used in the threshold set. */
  programsReceived: string[];
  onTribalLands: boolean;
}

export interface LifelineResult {
  eligible: boolean;
  annualValueCents: Cents | null;
  monthlyBenefitCents: Cents | null;
  tests: { name: string; passed: boolean; detail: string }[];
  decidedBy: string;
}

export function lifelineEligibility(
  f: LifelineFacts,
  t: LifelineThresholds
): LifelineResult {
  const qualifying = new Set([...t.qualifyingPrograms, ...(f.onTribalLands ? t.qualifyingProgramsTribal : [])]);
  const matched = f.programsReceived.filter((p) => qualifying.has(p));

  const limit = dollars(bySize(t.annualIncomeLimitBySize, f.householdSize));
  const incomeOk = f.annualIncomeCents <= limit;

  const tests: LifelineResult['tests'] = [
    {
      name: 'Program participation',
      passed: matched.length > 0,
      detail:
        matched.length > 0
          ? `qualifies through ${matched.join(', ')}`
          : 'no qualifying program participation established',
    },
    {
      name: 'Income test',
      passed: incomeOk,
      detail: `${formatDollars(f.annualIncomeCents)} against a ${formatDollars(
        limit
      )} limit (${t.fpgMultiple * 100}% of poverty for a household of ${f.householdSize})`,
    },
  ];

  // Either route qualifies; they are alternatives, not both required.
  const eligible = matched.length > 0 || incomeOk;
  const monthly = f.onTribalLands ? t.monthlyBenefitTribal : t.monthlyBenefit;

  return {
    eligible,
    monthlyBenefitCents: eligible ? dollars(monthly) : null,
    annualValueCents: eligible ? dollars(monthly) * 12 : null,
    tests,
    decidedBy: matched.length > 0 ? 'program participation' : 'income test',
  };
}
