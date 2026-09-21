/**
 * Arithmetic for the programs added beyond the original three.
 *
 * Most federal benefit programs set their income test as a multiple of the HHS poverty
 * guidelines and then add demographic or categorical conditions on top. That shape is
 * general enough to drive from data, so `fpgThreshold` handles WIC, school meals, CSFP,
 * LIHEAP and Head Start from one implementation and one guideline table. Adding another
 * program of that shape is a data change, not a code change.
 *
 * The two Medicare programs and the Child Tax Credit have their own shapes and their
 * own functions.
 *
 * Where a program's value cannot be stated as a dollar figure — a box of food, a place
 * in a pre-school, a payment whose size the state decides — this returns eligibility
 * with a null value and the reason. Inventing an average would make the total on screen
 * look more precise than it is.
 */

import { Cents, dollars, formatDollars } from './money';
import { Step } from './compute';

export interface FpgProgramConfig {
  fpgMultiple: number;
  basis: 'annual' | 'monthly';
  citation: string;
  source: string;
  adjunctivePrograms: string[];
  monthlyValue: number | null;
  valueNote: string;
}

export interface FpgTable {
  annualBySize: Record<string, number>;
  annualIncrement: number;
  source: string;
}

/** The annual poverty guideline for a household size, extended past the listed rows. */
export function fpgAnnual(table: FpgTable, size: number): number {
  const direct = table.annualBySize[String(size)];
  if (typeof direct === 'number') return direct;
  const listed = Object.keys(table.annualBySize).map(Number).sort((a, b) => a - b);
  const largest = listed[listed.length - 1];
  return table.annualBySize[String(largest)] + table.annualIncrement * (size - largest);
}

export interface ProgramResult {
  eligible: boolean;
  annualValueCents: Cents | null;
  monthlyValueCents: Cents | null;
  tests: { name: string; passed: boolean; detail: string }[];
  steps: Step[];
  decidedBy: string;
  valueNote?: string;
}

export interface FpgFacts {
  householdSize: number;
  annualIncomeCents: Cents;
  /** Qualifying programs the household already receives, by id. */
  programsReceived: string[];
  /** Whether the demographic condition for this program is met at all. */
  categoryMet: boolean;
  categoryDetail: string;
}

export function fpgThresholdEligibility(
  f: FpgFacts,
  config: FpgProgramConfig,
  table: FpgTable
): ProgramResult {
  const guideline = fpgAnnual(table, f.householdSize);
  const limitCents = dollars(Math.round(guideline * config.fpgMultiple));
  const tests: ProgramResult['tests'] = [];

  tests.push({
    name: 'Who it is for',
    passed: f.categoryMet,
    detail: f.categoryDetail,
  });

  // Receiving one of the named programs establishes income eligibility on its own.
  const adjunctive = f.programsReceived.filter((p) => config.adjunctivePrograms.includes(p));
  const incomeOk = f.annualIncomeCents <= limitCents;
  const viaAdjunctive = adjunctive.length > 0;

  if (config.adjunctivePrograms.length > 0) {
    tests.push({
      name: 'Automatic income eligibility',
      passed: viaAdjunctive,
      detail: viaAdjunctive
        ? `receiving ${adjunctive.join(', ')} meets the income test on its own`
        : `not receiving ${config.adjunctivePrograms.join(', ')}, so the income test applies`,
    });
  }

  tests.push({
    name: 'Income test',
    passed: incomeOk || viaAdjunctive,
    detail: `${formatDollars(f.annualIncomeCents)} a year against a ${formatDollars(limitCents)} limit (${Math.round(
      config.fpgMultiple * 100
    )}% of the poverty guideline for a household of ${f.householdSize})`,
  });

  const eligible = f.categoryMet && (incomeOk || viaAdjunctive);
  const monthlyValueCents = config.monthlyValue === null ? null : dollars(config.monthlyValue);

  return {
    eligible,
    annualValueCents: eligible && monthlyValueCents !== null ? monthlyValueCents * 12 : null,
    monthlyValueCents: eligible ? monthlyValueCents : null,
    tests,
    steps: [],
    decidedBy: !f.categoryMet
      ? 'who the program is for'
      : viaAdjunctive
        ? 'a benefit the household already receives'
        : 'the income test',
    valueNote: eligible && config.monthlyValue === null ? config.valueNote : undefined,
  };
}

// ---------------------------------------------------------------------------
// Medicare cost-help
// ---------------------------------------------------------------------------

export interface MedicareThresholds {
  partBMonthlyPremium: number;
  savingsPrograms: {
    id: string;
    name: string;
    covers: string;
    monthlyIncomeLimit: { single: number; married: number };
    resourceLimit: { single: number; married: number };
    coversPartBPremium: boolean;
  }[];
  extraHelp: {
    annualIncomeLimit: { single: number; married: number };
    resourceLimit: { single: number; married: number };
    benefit: string;
    note: string;
  };
}

export interface MedicareFacts {
  onMedicare: boolean;
  married: boolean;
  monthlyIncomeCents: Cents;
  resourcesCents: Cents;
}

/**
 * The three Medicare Savings Programs, taken as one result at the best tier the
 * household reaches. They are alternatives rather than additions, so reporting them
 * separately would count the same Part B premium three times.
 */
export function medicareSavingsEligibility(
  f: MedicareFacts,
  t: MedicareThresholds
): ProgramResult & { tier?: string } {
  const key = f.married ? 'married' : 'single';
  const tests: ProgramResult['tests'] = [
    {
      name: 'On Medicare',
      passed: f.onMedicare,
      detail: f.onMedicare ? 'enrolled in Medicare' : 'these programs help with Medicare costs only',
    },
  ];

  if (!f.onMedicare) {
    return { eligible: false, annualValueCents: null, monthlyValueCents: null, tests, steps: [], decidedBy: 'Medicare enrolment' };
  }

  // Ordered most generous first, so the household is placed at the best tier it meets.
  for (const tier of t.savingsPrograms) {
    const incomeLimit = dollars(tier.monthlyIncomeLimit[key]);
    const resourceLimit = dollars(tier.resourceLimit[key]);
    const incomeOk = f.monthlyIncomeCents <= incomeLimit;
    const resourceOk = f.resourcesCents <= resourceLimit;

    if (incomeOk && resourceOk) {
      const monthly = dollars(t.partBMonthlyPremium);
      return {
        eligible: true,
        annualValueCents: monthly * 12,
        monthlyValueCents: monthly,
        tier: tier.id,
        decidedBy: `the ${tier.name} income and resource limits`,
        steps: [
          {
            label: 'Part B premium covered',
            detail: `${tier.name} covers ${tier.covers}`,
            amountCents: monthly,
            runningCents: monthly,
            citation: 'medicare.gov, 2026 figures',
          },
        ],
        tests: [
          ...tests,
          {
            name: `${tier.name} income limit`,
            passed: true,
            detail: `${formatDollars(f.monthlyIncomeCents)} a month against a ${formatDollars(incomeLimit)} limit`,
          },
          {
            name: 'Resource limit',
            passed: true,
            detail: `${formatDollars(f.resourcesCents)} against a ${formatDollars(resourceLimit)} limit`,
          },
        ],
      };
    }
  }

  const widest = t.savingsPrograms[t.savingsPrograms.length - 1];
  return {
    eligible: false,
    annualValueCents: null,
    monthlyValueCents: null,
    decidedBy: 'the income and resource limits',
    steps: [],
    tests: [
      ...tests,
      {
        name: 'Income limit',
        passed: f.monthlyIncomeCents <= dollars(widest.monthlyIncomeLimit[key]),
        detail: `${formatDollars(f.monthlyIncomeCents)} a month against a ${formatDollars(
          dollars(widest.monthlyIncomeLimit[key])
        )} limit at the widest of the three programs`,
      },
      {
        name: 'Resource limit',
        passed: f.resourcesCents <= dollars(widest.resourceLimit[key]),
        detail: `${formatDollars(f.resourcesCents)} against a ${formatDollars(
          dollars(widest.resourceLimit[key])
        )} limit`,
      },
    ],
  };
}

export function extraHelpEligibility(f: MedicareFacts, t: MedicareThresholds): ProgramResult {
  const key = f.married ? 'married' : 'single';
  const incomeLimit = dollars(t.extraHelp.annualIncomeLimit[key]);
  const resourceLimit = dollars(t.extraHelp.resourceLimit[key]);
  const annualIncome = f.monthlyIncomeCents * 12;

  const tests: ProgramResult['tests'] = [
    {
      name: 'On Medicare',
      passed: f.onMedicare,
      detail: f.onMedicare ? 'enrolled in Medicare' : 'Extra Help applies to Medicare drug coverage only',
    },
    {
      name: 'Income limit',
      passed: annualIncome <= incomeLimit,
      detail: `${formatDollars(annualIncome)} a year against a ${formatDollars(incomeLimit)} limit`,
    },
    {
      name: 'Resource limit',
      passed: f.resourcesCents <= resourceLimit,
      detail: `${formatDollars(f.resourcesCents)} against a ${formatDollars(resourceLimit)} limit`,
    },
  ];

  const eligible = tests.every((t) => t.passed);
  return {
    eligible,
    // The saving depends on which drugs a person takes, so no figure is invented.
    annualValueCents: null,
    monthlyValueCents: null,
    tests,
    steps: [],
    decidedBy: !f.onMedicare ? 'Medicare enrolment' : 'the income and resource limits',
    valueNote: eligible ? t.extraHelp.benefit : undefined,
  };
}

// ---------------------------------------------------------------------------
// Child Tax Credit
// ---------------------------------------------------------------------------

export interface CtcThresholds {
  maxCreditPerChild: number;
  refundablePerChild: number;
  childMaxAgeExclusive: number;
  phaseOutThreshold: { joint: number; other: number };
  phaseOutPerThousand: number;
  phaseOutStep: number;
}

export interface CtcFacts {
  qualifyingChildren: number;
  agiAnnualCents: Cents;
  filingStatus: 'joint' | 'other';
}

export function childTaxCredit(f: CtcFacts, t: CtcThresholds): ProgramResult {
  const steps: Step[] = [];
  const tests: ProgramResult['tests'] = [];

  const children = Math.max(0, f.qualifyingChildren);
  tests.push({
    name: 'Qualifying children',
    passed: children > 0,
    detail:
      children > 0
        ? `${children} ${children === 1 ? 'child' : 'children'} under ${t.childMaxAgeExclusive}`
        : `no children under ${t.childMaxAgeExclusive}`,
  });

  if (children === 0) {
    return { eligible: false, annualValueCents: null, monthlyValueCents: null, tests, steps, decidedBy: 'the qualifying child test' };
  }

  const full = dollars(t.maxCreditPerChild * children);
  steps.push({
    label: 'Credit before phase-out',
    detail: `${formatDollars(dollars(t.maxCreditPerChild))} for each of ${children} ${children === 1 ? 'child' : 'children'}`,
    amountCents: full,
    runningCents: full,
    citation: 'IRC 24(h)(2)',
  });

  // $50 less for every $1,000 of income above the threshold, per IRC 24(b).
  const threshold = dollars(t.phaseOutThreshold[f.filingStatus]);
  const over = Math.max(0, f.agiAnnualCents - threshold);
  const steps1000 = Math.ceil(over / dollars(t.phaseOutStep));
  const reduction = dollars(t.phaseOutPerThousand) * steps1000;

  if (over > 0) {
    steps.push({
      label: 'Phase-out',
      detail: `${formatDollars(dollars(t.phaseOutPerThousand))} for each ${formatDollars(
        dollars(t.phaseOutStep)
      )} of income above the ${formatDollars(threshold)} threshold`,
      amountCents: -reduction,
      runningCents: Math.max(0, full - reduction),
      citation: 'IRC 24(b)',
    });
  }

  const credit = Math.max(0, full - reduction);
  tests.push({
    name: 'Income limit',
    passed: credit > 0,
    detail: `${formatDollars(f.agiAnnualCents)} against a ${formatDollars(threshold)} phase-out threshold`,
  });

  return {
    eligible: credit > 0,
    annualValueCents: credit > 0 ? credit : null,
    monthlyValueCents: credit > 0 ? Math.round(credit / 12) : null,
    tests,
    steps,
    decidedBy: credit > 0 ? 'the qualifying child test' : 'the income phase-out',
    valueNote:
      credit > 0
        ? `Up to ${formatDollars(dollars(t.refundablePerChild))} per child is refundable, so part of this can arrive even with no tax owing.`
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Veterans Pension
// ---------------------------------------------------------------------------

export interface VaPensionThresholds {
  netWorthLimit: number;
  additionalDependent: number;
  medicalExpenseThresholdRate: number;
  mapr: Record<string, { basic: number; housebound: number; aidAndAttendance: number }>;
}

export type VaCareLevel = 'neither' | 'housebound' | 'aid_and_attendance';

export interface VaPensionFacts {
  dependents: number;
  annualIncomeCents: Cents;
  netWorthCents: Cents;
  annualMedicalCents: Cents;
  careLevel: VaCareLevel;
}

/**
 * The pension is the gap between a rate Congress sets and what the household already
 * has, so a lower income produces a larger payment. That is the opposite shape to
 * every other program here, where income only ever takes benefit away.
 */
export function veteransPension(f: VaPensionFacts, t: VaPensionThresholds): ProgramResult {
  const base = t.mapr[f.dependents >= 1 ? '1' : '0'];
  const extra = f.dependents > 1 ? t.additionalDependent * (f.dependents - 1) : 0;
  const rate =
    f.careLevel === 'aid_and_attendance'
      ? base.aidAndAttendance
      : f.careLevel === 'housebound'
        ? base.housebound
        : base.basic;
  const mapr = dollars(rate + extra);

  const steps: Step[] = [
    {
      label: 'Maximum annual pension rate',
      detail:
        `${f.dependents} ${f.dependents === 1 ? 'dependent' : 'dependents'}` +
        (f.careLevel === 'aid_and_attendance'
          ? ', with aid and attendance'
          : f.careLevel === 'housebound'
            ? ', housebound'
            : ''),
      amountCents: mapr,
      runningCents: mapr,
      citation: 'va.gov, rates effective 1 December 2025',
    },
  ];

  // Medical expenses above 5% of the rate come off countable income.
  const threshold = Math.round(mapr * t.medicalExpenseThresholdRate);
  const deductible = Math.max(0, f.annualMedicalCents - threshold);
  const countable = Math.max(0, f.annualIncomeCents - deductible);

  if (deductible > 0) {
    steps.push({
      label: 'Medical expenses deducted from income',
      detail: `the part of ${formatDollars(f.annualMedicalCents)} above ${formatDollars(threshold)}, which is 5% of the rate`,
      amountCents: -deductible,
      runningCents: countable,
      citation: '38 CFR 3.272(g)',
    });
  }

  const pension = Math.max(0, mapr - countable);
  steps.push({
    label: 'Pension payable',
    detail: `${formatDollars(mapr)} less ${formatDollars(countable)} of countable income`,
    amountCents: pension,
    runningCents: pension,
  });

  const netWorthLimit = dollars(t.netWorthLimit);
  const netWorthOk = f.netWorthCents + f.annualIncomeCents <= netWorthLimit;

  const tests: ProgramResult['tests'] = [
    {
      name: 'Net worth test',
      passed: netWorthOk,
      detail: `${formatDollars(f.netWorthCents + f.annualIncomeCents)} in assets and income against a ${formatDollars(netWorthLimit)} limit`,
    },
    {
      name: 'Income test',
      passed: pension > 0,
      detail: `${formatDollars(countable)} of countable income against a ${formatDollars(mapr)} rate`,
    },
  ];

  const eligible = netWorthOk && pension > 0;
  return {
    eligible,
    annualValueCents: eligible ? pension : null,
    monthlyValueCents: eligible ? Math.round(pension / 12) : null,
    tests,
    steps,
    decidedBy: !netWorthOk ? 'the net worth limit' : 'the difference between the rate and your income',
  };
}

// ---------------------------------------------------------------------------
// Child and Dependent Care Credit
// ---------------------------------------------------------------------------

export interface CdctcThresholds {
  expenseCapOne: number;
  expenseCapTwoOrMore: number;
  maxRate: number;
  minRate: number;
  rateFloorAgi: number;
  rateStepAgi: number;
  rateStep: number;
  minRateAgi: number;
}

export interface CdctcFacts {
  annualCareExpensesCents: Cents;
  qualifyingPeople: number;
  agiAnnualCents: Cents;
}

/**
 * How many children count for the dependent care credit.
 *
 * A qualifying child must be under 13 when the care is provided (IRC 21(b)(1)(A)).
 * Only the ages actually stated are compared, in code: a child whose age was not given
 * still counts, because the description is silent rather than disqualifying, and the
 * loop can ask. Ages under 18 are taken to be the children's; the parser does not say
 * whose age is whose.
 */
export function cdctcQualifyingChildren(childCount: number, agesMentioned: number[]): number {
  const childAges = agesMentioned.filter((a) => a < 18).sort((a, b) => a - b).slice(0, childCount);
  const unknown = Math.max(0, childCount - childAges.length);
  return childAges.filter((a) => a < 13).length + unknown;
}

/**
 * The Veterans Pension's age-or-disability gate (va.gov/pension/eligibility): the
 * veteran is at least 65, or permanently and totally disabled, in long-term nursing
 * home care because of a disability, or receiving SSDI or SSI. Age is compared here;
 * the rest arrives as one yes or no.
 */
export function vaPensionAgeOrDisability(age: number | null, disabledOrOnBenefits: boolean): boolean {
  return (age !== null && age >= 65) || disabledOrOnBenefits;
}

export function dependentCareCredit(f: CdctcFacts, t: CdctcThresholds): ProgramResult {
  const cap = dollars(f.qualifyingPeople >= 2 ? t.expenseCapTwoOrMore : t.expenseCapOne);
  const expenses = Math.min(f.annualCareExpensesCents, cap);

  // 35% up to the floor, falling a point per step of income, never below 20%.
  const over = Math.max(0, f.agiAnnualCents - dollars(t.rateFloorAgi));
  const steps1 = Math.ceil(over / dollars(t.rateStepAgi));
  const rate = Math.max(t.minRate, t.maxRate - steps1 * t.rateStep);
  // No qualifying person, no credit, whatever was spent on care.
  const credit = f.qualifyingPeople > 0 ? Math.round(expenses * rate) : 0;

  const steps: Step[] = [
    {
      label: 'Care expenses that count',
      detail: `${formatDollars(f.annualCareExpensesCents)} paid, capped at ${formatDollars(cap)} for ${
        f.qualifyingPeople >= 2 ? 'two or more people' : 'one person'
      }`,
      amountCents: expenses,
      runningCents: expenses,
      citation: 'IRC 21(c)',
    },
    {
      label: 'Credit rate',
      detail: `${Math.round(rate * 100)}% at an income of ${formatDollars(f.agiAnnualCents)}`,
      amountCents: credit,
      runningCents: credit,
      citation: 'IRC 21(a)(2)',
    },
  ];

  return {
    eligible: credit > 0,
    annualValueCents: credit > 0 ? credit : null,
    monthlyValueCents: credit > 0 ? Math.round(credit / 12) : null,
    steps,
    tests: [
      {
        name: 'A child under 13',
        passed: f.qualifyingPeople > 0,
        detail:
          f.qualifyingPeople > 0
            ? `${f.qualifyingPeople} ${f.qualifyingPeople === 1 ? 'child' : 'children'} under 13`
            : 'no child under 13, so care costs do not count',
      },
      {
        name: 'Care paid for work',
        passed: f.annualCareExpensesCents > 0,
        detail:
          f.annualCareExpensesCents > 0
            ? `${formatDollars(f.annualCareExpensesCents)} a year in care costs`
            : 'no care costs were mentioned',
      },
    ],
    decidedBy: 'the care costs and the rate for this income',
    valueNote:
      credit > 0
        ? 'This credit reduces tax owed rather than arriving as a refund, so a household with no tax liability may not receive all of it.'
        : undefined,
  };
}
