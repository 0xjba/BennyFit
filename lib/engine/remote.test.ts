import { describe, expect, it } from 'vitest';

import { normaliseAnswer } from './remote';

// The answer bodies below are copied from TypeSafe's API reference
// (docs.typesafe.ai/api, read 2026-09-21), so a change in the documented shape
// shows up here before it shows up as an unreadable live answer.
describe('reading answers in the documented shape', () => {
  it('reads a noul as a two-option distribution', () => {
    const a = normaliseAnswer({ type: 'noul', noul: 0.95 } as never, ['true', 'false']);
    expect(a.choice).toBe('true');
    expect(a.probabilities.true).toBeCloseTo(0.95);
    expect(a.probabilities.false).toBeCloseTo(0.05);
  });

  it('reads a choice and recomputes confidence from its probabilities', () => {
    const a = normaliseAnswer(
      {
        type: 'choice',
        choice: 'billing',
        probabilities: { billing: 0.88, technical: 0.12, sales: 0.0 },
        confidence: 0.81,
      } as never,
      ['billing', 'technical', 'sales']
    );
    expect(a.choice).toBe('billing');
    // TypeSafe's 0.81 is (K * max p - 1) / (K - 1). Ours is normalised entropy, so
    // the two differ, and ours is the one every threshold in the system is set on.
    expect(a.confidence).not.toBeCloseTo(0.81, 2);
    expect(a.confidence).toBeGreaterThan(0.5);
  });

  it('fills options the engine left out with zero', () => {
    const a = normaliseAnswer({ type: 'choice', choice: 'a', probabilities: { a: 1 } } as never, ['a', 'b']);
    expect(a.probabilities.b).toBe(0);
  });
});
