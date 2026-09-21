import { describe, expect, it } from 'vitest';

import { MockEngine } from './engine';
import { screenStep } from './loop';
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
