/**
 * Generate the gold set.
 *
 * Every household here is synthetic. Nothing is drawn from a real person, and no
 * household text entered by anyone using the screener is ever stored or used.
 *
 * The ground truth is computed from the rules, not from the system being measured.
 * Each record starts as a set of structured facts; the paragraph is written from those
 * facts, and the verdicts come from calling the arithmetic on the facts directly. The
 * loop never touches this file. That is what makes the accuracy figure mean something:
 * the system is being checked against the federal rules, not against itself.
 *
 * Each record keeps its derivation, so any single verdict can be checked by hand in a
 * few seconds without re-running anything.
 *
 * Usage:  npx tsx scripts/generate-gold.ts
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { dollars, formatDollars, toDollars } from '@/lib/money';
import {
  EitcFacts,
  FilingStatus,
  LifelineFacts,
  SnapFacts,
  eitcCredit,
  lifelineEligibility,
  snapEligibility,
} from '@/lib/compute';
import {
  activeSnapSet,
  eitcThresholdsFor,
  lifelineThresholdsFor,
} from '@/lib/thresholds';
import { Period } from '@/lib/parse';
import {
  childTaxCredit,
  extraHelpEligibility,
  fpgAnnual,
  fpgThresholdEligibility,
  medicareSavingsEligibility,
  dependentCareCredit,
  veteransPension,
} from '@/lib/compute-programs';
import {
  cdctcThresholdsFor,
  ctcThresholdsFor,
  fpgProgramConfig,
  medicareThresholdsFor,
  povertyGuidelines,
  stateRulesFor,
  vaPensionThresholdsFor,
} from '@/lib/thresholds';

const AS_OF = '2026-09-21';

export type Slice =
  | 'clear_eligible'
  | 'clear_ineligible'
  | 'mixed'
  | 'underspecified'
  | 'adversarial';

export interface GoldFacts {
  householdSize: number;
  earnedMonthly: number;
  unearnedMonthly: number;
  rentMonthly: number;
  utilitiesMonthly: number;
  dependentCareMonthly: number;
  childSupportMonthly: number;
  medicalMonthly: number;
  savings: number;
  hasElderlyOrDisabled: boolean;
  allMembersHomeless: boolean;
  categorical: 'ssi' | 'tanf' | 'ga' | 'none';
  children: number;
  qualifyingChildren: number;
  filingStatus: FilingStatus;
  claimantAge: number;
  childAges: number[];
  wartimeVeteran: boolean;
  investmentIncome: number;
  lifelinePrograms: string[];
  onTribalLands: boolean;
  statedPeriod: Period;
  state: string;
}

export interface GoldHousehold {
  id: string;
  slice: Slice;
  /**
   * Which half of the set this household is in. End-to-end accuracy is reported on the
   * held-out half only, and nothing may be tuned while looking at it.
   */
  split: 'dev' | 'holdout';
  paragraph: string;
  facts: GoldFacts;
  truth: Record<string, 'eligible' | 'ineligible'>;
  values: Record<string, number>;
  derivation: Record<string, string[]>;
  loadBearingGap?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// A seeded generator, so the set is reproducible
// ---------------------------------------------------------------------------

let seed = 20260921;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}
function between(lo: number, hi: number, step = 1): number {
  return lo + Math.round((rand() * (hi - lo)) / step) * step;
}

const STATES = ['Ohio', 'Georgia', 'Arizona', 'Michigan', 'Missouri', 'Tennessee', 'Indiana', 'Kentucky', 'Alabama', 'Oklahoma'];

// ---------------------------------------------------------------------------
// Ground truth from the rules
// ---------------------------------------------------------------------------

function monthlyFromPeriod(monthly: number, period: Period): number {
  switch (period) {
    case 'weekly':
      return (monthly * 12) / 52;
    case 'biweekly':
      return (monthly * 12) / 26;
    case 'annual':
      return monthly * 12;
    default:
      return monthly;
  }
}

function truthFor(f: GoldFacts): {
  truth: GoldHousehold['truth'];
  values: GoldHousehold['values'];
  derivation: GoldHousehold['derivation'];
} {
  const snapSet = activeSnapSet(AS_OF).set;
  const eitcSet = eitcThresholdsFor(AS_OF);
  const lifelineSet = lifelineThresholdsFor(AS_OF);

  const snapFacts: SnapFacts = {
    householdSize: f.householdSize,
    earnedMonthlyCents: dollars(f.earnedMonthly),
    unearnedMonthlyCents: dollars(f.unearnedMonthly),
    medicalMonthlyCents: dollars(f.medicalMonthly),
    dependentCareMonthlyCents: dollars(f.dependentCareMonthly),
    childSupportPaidMonthlyCents: dollars(f.childSupportMonthly),
    shelterMonthlyCents: dollars(f.rentMonthly + f.utilitiesMonthly),
    hasElderlyOrDisabledMember: f.hasElderlyOrDisabled,
    allMembersHomeless: f.allMembersHomeless,
    countableResourcesCents: dollars(f.savings),
    categoricallyEligible: f.categorical !== 'none',
  };
  const st = stateRulesFor(f.state, AS_OF);
  const snap = snapEligibility(
    snapFacts,
    snapSet,
    st
      ? {
          name: f.state,
          grossLimitPct: st.snap.grossLimitPct,
          assetLimit: st.snap.assetLimit,
          assetTestApplies: st.snap.assetTestApplies,
          usesFederalRules: st.snap.usesFederalRules,
          annualGuideline: fpgAnnual(povertyGuidelines(), f.householdSize),
        }
      : undefined
  );

  const eitcFacts: EitcFacts = {
    earnedAnnualCents: dollars(f.earnedMonthly * 12),
    agiAnnualCents: dollars((f.earnedMonthly + f.unearnedMonthly) * 12),
    qualifyingChildren: f.qualifyingChildren,
    filingStatus: f.filingStatus,
    investmentIncomeAnnualCents: dollars(f.investmentIncome),
    claimantAge: f.claimantAge,
    marriedFilingSeparatelyIneligible: false,
  };
  const eitc = eitcCredit(eitcFacts, eitcSet);

  const lifelineFacts: LifelineFacts = {
    householdSize: f.householdSize,
    annualIncomeCents: dollars((f.earnedMonthly + f.unearnedMonthly) * 12),
    programsReceived: [
      ...f.lifelinePrograms,
      ...(snap.eligible ? ['snap'] : []),
      ...(f.categorical === 'ssi' ? ['ssi'] : []),
    ],
    onTribalLands: f.onTribalLands,
  };
  const lifeline = lifelineEligibility(lifelineFacts, lifelineSet);

  // --- the programs added beyond the original three ---------------------
  const annualIncome = dollars((f.earnedMonthly + f.unearnedMonthly) * 12);
  const fpgTable = povertyGuidelines();
  const received = [
    ...f.lifelinePrograms,
    ...(snap.eligible ? ['snap'] : []),
    ...(f.categorical !== 'none' ? [f.categorical] : []),
  ];

  const youngest = f.childAges.length > 0 ? Math.min(...f.childAges) : null;
  const onMedicare = f.claimantAge >= 65;

  const fpgResult = (id: string, categoryMet: boolean, detail: string) =>
    fpgThresholdEligibility(
      {
        householdSize: f.householdSize,
        annualIncomeCents: annualIncome,
        programsReceived: received,
        categoryMet,
        categoryDetail: detail,
      },
      fpgProgramConfig(id, AS_OF),
      fpgTable
    );

  const wic = fpgResult('wic', youngest !== null && youngest < 5, 'a child under five');
  const schoolMeals = fpgResult(
    'school_meals',
    f.childAges.some((a) => a >= 5 && a <= 18),
    'a school-age child'
  );
  const csfp = fpgResult('csfp', f.claimantAge >= 60, 'someone aged 60 or over');
  const liheap = fpgResult('liheap', f.rentMonthly > 0 || f.utilitiesMonthly > 0, 'pays for home energy');
  const headStart = fpgResult('head_start', youngest !== null && youngest < 5, 'a child under five');

  const medicareSet = medicareThresholdsFor(AS_OF);
  const medicareFacts = {
    onMedicare,
    married: f.filingStatus === 'joint' || f.householdSize >= 2,
    monthlyIncomeCents: dollars(f.earnedMonthly + f.unearnedMonthly),
    resourcesCents: dollars(f.savings),
  };
  const msp = medicareSavingsEligibility(medicareFacts, medicareSet);
  const extraHelp = extraHelpEligibility(medicareFacts, medicareSet);

  const ctc = childTaxCredit(
    {
      qualifyingChildren: f.childAges.filter((a) => a < 17).length,
      agiAnnualCents: annualIncome,
      filingStatus: f.filingStatus,
    },
    ctcThresholdsFor(AS_OF)
  );

  const medicaidCovered = st?.medicaid.covered ?? false;
  const medicaidLimit =
    st?.medicaid.limitPct == null
      ? null
      : dollars(Math.round((fpgAnnual(fpgTable, f.householdSize) * st.medicaid.limitPct) / 100));
  const medicaid = {
    eligible: medicaidCovered && medicaidLimit !== null && annualIncome <= medicaidLimit,
    annualValueCents: null,
  };

  const stateRate = st?.eitc?.rate ?? null;
  const stateCredit =
    stateRate !== null && eitc.eligible && eitc.annualValueCents
      ? Math.round(eitc.annualValueCents * stateRate)
      : 0;
  const stateEitc = {
    eligible: stateCredit > 0,
    annualValueCents: stateCredit > 0 ? stateCredit : null,
  };

  const schoolAge = f.childAges.some((a) => a >= 5 && a <= 18);
  const sfmnp = fpgResult('sfmnp', f.claimantAge >= 60, 'someone aged 60 or over');
  const cacfp = fpgResult('cacfp', f.dependentCareMonthly > 0, 'someone in care');
  const wap = fpgResult('wap', !f.allMembersHomeless, 'lives in a home');
  const summerEbt = fpgResult('summer_ebt', schoolAge, 'a school-age child');
  const fdpirR = fpgResult('fdpir', f.onTribalLands, 'lives on or near a reservation');
  const chip = fpgResult('chip', f.childAges.length > 0, 'a child under 19');

  const vaPension = veteransPension(
    {
      dependents: Math.max(0, f.householdSize - 1),
      annualIncomeCents: annualIncome,
      netWorthCents: dollars(f.savings),
      annualMedicalCents: dollars(f.medicalMonthly * 12),
      careLevel: 'neither',
    },
    vaPensionThresholdsFor(AS_OF)
  );
  const vaResult = {
    eligible: f.wartimeVeteran && vaPension.eligible,
    annualValueCents: f.wartimeVeteran ? vaPension.annualValueCents : null,
  };

  const cdctc = dependentCareCredit(
    {
      annualCareExpensesCents: dollars(f.dependentCareMonthly * 12),
      qualifyingPeople: f.childAges.filter((a) => a < 13).length,
      agiAnnualCents: annualIncome,
    },
    cdctcThresholdsFor(AS_OF)
  );
  const cdctcResult = {
    eligible: f.dependentCareMonthly > 0 && cdctc.eligible,
    annualValueCents: f.dependentCareMonthly > 0 ? cdctc.annualValueCents : null,
  };

  const extra: Record<string, { eligible: boolean; annualValueCents: number | null }> = {
    ctc,
    wic,
    school_meals: schoolMeals,
    csfp,
    liheap,
    head_start: headStart,
    medicare_savings: msp,
    extra_help: extraHelp,
    medicaid,
    state_eitc: stateEitc,
    chip,
    sfmnp,
    cacfp,
    wap,
    summer_ebt: summerEbt,
    fdpir: fdpirR,
    va_pension: vaResult,
    cdctc: cdctcResult,
  };

  const truth: GoldHousehold['truth'] = {
    snap: snap.eligible ? 'eligible' : 'ineligible',
    eitc: eitc.eligible ? 'eligible' : 'ineligible',
    lifeline: lifeline.eligible ? 'eligible' : 'ineligible',
  };
  const values: GoldHousehold['values'] = {
    snap: snap.annualValueCents ? toDollars(snap.annualValueCents) : 0,
    eitc: eitc.annualValueCents ? toDollars(eitc.annualValueCents) : 0,
    lifeline: lifeline.annualValueCents ? toDollars(lifeline.annualValueCents) : 0,
  };
  for (const [id, r] of Object.entries(extra)) {
    truth[id] = r.eligible ? 'eligible' : 'ineligible';
    values[id] = r.annualValueCents ? toDollars(r.annualValueCents) : 0;
  }

  return {
    truth,
    values,
    derivation: {
      snap: [
        ...snap.steps.map((s) => `${s.label}: ${s.detail} -> ${formatDollars(s.runningCents)}`),
        ...snap.tests.map((t) => `${t.name}: ${t.passed ? 'passed' : 'failed'} (${t.detail})`),
        snap.monthlyBenefitCents !== null
          ? `Monthly benefit: ${formatDollars(snap.monthlyBenefitCents)}`
          : 'No benefit computed',
      ],
      eitc: [
        ...eitc.steps.map((s) => `${s.label}: ${s.detail}`),
        ...eitc.tests.map((t) => `${t.name}: ${t.passed ? 'passed' : 'failed'} (${t.detail})`),
      ],
      lifeline: lifeline.tests.map((t) => `${t.name}: ${t.passed ? 'passed' : 'failed'} (${t.detail})`),
    },
  };
}

// ---------------------------------------------------------------------------
// Writing the paragraph
// ---------------------------------------------------------------------------

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

interface RenderOptions {
  /** Leave the earned/unearned nature of the income unsaid. */
  hideIncomeSource?: boolean;
  /** State the income over a period other than monthly, without flagging it. */
  statePeriod?: Period;
  /** Describe children without giving ages or relationships precisely. */
  vagueChildren?: boolean;
  /** Mention a qualifying programme in passing rather than as a claim. */
  passingProgramMention?: boolean;
}

function renderParagraph(f: GoldFacts, o: RenderOptions = {}): string {
  const parts: string[] = [];
  const total = f.earnedMonthly + f.unearnedMonthly;
  const period = o.statePeriod ?? 'monthly';
  const shown = monthlyFromPeriod(total, period);
  const periodWord = { weekly: 'a week', biweekly: 'every two weeks', monthly: 'a month', annual: 'a year' }[period];

  // Opening: who is here
  if (f.householdSize === 1) {
    parts.push(
      pick([
        `I'm ${f.claimantAge} and I live alone in ${f.state}`,
        `I live by myself in ${f.state}, I'm ${f.claimantAge}`,
        `It's just me. I'm ${f.claimantAge}, in ${f.state}`,
      ])
    );
  } else if (f.children > 0) {
    // Ages are stated unless the household is deliberately vague, because several
    // programs turn entirely on how old the children are and a description that omits
    // them is not a test of reading, only of guessing.
    const agePhrase =
      f.childAges.length === 0
        ? ''
        : f.childAges.length === 1
          ? ` aged ${f.childAges[0]}`
          : ` aged ${f.childAges.slice(0, -1).join(', ')} and ${f.childAges[f.childAges.length - 1]}`;
    const kids = o.vagueChildren
      ? pick(['I have a couple of kids at home', 'I have kids living with me', 'there are the little ones too'])
      : `I have ${f.children === 1 ? 'one kid' : `${f.children} kids`}${agePhrase}`;
    const partner = f.filingStatus === 'joint' ? pick([' My husband is here too.', ' My wife works as well.', ' My partner and I are married.']) : '';
    parts.push(`I'm ${f.claimantAge}, I live in ${f.state}, and ${kids}.${partner}`.trim());
  } else {
    parts.push(`I'm ${f.claimantAge} and there are ${f.householdSize} of us in ${f.state}`);
  }

  // Income
  if (total === 0) {
    parts.push(pick(['I have no income at all right now', "I'm not bringing in anything at the moment"]));
  } else if (o.hideIncomeSource) {
    parts.push(pick([
      `I get about ${money(shown)} ${periodWord}`,
      `I have around ${money(shown)} coming in ${periodWord}`,
      `About ${money(shown)} ${periodWord} comes in`,
    ]));
  } else if (f.earnedMonthly > 0 && f.unearnedMonthly > 0) {
    parts.push(
      `I make ${money(monthlyFromPeriod(f.earnedMonthly, period))} ${periodWord} from work and get ${money(f.unearnedMonthly)} a month in benefits`
    );
  } else if (f.earnedMonthly > 0) {
    parts.push(
      pick([
        `I work and make about ${money(shown)} ${periodWord}`,
        `My job pays around ${money(shown)} ${periodWord}`,
        `I bring home roughly ${money(shown)} ${periodWord} from my job`,
      ])
    );
  } else {
    const source = f.categorical === 'ssi' ? 'SSI' : pick(['Social Security', 'my disability check', 'a pension']);
    if (o.passingProgramMention) {
      parts.push(`the ${money(shown)} ${periodWord} I live on comes from ${source}, which I've been on for years`);
    } else {
      parts.push(`I get ${money(shown)} ${periodWord} from ${source}`);
    }
  }

  // Housing
  if (f.allMembersHomeless) {
    parts.push(pick(['We are staying in a shelter right now', "I don't have a place of my own at the moment"]));
  } else if (f.rentMonthly > 0) {
    const util = f.utilitiesMonthly > 0
      ? ` and I pay ${money(f.utilitiesMonthly)} for gas and electric on top`
      : ' with utilities included';
    parts.push(`Rent is ${money(f.rentMonthly)}${util}`);
  }

  // Extras
  if (f.dependentCareMonthly > 0) parts.push(`Daycare costs me ${money(f.dependentCareMonthly)} a month`);
  if (f.childSupportMonthly > 0) parts.push(`I pay ${money(f.childSupportMonthly)} a month in child support`);
  if (f.medicalMonthly > 0) parts.push(`My prescriptions run about ${money(f.medicalMonthly)} a month`);
  if (f.savings > 0) parts.push(`I have ${money(f.savings)} saved`);

  // Programmes already held
  const mentions: string[] = [];
  if (f.lifelinePrograms.includes('medicaid')) mentions.push('Medicaid');
  if (f.lifelinePrograms.includes('fpha')) mentions.push('a Section 8 voucher');
  if (f.lifelinePrograms.includes('veterans_pension')) mentions.push('a Veterans Pension');
  if (f.categorical === 'tanf') mentions.push('TANF');
  if (f.categorical === 'ga') mentions.push('General Assistance');
  if (mentions.length > 0) {
    parts.push(
      o.passingProgramMention
        ? `I've had ${mentions.join(' and ')} since last year`
        : `I get ${mentions.join(' and ')}`
    );
  }
  if (f.onTribalLands) parts.push('We live on tribal land');
  if (f.wartimeVeteran) parts.push(pick(['I served in the Army during wartime', 'I am a veteran', 'I served in the military years ago']));

  return parts.map((p, i) => (i === 0 ? p : p)).join('. ').replace(/\.\./g, '.') + '.';
}

// ---------------------------------------------------------------------------
// Household shapes per slice
// ---------------------------------------------------------------------------

function baseFacts(): GoldFacts {
  return {
    householdSize: 1,
    earnedMonthly: 0,
    unearnedMonthly: 0,
    rentMonthly: 0,
    utilitiesMonthly: 0,
    dependentCareMonthly: 0,
    childSupportMonthly: 0,
    medicalMonthly: 0,
    savings: 0,
    hasElderlyOrDisabled: false,
    allMembersHomeless: false,
    categorical: 'none',
    children: 0,
    qualifyingChildren: 0,
    filingStatus: 'other',
    claimantAge: 35,
    childAges: [],
    wartimeVeteran: false,
    investmentIncome: 0,
    lifelinePrograms: [],
    onTribalLands: false,
    statedPeriod: 'monthly',
    state: 'Ohio',
  };
}

function lowIncomeWorkingFamily(): GoldFacts {
  const children = between(1, 3);
  const f = baseFacts();
  f.state = pick(STATES);
  f.householdSize = 1 + children;
  f.children = children;
  f.qualifyingChildren = children;
  f.childAges = Array.from({ length: children }, () => between(1, 16));
  f.claimantAge = between(24, 44);
  f.earnedMonthly = between(900, 1900, 25);
  f.rentMonthly = between(550, 1100, 25);
  f.utilitiesMonthly = rand() < 0.6 ? between(80, 200, 10) : 0;
  f.dependentCareMonthly = rand() < 0.4 ? between(150, 450, 25) : 0;
  f.filingStatus = 'other';
  return f;
}

function elderlyOnFixedIncome(): GoldFacts {
  const f = baseFacts();
  f.state = pick(STATES);
  f.claimantAge = between(62, 84);
  f.hasElderlyOrDisabled = true;
  // About a fifth of older households here are wartime veterans, which is the only
  // route into the pension.
  f.wartimeVeteran = rand() < 0.2;
  f.unearnedMonthly = between(850, 1450, 25);
  f.rentMonthly = between(500, 900, 25);
  f.utilitiesMonthly = rand() < 0.7 ? between(70, 190, 10) : 0;
  f.medicalMonthly = rand() < 0.5 ? between(45, 250, 5) : 0;
  f.savings = rand() < 0.3 ? between(500, 3800, 100) : 0;
  return f;
}

function comfortableHousehold(): GoldFacts {
  const f = baseFacts();
  f.state = pick(STATES);
  f.householdSize = between(1, 4);
  f.children = Math.max(0, f.householdSize - between(1, 2));
  f.qualifyingChildren = f.children;
  f.childAges = Array.from({ length: f.children }, () => between(1, 16));
  f.claimantAge = between(30, 55);
  f.earnedMonthly = between(6000, 11000, 250);
  f.rentMonthly = between(1500, 2600, 50);
  f.savings = between(8000, 60000, 500);
  f.filingStatus = f.householdSize > 2 ? 'joint' : 'other';
  f.investmentIncome = rand() < 0.3 ? between(1000, 9000, 500) : 0;
  return f;
}

function onCategoricalBenefits(): GoldFacts {
  const f = baseFacts();
  f.state = pick(STATES);
  f.claimantAge = between(28, 60);
  f.categorical = pick(['ssi', 'tanf', 'ga'] as const);
  f.unearnedMonthly = between(700, 1100, 25);
  f.rentMonthly = between(400, 850, 25);
  f.hasElderlyOrDisabled = f.categorical === 'ssi';
  if (f.categorical === 'ssi') f.lifelinePrograms.push('ssi');
  return f;
}

// ---------------------------------------------------------------------------
// Building the set
// ---------------------------------------------------------------------------

const TARGETS: { slice: Slice; count: number }[] = [
  { slice: 'clear_eligible', count: 30 },
  { slice: 'clear_ineligible', count: 30 },
  { slice: 'mixed', count: 40 },
  { slice: 'underspecified', count: 30 },
  { slice: 'adversarial', count: 20 },
];

function countEligible(truth: GoldHousehold['truth']): number {
  return Object.values(truth).filter((v) => v === 'eligible').length;
}

function build(): GoldHousehold[] {
  const out: GoldHousehold[] = [];

  for (const target of TARGETS) {
    let made = 0;
    let attempts = 0;

    while (made < target.count && attempts < target.count * 400) {
      attempts++;
      let f: GoldFacts;
      const options: RenderOptions = {};
      let loadBearingGap: string | undefined;
      let note: string | undefined;

      switch (target.slice) {
        case 'clear_eligible':
          // All three at once requires earned income: a retiree on a fixed income is
          // eligible for SNAP and Lifeline but can never be eligible for the EITC,
          // which is a credit on earnings. Only a working low-income family with
          // children lands in all three.
          f = lowIncomeWorkingFamily();
          break;
        case 'clear_ineligible':
          f = comfortableHousehold();
          break;
        case 'mixed':
          f = pick([elderlyOnFixedIncome, onCategoricalBenefits, lowIncomeWorkingFamily])();
          break;
        case 'underspecified': {
          f = rand() < 0.5 ? elderlyOnFixedIncome() : lowIncomeWorkingFamily();
          // Move all income into one bucket so the source genuinely decides the
          // 20% earned deduction, then withhold which bucket it is.
          const total = f.earnedMonthly + f.unearnedMonthly;
          if (rand() < 0.5) {
            f.earnedMonthly = total;
            f.unearnedMonthly = 0;
          } else {
            f.earnedMonthly = 0;
            f.unearnedMonthly = total;
          }
          options.hideIncomeSource = true;
          loadBearingGap = 'snap.income_source';
          note =
            'The description does not say whether the income is earned or unearned. ' +
            'Only earned income takes the 20% deduction, so the answer moves net income and the benefit.';
          break;
        }
        case 'adversarial': {
          f = rand() < 0.5 ? lowIncomeWorkingFamily() : elderlyOnFixedIncome();

          // Only apply a style the household can actually exhibit. Describing the
          // children vaguely is not an adversarial property of a household that has
          // none, and a note claiming otherwise would make the slice a lie.
          const styles: (() => void)[] = [
            () => {
              options.statePeriod = pick(['weekly', 'biweekly'] as Period[]);
              f.statedPeriod = options.statePeriod!;
              note = `Income is stated ${options.statePeriod}; reading it as monthly understates it by several times.`;
            },
            () => {
              options.passingProgramMention = true;
              note = 'A qualifying programme or income source is mentioned in passing rather than claimed.';
            },
          ];
          if (f.children > 0) {
            styles.push(() => {
              options.vagueChildren = true;
              note = 'The children are described without a count or ages.';
            });
          }
          pick(styles)();
          break;
        }
      }

      const { truth, values, derivation } = truthFor(f);
      const eligibleCount = countEligible(truth);

      // Each slice has to actually be what it says it is.
      //
      // With eleven programs, "eligible for all of them" is not a state any household
      // can reach: the same person cannot be under five and over sixty. So the clearly
      // eligible slice means a household that qualifies broadly, and the clearly
      // ineligible one means a household that qualifies for nothing at all.
      if (target.slice === 'clear_eligible' && eligibleCount < 5) continue;
      if (target.slice === 'clear_ineligible' && eligibleCount !== 0) continue;
      if (target.slice === 'mixed' && (eligibleCount === 0 || eligibleCount >= 5)) continue;

      const paragraph = renderParagraph(f, options);

      out.push({
        id: `gh-${String(out.length + 1).padStart(3, '0')}`,
        slice: target.slice,
        // Every third household is held out, so each slice is represented in both halves.
        split: made % 3 === 2 ? 'holdout' : 'dev',
        paragraph,
        facts: f,
        truth,
        values,
        derivation,
        ...(loadBearingGap ? { loadBearingGap } : {}),
        ...(note ? { note } : {}),
      });
      made++;
    }

    if (made < target.count) {
      throw new Error(
        `Only produced ${made} of ${target.count} households for the ${target.slice} slice.`
      );
    }
  }

  return out;
}

const households = build();
const path = join(process.cwd(), 'data', 'gold', 'households.jsonl');
writeFileSync(path, households.map((h) => JSON.stringify(h)).join('\n') + '\n');

const bySlice = new Map<string, number>();
const eligibleBy: Record<string, number> = {};
for (const h of households) {
  bySlice.set(h.slice, (bySlice.get(h.slice) ?? 0) + 1);
  for (const [program, verdict] of Object.entries(h.truth)) {
    eligibleBy[program] = (eligibleBy[program] ?? 0) + (verdict === 'eligible' ? 1 : 0);
  }
}

console.log(`wrote ${households.length} households to data/gold/households.jsonl`);
for (const [slice, count] of bySlice) console.log(`  ${slice.padEnd(18)} ${count}`);
console.log('eligible in truth:');
for (const [program, count] of Object.entries(eligibleBy)) {
  console.log(`  ${program.padEnd(10)} ${count}/${households.length} (${Math.round((100 * count) / households.length)}%)`);
}
