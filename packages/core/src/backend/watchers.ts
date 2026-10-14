import type { Locale } from '../constants';
import { isActive } from '../domain/status';
import type { PushTarget } from '../notifications';
import type { OnyxBackend } from './types';

/**
 * In-app alert sources for when no push server is involved (the demo, or an app in the
 * foreground). Each `next()` returns what happened since the previous call; the first call
 * only takes stock, so nothing that already existed is announced.
 */
export interface AlertWatcher {
  next(): Promise<PushTarget[]>;
}

/** Technician: requests that appeared in the inbox. */
export function watchOffers(backend: OnyxBackend, locale: Locale): AlertWatcher {
  const known = new Set<string>();
  let primed = false;
  return {
    async next() {
      const fresh = (await backend.pro.inbox()).filter((item) => !known.has(item.id));
      fresh.forEach((item) => known.add(item.id));
      const targets = primed
        ? fresh.map(
            (item): PushTarget => ({
              locale,
              audience: 'technician',
              eventType: 'created',
              actorRole: 'driver',
              requestId: item.id,
              requestCode: item.code,
              category: item.category,
              placeLabel: item.placeLabel,
              distanceKm: item.distanceKm,
              isDirect: item.isDirect,
              technicianName: null,
              amount: null,
              rating: null,
            }),
          )
        : [];
      primed = true;
      return targets;
    },
  };
}

/** Driver: steps the technician took on the driver's requests. */
export function watchMyRequests(backend: OnyxBackend, locale: Locale): AlertWatcher {
  const seen = new Map<string, number>(); // request id → events already seen
  let primed = false;
  return {
    async next() {
      const targets: PushTarget[] = [];
      for (const item of await backend.requests.listMine()) {
        // Follow open requests, plus the last step of one that has just ended.
        if (!isActive(item.status) && !seen.has(item.id)) continue;
        const detail = await backend.requests.get(item.id);
        if (!detail) continue;
        if (primed) {
          for (const event of detail.events.slice(seen.get(item.id) ?? 0)) {
            if (event.actorRole === 'driver') continue;
            const total = event.data?.total;
            const named = event.data?.technicianName;
            targets.push({
              locale,
              audience: 'driver',
              eventType: event.type,
              actorRole: event.actorRole,
              requestId: item.id,
              requestCode: detail.request.code,
              category: detail.request.category,
              placeLabel: detail.request.placeLabel,
              distanceKm: null,
              isDirect: false,
              technicianName: detail.technician?.businessName ?? (typeof named === 'string' ? named : null),
              amount: typeof total === 'number' ? total : null,
              rating: null,
            });
          }
        }
        if (isActive(detail.request.status)) seen.set(item.id, detail.events.length);
        else seen.delete(item.id);
      }
      primed = true;
      return targets;
    },
  };
}
