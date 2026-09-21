import { describe, expect, it } from 'vitest';

import { RateLimiter, limitMessage, visitorOf } from './rate-limit';

describe('rate limits', () => {
  it('lets a visitor through up to the limit, then says when to come back', () => {
    const limiter = new RateLimiter({ perVisitor: 3, windowMs: 60_000, perDay: 100 });
    const t = Date.parse('2026-09-21T12:00:00Z');
    expect(limiter.check('a', t).allowed).toBe(true);
    expect(limiter.check('a', t + 1).allowed).toBe(true);
    expect(limiter.check('a', t + 2).allowed).toBe(true);
    const blocked = limiter.check('a', t + 3);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toBe('visitor');
      expect(blocked.retryAfterSeconds).toBe(60);
      expect(limitMessage(blocked)).toMatch(/1 minute/);
    }
    // Another visitor is unaffected, and the first is let back in once the window passes.
    expect(limiter.check('b', t + 3).allowed).toBe(true);
    expect(limiter.check('a', t + 60_001).allowed).toBe(true);
  });

  it('stops everyone at the daily ceiling, and resets at midnight UTC', () => {
    const limiter = new RateLimiter({ perVisitor: 100, windowMs: 60_000, perDay: 2 });
    const t = Date.parse('2026-09-21T23:00:00Z');
    limiter.check('a', t);
    limiter.check('b', t);
    const blocked = limiter.check('c', t);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.reason).toBe('daily');
    expect(limiter.check('c', Date.parse('2026-09-22T00:00:01Z')).allowed).toBe(true);
  });

  it('reads the client address from the proxy header', () => {
    expect(visitorOf(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(visitorOf(new Headers())).toBe('unknown');
  });
});
