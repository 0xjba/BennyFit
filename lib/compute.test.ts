import { describe, expect, it } from 'vitest';

import { dollars, formatDollars } from './money';
import {
  EitcFacts,
  LifelineFacts,
  SnapFacts,
  eitcCredit,
  lifelineEligibility,
  snapEligibility,
  snapNetIncome,
} from './compute';
import {
  activeSnapSet,
  bySize,
  eitcThresholdsFor,
  lifelineThresholdsFor,
  snapThresholdsFor,
} from './thresholds';

const FY2026 = snapThresholdsFor('2026-09-21');
const TY2025 = eitcThresholdsFor('2025-06-01');
const TY2026 = eitcThresholdsFor('2026-06-01');
const LIFELINE = lifelineThresholdsFor('2026-06-01');

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

function lifelineFacts(over: Partial<LifelineFacts> = {}): LifelineFacts {
  return {
    householdSize: 1,
    annualIncomeCents: 0,
    programsReceived: [],
    onTribalLands: false,
    ...over,
  };
}

describe("SNAP, against USDA's own worked example", () => {
  // From https://www.fna.usda.gov/snap/recipient/eligibility, read 2026-09-21.
  // Four people, no elderly or disabled member, $1,500 earned, $550 social security,
  // $362 dependent care, $700 shelter costs. USDA carries net income to the cent.
  const facts = snapFacts({
    householdSize: 4,
    earnedMonthlyCents: dollars(1500),
    unearnedMonthlyCents: dollars(550),
    dependentCareMonthlyCents: dollars(362),
    shelterMonthlyCents: dollars(700),
  });

  it('reproduces every intermediate figure USDA publishes', () => {
    const { grossCents, netCents, steps } = snapNetIncome(facts, FY2026);
    const running = steps.map((s) => s.runningCents);

    expect(grossCents).toBe(dollars(2050));
    expect(running[0]).toBe(dollars(2050)); // gross
    expect(running[1]).toBe(dollars(1750)); // less the 20% earned deduction, $300
    expect(running[2]).toBe(dollars(1527)); // less the $223 standard deduction
    expect(running[3]).toBe(dollars(1165)); // less $362 dependent care
    expect(netCents).toBe(dollars(1047.5)); // less $117.50 excess shelter
  });

  it('does not round net income to whole dollars', () => {
    expect(formatDollars(snapNetIncome(facts, FY2026).netCents)).toBe('$1,047.50');
  });

  it('computes the benefit from that net income', () => {
    // 30% of $1,047.50 is $314.25, rounded up to $315 per 273.10(e)(2)(ii)(A)(1).
    // The four-person maximum allotment is $994.
    const result = snapEligibility(facts, FY2026);
    expect(result.eligible).toBe(true);
    expect(result.monthlyBenefitCents).toBe(dollars(679));
    expect(result.annualValueCents).toBe(dollars(679 * 12));
  });
});

describe('SNAP eligibility tests', () => {
  it('skips the gross income test for a household with an elderly or disabled member', () => {
    // $2,000/month for one person is over the $1,696 gross limit but under the
    // $1,305 net limit once deductions apply, so the outcome turns on who is in it.
    const base = snapFacts({
      householdSize: 1,
      unearnedMonthlyCents: dollars(1800),
      shelterMonthlyCents: dollars(1200),
    });

    const younger = snapEligibility(base, FY2026);
    expect(younger.tests.find((t) => t.name === 'Gross income test')?.passed).toBe(false);
    expect(younger.eligible).toBe(false);

    const older = snapEligibility({ ...base, hasElderlyOrDisabledMember: true }, FY2026);
    expect(older.tests.find((t) => t.name === 'Gross income test')?.detail).toContain(
      'not applied'
    );
    expect(older.eligible).toBe(true);
  });

  it('does not cap the shelter deduction for a household with an elderly or disabled member', () => {
    const facts = snapFacts({
      householdSize: 1,
      unearnedMonthlyCents: dollars(1200),
      shelterMonthlyCents: dollars(1500),
      hasElderlyOrDisabledMember: true,
    });
    const capped = snapNetIncome({ ...facts, hasElderlyOrDisabledMember: false }, FY2026);
    const uncapped = snapNetIncome(facts, FY2026);
    expect(capped.shelterCapApplied).toBe(true);
    expect(uncapped.shelterCapApplied).toBe(false);
    expect(uncapped.netCents).toBeLessThan(capped.netCents);
  });

  it('applies the higher resource limit when a member is elderly or disabled', () => {
    const facts = snapFacts({
      householdSize: 1,
      unearnedMonthlyCents: dollars(900),
      countableResourcesCents: dollars(4000),
    });
    expect(snapEligibility(facts, FY2026).tests.find((t) => t.name === 'Resource test')?.passed).toBe(
      false
    );
    expect(
      snapEligibility({ ...facts, hasElderlyOrDisabledMember: true }, FY2026).tests.find(
        (t) => t.name === 'Resource test'
      )?.passed
    ).toBe(true);
  });

  it('skips the income and resource tests for a categorically eligible household', () => {
    const facts = snapFacts({
      householdSize: 2,
      unearnedMonthlyCents: dollars(5000),
      countableResourcesCents: dollars(50000),
      categoricallyEligible: true,
    });
    const result = snapEligibility(facts, FY2026);
    expect(result.decidedBy).toBe('categorical eligibility');
    expect(result.tests.every((t) => t.passed)).toBe(true);
  });

  it('pays the minimum allotment to a one-person household whose benefit computes lower', () => {
    // Net income high enough that 30% exceeds the $298 maximum allotment.
    const facts = snapFacts({ householdSize: 1, unearnedMonthlyCents: dollars(1300) });
    const result = snapEligibility(facts, FY2026);
    expect(result.eligible).toBe(true);
    expect(result.monthlyBenefitCents).toBe(dollars(24));
  });

  it('pays nothing to a larger household whose benefit computes at or below zero', () => {
    // Only a categorically eligible household can reach this state. A household taking
    // the ordinary route fails the net income test long before 30% of its net income
    // overtakes the maximum allotment, so passing the tests and being owed nothing is
    // something only the categorical route produces.
    const facts = snapFacts({
      householdSize: 3,
      unearnedMonthlyCents: dollars(3000),
      categoricallyEligible: true,
    });
    const result = snapEligibility(facts, FY2026);
    expect(result.tests.every((t) => t.passed)).toBe(true);
    expect(result.monthlyBenefitCents).toBe(0);
    expect(result.eligible).toBe(false);
  });

  it('takes the homeless shelter deduction instead of shelter costs', () => {
    const facts = snapFacts({
      householdSize: 1,
      earnedMonthlyCents: dollars(900),
      shelterMonthlyCents: dollars(100),
      allMembersHomeless: true,
    });
    const labels = snapNetIncome(facts, FY2026).steps.map((s) => s.label);
    expect(labels).toContain('Homeless shelter deduction');
    expect(labels).not.toContain('Excess shelter deduction');
  });
});

describe('EITC', () => {
  it('pays the published maximum at the earned income amount', () => {
    for (const [children, bracket] of Object.entries(TY2025.byChildren)) {
      const result = eitcCredit(
        eitcFacts({
          qualifyingChildren: Number(children),
          earnedAnnualCents: dollars(bracket.earnedIncomeAmount),
          agiAnnualCents: dollars(bracket.earnedIncomeAmount),
        }),
        TY2025
      );
      expect(result.annualValueCents).toBe(dollars(bracket.maxCredit));
    }
  });

  it('reaches zero at the published completed phase-out, in both tax years', () => {
    for (const table of [TY2025, TY2026]) {
      for (const [children, bracket] of Object.entries(table.byChildren)) {
        for (const status of ['joint', 'other'] as const) {
          const at = dollars(bracket.completedPhaseout[status]);
          const result = eitcCredit(
            eitcFacts({
              qualifyingChildren: Number(children),
              filingStatus: status,
              earnedAnnualCents: at,
              agiAnnualCents: at,
            }),
            table
          );
          expect(
            result.annualValueCents ?? 0,
            `${table.id} ${children} children ${status}`
          ).toBe(0);
        }
      }
    }
  });

  it('phases out on AGI when AGI is higher than earned income', () => {
    const earnedOnly = eitcCredit(
      eitcFacts({
        qualifyingChildren: 1,
        earnedAnnualCents: dollars(25000),
        agiAnnualCents: dollars(25000),
      }),
      TY2025
    );
    const higherAgi = eitcCredit(
      eitcFacts({
        qualifyingChildren: 1,
        earnedAnnualCents: dollars(25000),
        agiAnnualCents: dollars(40000),
      }),
      TY2025
    );
    expect(higherAgi.annualValueCents!).toBeLessThan(earnedOnly.annualValueCents!);
  });

  it('treats investment income as a cliff', () => {
    const facts = eitcFacts({
      qualifyingChildren: 2,
      earnedAnnualCents: dollars(20000),
      agiAnnualCents: dollars(20000),
    });
    const under = eitcCredit(
      { ...facts, investmentIncomeAnnualCents: dollars(TY2025.investmentIncomeLimit) },
      TY2025
    );
    const over = eitcCredit(
      { ...facts, investmentIncomeAnnualCents: dollars(TY2025.investmentIncomeLimit + 1) },
      TY2025
    );
    expect(under.eligible).toBe(true);
    expect(over.eligible).toBe(false);
    expect(over.decidedBy).toBe('the investment income limit');
  });

  it('applies the age rule only when there are no qualifying children', () => {
    const young = eitcFacts({
      claimantAge: 24,
      earnedAnnualCents: dollars(9000),
      agiAnnualCents: dollars(9000),
    });
    expect(eitcCredit(young, TY2025).eligible).toBe(false);
    expect(eitcCredit({ ...young, claimantAge: 25 }, TY2025).eligible).toBe(true);
    expect(eitcCredit({ ...young, claimantAge: 65 }, TY2025).eligible).toBe(false);
    expect(eitcCredit({ ...young, claimantAge: 64 }, TY2025).eligible).toBe(true);
    // With a qualifying child the age rule does not apply at all.
    expect(
      eitcCredit({ ...young, claimantAge: 20, qualifyingChildren: 1 }, TY2025).eligible
    ).toBe(true);
  });

  it('bars a married separate filer only when the separated-spouse rules are not met', () => {
    const facts = eitcFacts({
      qualifyingChildren: 1,
      earnedAnnualCents: dollars(20000),
      agiAnnualCents: dollars(20000),
    });
    expect(eitcCredit(facts, TY2025).eligible).toBe(true);
    expect(
      eitcCredit({ ...facts, marriedFilingSeparatelyIneligible: true }, TY2025).eligible
    ).toBe(false);
  });

  it('uses the tax year covering the date', () => {
    expect(eitcThresholdsFor('2025-12-31').taxYear).toBe(2025);
    expect(eitcThresholdsFor('2026-01-01').taxYear).toBe(2026);
  });
});

describe('Lifeline', () => {
  it('qualifies on income alone', () => {
    const limit = LIFELINE.annualIncomeLimitBySize['1'] as number;
    expect(lifelineEligibility(lifelineFacts({ annualIncomeCents: dollars(limit) }), LIFELINE).eligible).toBe(
      true
    );
    expect(
      lifelineEligibility(lifelineFacts({ annualIncomeCents: dollars(limit + 1) }), LIFELINE).eligible
    ).toBe(false);
  });

  it('qualifies on program participation regardless of income', () => {
    const result = lifelineEligibility(
      lifelineFacts({ annualIncomeCents: dollars(200000), programsReceived: ['snap'] }),
      LIFELINE
    );
    expect(result.eligible).toBe(true);
    expect(result.decidedBy).toBe('program participation');
  });

  it('counts Tribal programs only on Tribal lands, and pays the higher benefit there', () => {
    const facts = lifelineFacts({
      annualIncomeCents: dollars(200000),
      programsReceived: ['fdpir'],
    });
    expect(lifelineEligibility(facts, LIFELINE).eligible).toBe(false);
    const tribal = lifelineEligibility({ ...facts, onTribalLands: true }, LIFELINE);
    expect(tribal.eligible).toBe(true);
    expect(tribal.monthlyBenefitCents).toBe(dollars(34.25));
  });
});

describe('threshold selection', () => {
  it('picks the fiscal year covering the date', () => {
    expect(snapThresholdsFor('2026-09-30').id).toBe('snap-fy2026');
    expect(snapThresholdsFor('2026-10-01').id).toBe('snap-fy2027');
  });

  it('falls back to the last complete set when the covering set is partial', () => {
    const before = activeSnapSet('2026-09-30');
    expect(before.fellBack).toBe(false);
    expect(before.set.id).toBe('snap-fy2026');

    const after = activeSnapSet('2026-10-01');
    expect(after.requested.id).toBe('snap-fy2027');
    expect(after.set.id).toBe('snap-fy2026');
    expect(after.fellBack).toBe(true);
    expect(after.notice).toContain('understated');
  });

  it('refuses to decide anything from a partial set', () => {
    const partial = snapThresholdsFor('2026-10-01');
    expect(() =>
      snapEligibility(snapFacts({ householdSize: 1, unearnedMonthlyCents: dollars(500) }), partial)
    ).toThrow(/partial threshold set/);
  });

  it('extends a size table past its last listed row by the published increment', () => {
    expect(bySize(FY2026.netLimitBySize, 8)).toBe(4513);
    expect(bySize(FY2026.netLimitBySize, 9)).toBe(4513 + 459);
    expect(bySize(FY2026.netLimitBySize, 12)).toBe(4513 + 459 * 4);
  });
});
