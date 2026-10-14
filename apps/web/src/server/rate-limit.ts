import 'server-only';

/**
 * Sliding-window limiter kept in memory. Good enough for one server instance; with several
 * instances (serverless scale-out) move the counters to a shared store such as Upstash Redis.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0]!)) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    // Drop the oldest keys so memory stays bounded.
    for (const k of Array.from(hits.keys()).slice(0, 2_000)) hits.delete(k);
  }
  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'local';
}
