import { AVAILABILITY_STALE_AFTER_MS } from '../constants';
import type { Technician } from '../types';

/**
 * What we can honestly tell a driver about a technician right now.
 * - `unconfirmed`: marked available, but the technician hasn't opened ONYX for a while.
 * - `unverified`: read from the offline pack; we can't know the live status.
 */
export type DisplayAvailability = 'available' | 'busy' | 'offline' | 'unconfirmed' | 'unverified';

export function effectiveAvailability(
  t: Pick<Technician, 'availability' | 'lastSeenAt' | 'availabilityUpdatedAt'>,
  now: Date = new Date(),
  opts: { offline?: boolean } = {},
): DisplayAvailability {
  if (opts.offline) return 'unverified';
  if (t.availability !== 'available') return t.availability;
  const seen = t.lastSeenAt ?? t.availabilityUpdatedAt;
  const age = now.getTime() - new Date(seen).getTime();
  return age > AVAILABILITY_STALE_AFTER_MS ? 'unconfirmed' : 'available';
}

/** Sort weight: available technicians first, then unconfirmed, busy, offline. */
export function availabilityRank(a: DisplayAvailability): number {
  switch (a) {
    case 'available':
      return 0;
    case 'unconfirmed':
    case 'unverified':
      return 1;
    case 'busy':
      return 2;
    case 'offline':
      return 3;
  }
}
