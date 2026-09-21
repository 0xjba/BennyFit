import { describe, expect, it } from 'vitest';

import { MockEngine } from './engine';
import { screenStep, sizeFromReply } from './loop';
import { DEFAULT_MIN_EXPECTED_CENTS } from './voi';

const step = (text: string) => screenStep(text, [], { engine: new MockEngine(), asOf: '2026-09-21' } as never);

describe('choosing the next question', () => {
  it('does not ask a 30-year-old about wartime service', async () => {
    // The Veterans Pension needs the veteran to be 65 or older, or disabled or on
    // SSDI or SSI. Without that test every household looked like a possible $17,000
    // a year, and the question topped the list for everyone.
    const s = await step('I am 30 and live alone in Ohio. I make $1,400 a month at a warehouse. Rent is $700.');
    const asked = s.next?.criterion.id;
    expect(asked).not.toBe('va_pension.wartime_veteran');
  });

  it('never asks a question worth less than the floor', async () => {
    for (const text of [
      'I work part time and make $430 a week. I have two kids aged 4 and 8, we live in Michigan, rent is $1,200 a month, and daycare costs $300.',
      "I'm 71, live alone in Ohio, get about $1,150 a month from Social Security, and I'm on Medicare. Rent is $700.",
    ]) {
      const s = await step(text);
      if (s.next) expect(s.next.voi.expectedCents).toBeGreaterThanOrEqual(DEFAULT_MIN_EXPECTED_CENTS);
    }
  });

  it('weighs a question by how likely each answer is, not only by the best and worst case', async () => {
    const s = await step('I work part time and make $430 a week. I have two kids aged 4 and 8, we live in Michigan, rent is $1,200 a month.');
    if (s.next) expect(s.next.voi.expectedCents).toBeLessThanOrEqual(s.next.voi.spreadCents);
  });
});

describe('a household size nobody could read', () => {
  const text = 'Retired veteran in Virginia, 72 years old, about $1,600 a month from VA and Social Security combined, rent $800.';

  it('is asked first, instead of silently becoming one person', async () => {
    const s = await step(text);
    expect(s.parse.facts.householdSize).toBeNull();
    expect(s.next?.criterion.instanceId).toBe('household.size');
  });

  it('takes the number from the reply', async () => {
    const s = await screenStep(text, [{ instanceId: 'household.size', question: '', reply: 'Two of us, me and my wife.' }], {
      engine: new MockEngine(),
      asOf: '2026-09-21',
    } as never);
    expect(s.parse.facts.householdSize).toBe(2);
    expect(s.next?.criterion.instanceId).not.toBe('household.size');
  });
});

describe('reading a size from a reply', () => {
  it('handles digits and words', () => {
    expect(sizeFromReply('4')).toBe(4);
    expect(sizeFromReply('There are five of us')).toBe(5);
    expect(sizeFromReply('just me')).toBe(1);
    expect(sizeFromReply('not sure')).toBeNull();
  });
});
