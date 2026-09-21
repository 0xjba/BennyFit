import { describe, expect, it } from 'vitest';

import type { EngineClient, EngineRequest } from './engine/types';
import { findMoneyCandidates, readHousehold } from './read';

/** An engine that answers each reading question from a fixed table. */
function stub(answers: Record<string, string>): EngineClient {
  return {
    name: 'stub',
    isFixture: false,
    async ask(request: EngineRequest) {
      const out: Record<string, { choice: string; probabilities: Record<string, number>; confidence: number }> = {};
      for (const [id, q] of Object.entries(request.questions)) {
        const options = Array.isArray(q.criteria) ? q.criteria : Object.keys(q.criteria);
        const choice = answers[id] ?? (options.includes('not_stated') ? 'not_stated' : options.includes('other') ? 'other' : options[0]);
        out[id] = { choice, probabilities: Object.fromEntries(options.map((o) => [o, o === choice ? 1 : 0])), confidence: 1 };
      }
      return { model: 'stub', answers: out, usage: { inputTokens: 0, outputTokens: 0 }, elapsedMs: 0 };
    },
  };
}

describe('finding candidate amounts', () => {
  it('over-finds money but not ages, counts or years', () => {
    const spans = findMoneyCandidates('I am 36 with 2 kids aged 4 and 8, born 1990. I make 45k a year, rent is 900 for rent, $1,200 saved.').map((c) => c.value);
    expect(spans).toEqual([45000, 900, 1200]);
  });

  it('reads a range as one amount at its midpoint', () => {
    expect(findMoneyCandidates('I make maybe $300-$400 a week.').map((c) => c.value)).toEqual([350]);
  });
});

describe('combining the engine answers', () => {
  const text = 'I get paid $480 every Friday and my rent is $1,100. Me and my two kids in Maine.';

  it('takes the amount and period the engine picks, and copies the number from the text', async () => {
    const r = await readHousehold(
      text,
      stub({ 'read.role.amount_1': 'income', 'read.period.amount_1': 'weekly', 'read.role.amount_2': 'housing', 'read.period.amount_2': 'monthly', 'read.household_size': '3', 'read.children': '2' })
    );
    expect(r.facts.incomeAmount).toBe(480);
    expect(r.facts.incomePeriod).toBe('weekly');
    expect(r.facts.rentMonthly).toBe(1100);
    expect(r.facts.householdSize).toBe(3);
  });

  it('asks for the household size when code and engine count differently', async () => {
    const r = await readHousehold(text, stub({ 'read.household_size': '4', 'read.children': '2' }));
    expect(r.facts.householdSize).toBeNull();
    expect(r.missing).toContain('householdSize');
  });

  it('adds two incomes up as a month', async () => {
    const r = await readHousehold(
      'He makes $2,600 a month and I make $1,900 a month.',
      stub({ 'read.role.amount_1': 'income', 'read.period.amount_1': 'monthly', 'read.role.amount_2': 'income', 'read.period.amount_2': 'monthly' })
    );
    expect(r.facts.incomeAmount).toBe(4500);
    expect(r.facts.incomePeriod).toBe('monthly');
  });

  it('reads twice a month as 24 paychecks a year', async () => {
    const r = await readHousehold(
      'Paid $1,350 on the 1st and the 15th.',
      stub({ 'read.role.amount_1': 'income', 'read.period.amount_1': 'twice_monthly' })
    );
    expect(r.facts.incomeAmount).toBe(1350);
    expect(r.facts.incomePeriod).toBe('semimonthly');
  });
});
