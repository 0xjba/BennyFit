import { describe, expect, it } from 'vitest';

import { balancedByProgram, meanEstimable } from './balanced';

describe('balanced accuracy', () => {
  const rows = [
    { slice: 'x', predicted: { a: true, b: false }, truth: { a: true, b: false } },
    { slice: 'x', predicted: { a: true, b: false }, truth: { a: false, b: false } },
  ];

  it('is the mean of the true-positive and true-negative rates', () => {
    expect(balancedByProgram(rows, ['a']).a).toBeCloseTo(0.5);
  });

  it('is not estimable, not 100%, when a program has no eligible household', () => {
    expect(balancedByProgram(rows, ['b']).b).toBeNull();
    expect(meanEstimable(balancedByProgram(rows, ['a', 'b']))).toEqual({ mean: 0.5, programs: 1 });
  });
});
