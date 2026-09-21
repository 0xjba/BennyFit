import { describe, expect, it } from 'vitest';

import { MockEngine } from './engine';
import { HERO_FIGURES, HERO_TEXT } from './hero';
import { screenStep } from './loop';

describe('the landing page household', () => {
  it('shows what the screener returns for it', async () => {
    const step = await screenStep(HERO_TEXT, [], { engine: new MockEngine(), asOf: '2026-09-21' } as never);
    const verdicts = Object.values(step.verdicts) as { eligible: boolean; annualValueCents?: number }[];
    const eligible = verdicts.filter((v) => v.eligible);
    const dollars = Math.round(eligible.reduce((sum, v) => sum + (v.annualValueCents ?? 0), 0) / 100);

    expect(eligible.length).toBe(HERO_FIGURES.programs);
    expect(dollars).toBe(HERO_FIGURES.annualDollars);
    expect(step.criteria.length).toBe(HERO_FIGURES.rulesChecked);
  });
});
