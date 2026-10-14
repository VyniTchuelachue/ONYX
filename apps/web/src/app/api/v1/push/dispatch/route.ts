import { dispatchEvent, hookAuthorized, pushConfigured } from '@/server/push';

// web-push signs and encrypts with Node's crypto module.
export const runtime = 'nodejs';

/**
 * POST /api/v1/push/dispatch — called by the database (pg_net) after each request event.
 * Body: { eventId }. Authorization: Bearer <PUSH_HOOK_SECRET>.
 */
export async function POST(req: Request) {
  if (!pushConfigured()) return Response.json({ error: 'not_configured' }, { status: 503 });
  if (!hookAuthorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const eventId = Number((body as { eventId?: unknown } | null)?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) return Response.json({ error: 'validation' }, { status: 400 });

  try {
    const result = await dispatchEvent(eventId);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[push] dispatch failed', e);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
}
