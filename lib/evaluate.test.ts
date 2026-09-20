import { describe, expect, it } from 'vitest';

import { MockEngine } from './engine/mock';
import { screenStep } from './loop';

const AS_OF = '2026-09-21';

async function screenOnce(paragraph: string) {
  return screenStep(paragraph, [], { engine: new MockEngine(), asOf: AS_OF });
}

describe('a household is told what actually barred it', () => {
  it('does not blame the separated-spouse rules for a household with no earned income', async () => {
    const step = await screenOnce(
      "I'm 68 and I live alone in Ohio. I get $1,100 a month from Social Security. Rent is $650."
    );
    const eitc = step.verdicts['eitc'];

    expect(eitc.eligible).toBe(false);
    // The filing status test must not claim a married separate filer failed rules that
    // were never in play. Any disqualifier used to set the same flag, so a retiree was
    // told they were barred as a married separate filer.
    const filing = eitc.tests.find((t) => t.name === 'Filing status');
    expect(filing?.passed).toBe(true);
    expect(JSON.stringify(eitc.tests)).not.toContain('married filing separately');
  });
});

describe('the parser owns the income period', () => {
  it('keeps a weekly figure weekly, whatever the engine says about the period', async () => {
    const weekly = await screenOnce(
      'I work and make $430 a week. I have two kids, rent is $1,200 a month.'
    );
    const monthly = await screenOnce(
      'I work and make $430 a month. I have two kids, rent is $1,200 a month.'
    );

    expect(weekly.parse.facts.incomePeriod).toBe('weekly');
    expect(monthly.parse.facts.incomePeriod).toBe('monthly');

    // $430 a week is roughly $1,863 a month, so the two must not agree. If the engine
    // were allowed to overrule a period the description stated in plain words, a
    // household's income could be understated more than fourfold.
    const weeklySnap = weekly.verdicts['snap'].annualValueCents ?? 0;
    const monthlySnap = monthly.verdicts['snap'].annualValueCents ?? 0;
    expect(weeklySnap).toBeLessThan(monthlySnap);
  });
});

describe('one answer can settle two programs', () => {
  it('qualifies Lifeline through the SNAP eligibility found in the same pass', async () => {
    const step = await screenOnce(
      "I'm 71, live alone in Georgia, and get $980 a month from Social Security. Rent is $600 and I pay my own electric."
    );

    expect(step.verdicts['snap'].eligible).toBe(true);
    expect(step.verdicts['lifeline'].eligible).toBe(true);
    expect(step.verdicts['lifeline'].notes.join(' ')).toContain('SNAP eligibility found');
  });
});

describe('every criterion is resolved in one pass', () => {
  it('answers every instantiated criterion, and instantiates per child', async () => {
    const step = await screenOnce(
      'I am 30, I live in Ohio with my three kids, I make $1,500 a month, and rent is $900.'
    );
    for (const criterion of step.criteria) {
      expect(step.answers[criterion.instanceId], criterion.instanceId).toBeDefined();
    }
    // Child-scoped criteria appear once per child rather than once per household.
    const residency = step.criteria.filter((c) => c.id === 'eitc.child_residency');
    expect(residency.length).toBe(3);
  });
});
