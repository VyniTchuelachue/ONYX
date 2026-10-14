import { config } from '@/lib/config';
import { aiConfigured } from '@/server/assistant';
import { pushConfigured } from '@/server/push';

export function GET() {
  return Response.json(
    { ok: true, backend: config.mode, assistant: aiConfigured() ? 'ai' : 'offline-guide', alerts: pushConfigured() ? 'on' : 'off' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
