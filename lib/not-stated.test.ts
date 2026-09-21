import { describe, expect, it } from 'vitest';

import { foldNotStated } from './not-stated';

describe('the not-stated escape hatch', () => {
  it('keeps the lean among real options but makes the answer unsure', () => {
    const a = foldNotStated({
      choice: 'not_stated',
      probabilities: { earned: 0.1, unearned: 0.2, mixed: 0, none: 0, not_stated: 0.7 },
      confidence: 0.5,
    });
    expect(a.choice).toBe('unearned');
    expect(a.probabilities.not_stated).toBeUndefined();
    expect(a.probabilities.unearned).toBeCloseTo(2 / 3);
    expect(a.confidence).toBeLessThanOrEqual(0.3 + 1e-9);
  });

  it('leaves a stated answer as it was', () => {
    const a = foldNotStated({ choice: 'earned', probabilities: { earned: 0.97, unearned: 0.01, not_stated: 0.02 }, confidence: 0.9 });
    expect(a.choice).toBe('earned');
    expect(a.confidence).toBeGreaterThan(0.8);
  });
});
