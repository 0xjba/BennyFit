/**
 * Rules conformance: does the arithmetic agree with the published sources?
 *
 * Every expected figure below was worked out by hand from a primary source and written
 * here as a literal. None of them is produced by calling the code under test, which is
 * the whole point: the gold set can only ever show that the system recovers the facts
 * its own generator started from, and that says nothing about whether the deductions,
 * thresholds and phase-outs are right.
 *
 * Each case names the source the figure came from, so a wrong number here is a
 * disagreement with an agency rather than with an opinion.
 *
 * These cases are the reported measurement. `lib/*.test.ts` is the developer safety
 * net; this is the thing an outside reader should be able to check.
 */

import { Cents, dollars, toDollars } from '@/lib/money';
import {
  EitcFacts,
  LifelineFacts,
  SnapFacts,
  eitcCredit,
  lifelineEligibility,
  snapEligibility,
} from '@/lib/compute';
import {
  CdctcFacts,
  FpgFacts,
  MedicareFacts,
  VaPensionFacts,
  childTaxCredit,
  dependentCareCredit,
  cdctcQualifyingChildren,
  vaPensionAgeOrDisability,
  medicarePossible,
  extraHelpEligibility,
  fpgThresholdEligibility,
  medicareSavingsEligibility,
  veteransPension,
} from '@/lib/compute-programs';
import {
  cdctcThresholdsFor,
  ctcThresholdsFor,
  eitcThresholdsFor,
  fpgProgramConfig,
  lifelineThresholdsFor,
  medicareThresholdsFor,
  povertyGuidelines,
  snapThresholdsFor,
  vaPensionThresholdsFor,
} from '@/lib/thresholds';


const AS_OF = '2026-09-21';

export interface ConformanceCase {
  id: string;
  program: string;
  what: string;
  /** Where the expected figure came from, in enough detail to look it up. */
  source: string;
  /** Returns what the code produced, and what the source says it should be. */
  run: () => { got: number | boolean | null; expected: number | boolean | null };
}

function snapFacts(over: Partial<SnapFacts> = {}): SnapFacts {
  return {
    householdSize: 1,
    earnedMonthlyCents: 0,
    unearnedMonthlyCents: 0,
    medicalMonthlyCents: 0,
    dependentCareMonthlyCents: 0,
    childSupportPaidMonthlyCents: 0,
    shelterMonthlyCents: 0,
    hasElderlyOrDisabledMember: false,
    allMembersHomeless: false,
    countableResourcesCents: 0,
    categoricallyEligible: false,
    ...over,
  };
}

function eitcFacts(over: Partial<EitcFacts> = {}): EitcFacts {
  return {
    earnedAnnualCents: 0,
    agiAnnualCents: 0,
    qualifyingChildren: 0,
    filingStatus: 'other',
    investmentIncomeAnnualCents: 0,
    claimantAge: 40,
    marriedFilingSeparatelyIneligible: false,
    ...over,
  };
}

function medicareFacts(over: Partial<MedicareFacts> = {}): MedicareFacts {
  return { onMedicare: true, married: false, monthlyIncomeCents: 0, resourcesCents: 0, ...over };
}

function fpgFacts(over: Partial<FpgFacts> = {}): FpgFacts {
  return {
    householdSize: 1,
    annualIncomeCents: 0,
    programsReceived: [],
    categoryMet: true,
    categoryDetail: 'assumed for this check',
    ...over,
  };
}

const dollarsOut = (c: Cents | null): number | null => (c === null ? null : toDollars(c));

export const CASES: ConformanceCase[] = [
  // ---------------- SNAP ----------------
  {
    id: 'snap.usda-worked-example.net',
    program: 'snap',
    what: "Net monthly income for USDA's own published example household",
    source:
      'fna.usda.gov SNAP eligibility page: 4 people, $1,500 earned, $550 social security, ' +
      '$362 dependent care, $700 shelter. USDA works this through to $1,047.50.',
    run: () => ({
      got: dollarsOut(
        snapEligibility(
          snapFacts({
            householdSize: 4,
            earnedMonthlyCents: dollars(1500),
            unearnedMonthlyCents: dollars(550),
            dependentCareMonthlyCents: dollars(362),
            shelterMonthlyCents: dollars(700),
          }),
          snapThresholdsFor(AS_OF)
        ).netCents
      ),
      expected: 1047.5,
    }),
  },
  {
    id: 'snap.usda-worked-example.benefit',
    program: 'snap',
    what: 'Monthly benefit for that same household',
    source:
      '$994 maximum allotment for four (FY2026 COLA memo) less 30% of $1,047.50 rounded ' +
      'up to $315, per 7 CFR 273.10(e)(2)(ii)(A)(1). $994 - $315 = $679.',
    run: () => ({
      got: dollarsOut(
        snapEligibility(
          snapFacts({
            householdSize: 4,
            earnedMonthlyCents: dollars(1500),
            unearnedMonthlyCents: dollars(550),
            dependentCareMonthlyCents: dollars(362),
            shelterMonthlyCents: dollars(700),
          }),
          snapThresholdsFor(AS_OF)
        ).monthlyBenefitCents
      ),
      expected: 679,
    }),
  },
  {
    id: 'snap.minimum-allotment',
    program: 'snap',
    what: 'A one-person household whose computed benefit falls below the minimum',
    source:
      'FY2026 Minimum Allotments memo: $24 for one- and two-person households. The ' +
      'regulation derives the same figure as 8% of the $298 one-person maximum.',
    run: () => ({
      got: dollarsOut(
        snapEligibility(
          snapFacts({ householdSize: 1, unearnedMonthlyCents: dollars(1300) }),
          snapThresholdsFor(AS_OF)
        ).monthlyBenefitCents
      ),
      expected: 24,
    }),
  },
  {
    id: 'snap.gross-limit-four',
    program: 'snap',
    what: 'The published gross income limit for a four-person household',
    source: 'FY2026 Income Eligibility Standards: $3,483 a month, 130% of poverty.',
    run: () => {
      const r = snapEligibility(
        snapFacts({ householdSize: 4, unearnedMonthlyCents: dollars(3484) }),
        snapThresholdsFor(AS_OF)
      );
      return { got: r.tests.find((t) => t.name === 'Gross income test')?.passed ?? null, expected: false };
    },
  },

  // ---------------- EITC ----------------
  {
    id: 'eitc.max-one-child',
    program: 'eitc',
    what: 'Credit at the earned income amount, one child, tax year 2025',
    source: 'Rev. Proc. 2024-40 §3.06: earned income amount $12,730, maximum credit $4,328.',
    run: () => ({
      got: dollarsOut(
        eitcCredit(
          eitcFacts({
            qualifyingChildren: 1,
            earnedAnnualCents: dollars(12730),
            agiAnnualCents: dollars(12730),
          }),
          eitcThresholdsFor('2025-06-01')
        ).annualValueCents
      ),
      expected: 4328,
    }),
  },
  {
    id: 'eitc.max-three-children-2026',
    program: 'eitc',
    what: 'Credit at the earned income amount, three or more children, tax year 2026',
    source: 'Rev. Proc. 2025-32 §3.06: earned income amount $18,290, maximum credit $8,231.',
    run: () => ({
      got: dollarsOut(
        eitcCredit(
          eitcFacts({
            qualifyingChildren: 3,
            earnedAnnualCents: dollars(18290),
            agiAnnualCents: dollars(18290),
          }),
          eitcThresholdsFor('2026-06-01')
        ).annualValueCents
      ),
      expected: 8231,
    }),
  },
  {
    id: 'eitc.max-one-child-2026',
    program: 'eitc',
    what: 'Credit at the earned income amount, one child, tax year 2026',
    source:
      'Rev. Proc. 2025-32 §3.06: earned income amount $13,020, maximum credit $4,427. ' +
      '34% of $13,020 is $4,426.80, and the published maximum rounds it up.',
    run: () => ({
      got: dollarsOut(
        eitcCredit(
          eitcFacts({
            qualifyingChildren: 1,
            earnedAnnualCents: dollars(13020),
            agiAnnualCents: dollars(13020),
          }),
          eitcThresholdsFor('2026-06-01')
        ).annualValueCents
      ),
      expected: 4427,
    }),
  },
  {
    id: 'eitc.zero-at-completed-phaseout',
    program: 'eitc',
    what: 'Credit reaches zero at the published completed phase-out, two children, single',
    source: 'Rev. Proc. 2024-40 §3.06: completed phaseout $57,310 for other filing statuses.',
    run: () => ({
      got: dollarsOut(
        eitcCredit(
          eitcFacts({
            qualifyingChildren: 2,
            earnedAnnualCents: dollars(57310),
            agiAnnualCents: dollars(57310),
          }),
          eitcThresholdsFor('2025-06-01')
        ).annualValueCents
      ),
      expected: null,
    }),
  },
  {
    id: 'eitc.investment-cliff',
    program: 'eitc',
    what: 'One dollar of investment income above the limit forfeits the whole credit',
    source: 'Rev. Proc. 2024-40 §3.06(2): limit $11,950 for tax year 2025. IRC 32(i).',
    run: () => ({
      got: eitcCredit(
        eitcFacts({
          qualifyingChildren: 2,
          earnedAnnualCents: dollars(20000),
          agiAnnualCents: dollars(20000),
          investmentIncomeAnnualCents: dollars(11951),
        }),
        eitcThresholdsFor('2025-06-01')
      ).eligible,
      expected: false,
    }),
  },

  // ---------------- Child Tax Credit ----------------
  {
    id: 'ctc.two-children-no-phaseout',
    program: 'ctc',
    what: 'Two children well below the phase-out threshold',
    source:
      'Rev. Proc. 2025-32 §2.03, recording the OBBBA amendment to IRC 24(h)(2): $2,200 ' +
      'per child. Two children is $4,400, and $50,000 is far below the $200,000 threshold.',
    run: () => ({
      got: dollarsOut(
        childTaxCredit(
          { qualifyingChildren: 2, agiAnnualCents: dollars(50000), filingStatus: 'other' },
          ctcThresholdsFor(AS_OF)
        ).annualValueCents
      ),
      expected: 4400,
    }),
  },
  {
    id: 'ctc.phaseout',
    program: 'ctc',
    what: 'One child at $210,000, single',
    source:
      'IRC 24(b): the credit falls $50 for each $1,000 above $200,000. Ten thousand over ' +
      'is ten steps, so $2,200 - $500 = $1,700.',
    run: () => ({
      got: dollarsOut(
        childTaxCredit(
          { qualifyingChildren: 1, agiAnnualCents: dollars(210000), filingStatus: 'other' },
          ctcThresholdsFor(AS_OF)
        ).annualValueCents
      ),
      expected: 1700,
    }),
  },

  // ---------------- Medicare ----------------
  {
    id: 'medicare.qmb-value',
    program: 'medicare_savings',
    what: 'A single person inside the QMB limits',
    source:
      'medicare.gov 2026: QMB income limit $1,350 a month, resource limit $9,950. The ' +
      'Part B premium it covers is $202.90 a month, so $2,434.80 a year.',
    run: () => ({
      got: dollarsOut(
        medicareSavingsEligibility(
          medicareFacts({ monthlyIncomeCents: dollars(1300), resourcesCents: dollars(5000) }),
          medicareThresholdsFor(AS_OF)
        ).annualValueCents
      ),
      expected: 2434.8,
    }),
  },
  {
    id: 'medicare.qi-tier',
    program: 'medicare_savings',
    what: 'Income above SLMB but inside QI still qualifies',
    source: 'medicare.gov 2026: SLMB limit $1,616, QI limit $1,816 for an individual.',
    run: () => ({
      got: medicareSavingsEligibility(
        medicareFacts({ monthlyIncomeCents: dollars(1700), resourcesCents: dollars(5000) }),
        medicareThresholdsFor(AS_OF)
      ).eligible,
      expected: true,
    }),
  },
  {
    id: 'medicare.above-all-tiers',
    program: 'medicare_savings',
    what: 'Income above the widest tier does not qualify',
    source: 'medicare.gov 2026: the QI limit of $1,816 is the highest of the three.',
    run: () => ({
      got: medicareSavingsEligibility(
        medicareFacts({ monthlyIncomeCents: dollars(1817), resourcesCents: dollars(5000) }),
        medicareThresholdsFor(AS_OF)
      ).eligible,
      expected: false,
    }),
  },
  {
    id: 'extra-help.at-the-limit',
    program: 'extra_help',
    what: 'A single person exactly at the income and resource limits',
    source: 'medicare.gov 2026: income limit $23,940, resource limit $18,090.',
    run: () => ({
      got: extraHelpEligibility(
        medicareFacts({
          monthlyIncomeCents: Math.round(dollars(23940) / 12),
          resourcesCents: dollars(18090),
        }),
        medicareThresholdsFor(AS_OF)
      ).eligible,
      expected: true,
    }),
  },

  // ---------------- Veterans Pension ----------------
  {
    id: 'medicare.gate-64',
    program: 'extra_help',
    what: 'Aged 64, no disability mentioned: cannot be on Medicare',
    source:
      'medicare.gov (Who can get Medicare): people 65 or older, and certain younger people ' +
      'with disabilities or End-Stage Renal Disease. Found by the held-out run, where ' +
      'people aged 62 to 64 were read as on Medicare and shown Extra Help.',
    run: () => ({ got: medicarePossible(64, false), expected: false }),
  },
  {
    id: 'medicare.gate-50-ssdi',
    program: 'extra_help',
    what: 'Aged 50 on SSDI: can be',
    source:
      'medicare.gov (Who can get Medicare): people 65 or older, and certain younger people ' +
      'with disabilities or End-Stage Renal Disease. Found by the held-out run, where ' +
      'people aged 62 to 64 were read as on Medicare and shown Extra Help.',
    run: () => ({ got: medicarePossible(50, true), expected: true }),
  },
  {
    id: 'medicare.gate-age-unknown',
    program: 'extra_help',
    what: 'Age not stated: left to the description',
    source:
      'medicare.gov (Who can get Medicare): people 65 or older, and certain younger people ' +
      'with disabilities or End-Stage Renal Disease. Found by the held-out run, where ' +
      'people aged 62 to 64 were read as on Medicare and shown Extra Help.',
    run: () => ({ got: medicarePossible(null, false), expected: true }),
  },
  {
    id: 'va.gate-young-not-disabled',
    program: 'va_pension',
    what: 'A wartime veteran of 40, not disabled: fails the gate',
    source:
      'va.gov/pension/eligibility: at least one of age 65 or older, a permanent and total ' +
      'disability, long-term nursing home care because of a disability, or SSDI or SSI. ' +
      'Found while measuring follow-up questions: the rule lacked this test, so a wartime ' +
      'veteran of any age looked eligible.',
    run: () => ({ got: vaPensionAgeOrDisability(40, false), expected: false }),
  },
  {
    id: 'va.gate-65',
    program: 'va_pension',
    what: 'A wartime veteran of 67, not disabled: passes on age',
    source:
      'va.gov/pension/eligibility: at least one of age 65 or older, a permanent and total ' +
      'disability, long-term nursing home care because of a disability, or SSDI or SSI. ' +
      'Found while measuring follow-up questions: the rule lacked this test, so a wartime ' +
      'veteran of any age looked eligible.',
    run: () => ({ got: vaPensionAgeOrDisability(67, false), expected: true }),
  },
  {
    id: 'va.gate-ssi',
    program: 'va_pension',
    what: 'A wartime veteran of 50 on SSI: passes',
    source:
      'va.gov/pension/eligibility: at least one of age 65 or older, a permanent and total ' +
      'disability, long-term nursing home care because of a disability, or SSDI or SSI. ' +
      'Found while measuring follow-up questions: the rule lacked this test, so a wartime ' +
      'veteran of any age looked eligible.',
    run: () => ({ got: vaPensionAgeOrDisability(50, true), expected: true }),
  },
  {
    id: 'va.basic-no-dependents',
    program: 'va_pension',
    what: 'A veteran with no dependents and $10,000 of income',
    source:
      'va.gov rates from 1 December 2025: MAPR $17,441 with no dependents and no ' +
      'housebound or aid and attendance. The pension is the difference, $7,441.',
    run: () => {
      const f: VaPensionFacts = {
        dependents: 0,
        annualIncomeCents: dollars(10000),
        netWorthCents: dollars(20000),
        annualMedicalCents: 0,
        careLevel: 'neither',
      };
      return {
        got: dollarsOut(veteransPension(f, vaPensionThresholdsFor(AS_OF)).annualValueCents),
        expected: 7441,
      };
    },
  },
  {
    id: 'va.aid-and-attendance-one-dependent',
    program: 'va_pension',
    what: 'A veteran with one dependent who qualifies for aid and attendance',
    source: 'va.gov: MAPR $34,488. With $10,000 of income the pension is $24,488.',
    run: () => ({
      got: dollarsOut(
        veteransPension(
          {
            dependents: 1,
            annualIncomeCents: dollars(10000),
            netWorthCents: dollars(20000),
            annualMedicalCents: 0,
            careLevel: 'aid_and_attendance',
          },
          vaPensionThresholdsFor(AS_OF)
        ).annualValueCents
      ),
      expected: 24488,
    }),
  },
  {
    id: 'va.net-worth-limit',
    program: 'va_pension',
    what: 'Assets above the net worth limit disqualify',
    source: 'va.gov: the net worth limit from 1 December 2025 is $163,699.',
    run: () => ({
      got: veteransPension(
        {
          dependents: 0,
          annualIncomeCents: dollars(5000),
          netWorthCents: dollars(160000),
          annualMedicalCents: 0,
          careLevel: 'neither',
        },
        vaPensionThresholdsFor(AS_OF)
      ).eligible,
      expected: false,
    }),
  },

  // ---------------- Dependent care credit ----------------
  {
    id: 'cdctc.max-rate',
    program: 'cdctc',
    what: 'One child, $3,000 of care, income at the top of the 35% band',
    source:
      'IRC 21: expenses capped at $3,000 for one qualifying person, 35% at an income of ' +
      '$15,000 or below. $3,000 x 35% = $1,050.',
    run: () => {
      const f: CdctcFacts = {
        annualCareExpensesCents: dollars(3000),
        qualifyingPeople: 1,
        agiAnnualCents: dollars(15000),
      };
      return {
        got: dollarsOut(dependentCareCredit(f, cdctcThresholdsFor(AS_OF)).annualValueCents),
        expected: 1050,
      };
    },
  },
  {
    id: 'cdctc.floor-rate',
    program: 'cdctc',
    what: 'The rate never falls below 20%',
    source: 'IRC 21(a)(2): the 35% rate falls a point per $2,000 of income but stops at 20%.',
    run: () => ({
      got: dollarsOut(
        dependentCareCredit(
          {
            annualCareExpensesCents: dollars(3000),
            qualifyingPeople: 1,
            agiAnnualCents: dollars(80000),
          },
          cdctcThresholdsFor(AS_OF)
        ).annualValueCents
      ),
      expected: 600,
    }),
  },

  {
    id: 'cdctc.children-too-old',
    program: 'cdctc',
    what: 'Children aged 14 and 15 with $425 a month of daycare: no credit',
    source:
      'IRC 21(b)(1)(A): a qualifying person is a dependent under 13. Neither child is, so ' +
      'no expense counts and the credit is $0, whatever was paid. Found by the first live ' +
      'end-to-end run, where the answer key and the app both counted every child.',
    run: () => ({
      got: dollarsOut(
        dependentCareCredit(
          {
            annualCareExpensesCents: dollars(425 * 12),
            qualifyingPeople: cdctcQualifyingChildren(2, [14, 15, 26]),
            agiAnnualCents: dollars(14690),
          },
          cdctcThresholdsFor(AS_OF)
        ).annualValueCents
      ) ?? 0,
      expected: 0,
    }),
  },

  // ---------------- Lifeline ----------------
  {
    id: 'lifeline.at-the-limit',
    program: 'lifeline',
    what: 'A one-person household exactly at 135% of the poverty guideline',
    source: 'usac.org 2026 table: $21,546 for one person.',
    run: () => ({
      got: lifelineEligibility(
        { householdSize: 1, annualIncomeCents: dollars(21546), programsReceived: [], onTribalLands: false },
        lifelineThresholdsFor(AS_OF)
      ).eligible,
      expected: true,
    }),
  },
  {
    id: 'lifeline.one-dollar-over',
    program: 'lifeline',
    what: 'One dollar above the table does not qualify on income',
    source: 'usac.org 2026 table: $21,546 for one person.',
    run: () => {
      const f: LifelineFacts = {
        householdSize: 1,
        annualIncomeCents: dollars(21547),
        programsReceived: [],
        onTribalLands: false,
      };
      return { got: lifelineEligibility(f, lifelineThresholdsFor(AS_OF)).eligible, expected: false };
    },
  },
  {
    id: 'lifeline.tribal-benefit',
    program: 'lifeline',
    what: 'The benefit on Tribal lands',
    source: 'usac.org: up to $9.25 a month, up to $34.25 on Tribal lands. $34.25 x 12 = $411.',
    run: () => ({
      got: dollarsOut(
        lifelineEligibility(
          { householdSize: 1, annualIncomeCents: dollars(10000), programsReceived: [], onTribalLands: true },
          lifelineThresholdsFor(AS_OF)
        ).annualValueCents
      ),
      expected: 411,
    }),
  },

  // ---------------- Poverty-guideline programs ----------------
  {
    id: 'wic.at-185-percent',
    program: 'wic',
    what: 'A one-person household exactly at 185% of the 2026 poverty guideline',
    source:
      '7 CFR 246.7(d) sets WIC at 185% of the federal income guidelines. The 2026 ' +
      'guideline for one person is $15,960, and 185% of that is $29,526.',
    run: () => ({
      got: fpgThresholdEligibility(
        fpgFacts({ annualIncomeCents: dollars(29526) }),
        fpgProgramConfig('wic', AS_OF),
        povertyGuidelines()
      ).eligible,
      expected: true,
    }),
  },
  {
    id: 'csfp.at-130-percent',
    program: 'csfp',
    what: 'A one-person household one dollar above 130% of the guideline',
    source: 'CSFP Income Guidelines 2026: 130% of $15,960 is $20,748.',
    run: () => ({
      got: fpgThresholdEligibility(
        fpgFacts({ annualIncomeCents: dollars(20749) }),
        fpgProgramConfig('csfp', AS_OF),
        povertyGuidelines()
      ).eligible,
      expected: false,
    }),
  },
  {
    id: 'wap.at-200-percent',
    program: 'wap',
    what: 'A one-person household exactly at 200% of the guideline',
    source: '10 CFR 440.3 defines low income as at or below 200% of poverty. 200% of $15,960 is $31,920.',
    run: () => ({
      got: fpgThresholdEligibility(
        fpgFacts({ annualIncomeCents: dollars(31920) }),
        fpgProgramConfig('wap', AS_OF),
        povertyGuidelines()
      ).eligible,
      expected: true,
    }),
  },
  {
    id: 'wic.adjunctive-eligibility',
    program: 'wic',
    what: 'Receiving SNAP meets the WIC income test whatever the income figure',
    source:
      'fna.usda.gov WIC eligibility: a household receiving Medicaid, SNAP or TANF is ' +
      'already income eligible for WIC.',
    run: () => ({
      got: fpgThresholdEligibility(
        fpgFacts({ annualIncomeCents: dollars(90000), programsReceived: ['snap'] }),
        fpgProgramConfig('wic', AS_OF),
        povertyGuidelines()
      ).eligible,
      expected: true,
    }),
  },
];

export interface ConformanceResult {
  id: string;
  program: string;
  what: string;
  source: string;
  got: number | boolean | null;
  expected: number | boolean | null;
  passed: boolean;
  error?: string;
}

export function runConformance(): ConformanceResult[] {
  return CASES.map((c) => {
    try {
      const { got, expected } = c.run();
      const passed =
        typeof got === 'number' && typeof expected === 'number'
          ? Math.abs(got - expected) < 0.005
          : got === expected;
      return { id: c.id, program: c.program, what: c.what, source: c.source, got, expected, passed };
    } catch (error) {
      return {
        id: c.id,
        program: c.program,
        what: c.what,
        source: c.source,
        got: null,
        expected: null,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
