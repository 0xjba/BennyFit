import { describe, expect, it } from 'vitest';

import { eitcPhaseOutRate } from './compute';
import { eitcThresholdsFor } from './thresholds';

/**
 * The credit is computed with the phase-out rate implied by the published endpoints
 * rather than the statutory rate, so that it reaches exactly zero at exactly the
 * published completed phase-out amount. That is only safe while the two agree.
 *
 * These checks fail if a published table is ever transcribed wrongly, or if a future
 * revenue procedure changes the rates.
 */
describe('the published EITC tables agree with the statutory rates', () => {
  const tables = [eitcThresholdsFor('2025-06-01'), eitcThresholdsFor('2026-06-01')];

  it('implies a phase-out rate within 0.01 percentage points of the statutory one', () => {
    for (const t of tables) {
      for (const [children, bracket] of Object.entries(t.byChildren)) {
        for (const status of ['joint', 'other'] as const) {
          const implied = eitcPhaseOutRate(bracket, status);
          expect(
            Math.abs(implied - bracket.phaseOutRate),
            `${t.id} ${children} children ${status}: implied ${implied}, statutory ${bracket.phaseOutRate}`
          ).toBeLessThan(0.0001);
        }
      }
    }
  });

  it('pays a maximum credit equal to the phase-in rate times the earned income amount', () => {
    for (const t of tables) {
      for (const [children, bracket] of Object.entries(t.byChildren)) {
        const computed = bracket.earnedIncomeAmount * bracket.phaseInRate;
        expect(
          Math.abs(computed - bracket.maxCredit),
          `${t.id} ${children} children: ${computed} against a published ${bracket.maxCredit}`
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it('places the joint threshold above the threshold for other filing statuses', () => {
    for (const t of tables) {
      for (const bracket of Object.values(t.byChildren)) {
        expect(bracket.thresholdPhaseout.joint).toBeGreaterThan(bracket.thresholdPhaseout.other);
        expect(bracket.completedPhaseout.joint).toBeGreaterThan(bracket.completedPhaseout.other);
      }
    }
  });
});
