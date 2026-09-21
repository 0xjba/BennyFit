/**
 * Limits on the public demo, so a script cannot run up the engine bill or crowd out
 * real visitors.
 *
 * Two limits, both counted in requests to the screening route (one request is one pass
 * of the loop: the first reading, or one answered follow-up):
 *
 *   - per visitor, a sliding window: enough for a person to try several households
 *     with follow-ups, not enough for a loop;
 *   - overall, a daily ceiling, a hard stop on spend whatever the traffic.
 *
 * The counts live in memory, so each server instance keeps its own. On a single
 * server that is exact. On a platform that runs several instances the per-visitor
 * limit is looser by the number of instances, and the daily ceiling is per instance;
 * a shared store (Redis or similar) would make both exact, and is the next step if
 * traffic warrants it. At about $0.0002 of engine time per request, even the loose
 * case is cheap: the ceiling below is roughly a dollar a day per instance.
 */

export interface RateLimitConfig {
  /** Requests one visitor may make within the window. */
  perVisitor: number;
  windowMs: number;
  /** Requests all visitors together may make in a UTC day. */
  perDay: number;
}

export const DEFAULT_LIMITS: RateLimitConfig = {
  perVisitor: Number(process.env.RATE_LIMIT_PER_VISITOR) || 30,
  windowMs: (Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 10) * 60_000,
  perDay: Number(process.env.RATE_LIMIT_PER_DAY) || 5000,
};

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: 'visitor' | 'daily'; retryAfterSeconds: number };

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private day = '';
  private dayCount = 0;

  constructor(private readonly config: RateLimitConfig = DEFAULT_LIMITS) {}

  check(visitor: string, now: number = Date.now()): RateLimitResult {
    const today = new Date(now).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.dayCount = 0;
    }
    if (this.dayCount >= this.config.perDay) {
      const midnight = Date.parse(`${today}T00:00:00Z`) + 86_400_000;
      return { allowed: false, reason: 'daily', retryAfterSeconds: Math.ceil((midnight - now) / 1000) };
    }

    const since = now - this.config.windowMs;
    const recent = (this.hits.get(visitor) ?? []).filter((t) => t > since);
    if (recent.length >= this.config.perVisitor) {
      this.hits.set(visitor, recent);
      return {
        allowed: false,
        reason: 'visitor',
        retryAfterSeconds: Math.ceil((recent[0] + this.config.windowMs - now) / 1000),
      };
    }

    recent.push(now);
    this.hits.set(visitor, recent);
    this.dayCount++;
    // Forget visitors who have gone quiet, so the map does not grow without bound.
    if (this.hits.size > 10_000) {
      for (const [key, times] of this.hits) if (times.every((t) => t <= since)) this.hits.delete(key);
    }
    return { allowed: true, remaining: this.config.perVisitor - recent.length };
  }
}

/**
 * Who is asking, as far as a server behind a proxy can tell. The first address in
 * x-forwarded-for is the client on the common hosts; it can be forged where no proxy
 * sets it, which is one more reason the daily ceiling exists.
 */
export function visitorOf(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

/** One limiter per server instance, shared by every request it handles. */
export const screeningLimiter = new RateLimiter();

export function limitMessage(result: Extract<RateLimitResult, { allowed: false }>): string {
  const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
  return result.reason === 'visitor'
    ? `That is a lot of screenings in a short time. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
    : 'The demo has reached its limit for today. Please try again tomorrow.';
}
