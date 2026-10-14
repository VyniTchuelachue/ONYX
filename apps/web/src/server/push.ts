import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { LOCALES, pushMessage, type IssueCategory, type Locale, type PushTarget, type RequestEventType, type UserRole } from '@onyx/core';
import { config } from '@/lib/config';

const hookSecret = process.env.PUSH_HOOK_SECRET ?? '';
// The Supabase secret key (formerly "service role"): server-only, reads who to alert.
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const vapid = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  subject: process.env.VAPID_SUBJECT || 'mailto:contact@onyx.cm',
};

export function pushConfigured(): boolean {
  return config.mode === 'supabase' && hookSecret.length >= 32 && !!secretKey && !!vapid.publicKey && !!vapid.privateKey;
}

/** Only the database hook knows the shared secret. Compared in constant time. */
export function hookAuthorized(req: Request): boolean {
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${hookSecret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

interface TargetRow {
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
  audience: 'driver' | 'technician';
  event_type: RequestEventType;
  actor_role: UserRole | null;
  request_id: string;
  request_code: string;
  category: IssueCategory;
  place_label: string | null;
  distance_km: number | null;
  is_direct: boolean;
  technician_name: string | null;
  amount: number | null;
  rating: number | null;
}

function toTarget(row: TargetRow): PushTarget {
  return {
    locale: (LOCALES as readonly string[]).includes(row.locale) ? (row.locale as Locale) : 'fr',
    audience: row.audience,
    eventType: row.event_type,
    actorRole: row.actor_role,
    requestId: row.request_id,
    requestCode: row.request_code,
    category: row.category,
    placeLabel: row.place_label,
    distanceKm: row.distance_km,
    isDirect: row.is_direct,
    technicianName: row.technician_name,
    amount: row.amount,
    rating: row.rating,
  };
}

let admin: SupabaseClient | null = null;
let vapidSet = false;

/** Sends the alerts for one request event. Subscriptions the browser has dropped are deleted. */
export async function dispatchEvent(eventId: number): Promise<{ sent: number; removed: number; failed: number }> {
  admin ??= createClient(config.supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!vapidSet) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    vapidSet = true;
  }

  const { data, error } = await admin.rpc('push_targets', { p_event_id: eventId });
  if (error) throw new Error(`push_targets: ${error.message}`);

  const gone: string[] = [];
  let sent = 0;
  let failed = 0;
  await Promise.all(
    ((data ?? []) as TargetRow[]).map(async (row) => {
      const message = pushMessage(toTarget(row));
      if (!message) return;
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify({ title: message.title, body: message.body, url: message.url, tag: message.tag, lang: row.locale }),
          { TTL: message.ttl, urgency: message.urgency, timeout: 8000 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: the person uninstalled the app or revoked permission on that device.
        if (status === 404 || status === 410) gone.push(row.subscription_id);
        else failed++;
      }
    }),
  );
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone);
  return { sent, removed: gone.length, failed };
}
