import { assistantRequestSchema } from '@onyx/core';
import { answer } from '@/server/assistant';
import { clientKey, rateLimit } from '@/server/rate-limit';

/**
 * POST /api/v1/assistant — roadside triage.
 * Versioned and token-friendly (Authorization: Bearer <Supabase access token>) so the
 * future mobile app can call it exactly like the web app does.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`assistant:${clientKey(req)}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > 64_000) return Response.json({ error: 'too_large' }, { status: 413 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'validation' }, { status: 400 });
  if (parsed.data.messages[0]?.role !== 'user') return Response.json({ error: 'validation' }, { status: 400 });

  const result = await answer(parsed.data);
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
