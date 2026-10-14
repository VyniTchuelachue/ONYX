import type { Specialty } from './constants';
import { haversineKm } from './domain/geo';
import type { GeoPoint, Technician, TechnicianWithDistance, Timestamp } from './types';

/** Technicians saved on the device for use without a connection. */
export interface OfflinePack {
  version: 1;
  savedAt: Timestamp;
  center: GeoPoint;
  radiusKm: number;
  technicians: Technician[];
}

export interface StoredLocation extends GeoPoint {
  accuracy: number | null;
  at: Timestamp;
}

export function buildOfflinePack(technicians: Technician[], center: GeoPoint, radiusKm: number): OfflinePack {
  return { version: 1, savedAt: new Date().toISOString(), center, radiusKm, technicians };
}

export function parseOfflinePack(raw: string | null): OfflinePack | null {
  if (!raw) return null;
  try {
    const pack = JSON.parse(raw) as OfflinePack;
    return pack?.version === 1 && Array.isArray(pack.technicians) ? pack : null;
  } catch {
    return null;
  }
}

/** Sort saved technicians by distance from where the driver is (or was last seen). */
export function rankOffline(
  technicians: Technician[],
  from: GeoPoint,
  opts: { specialty?: Specialty | null; favorites?: string[]; query?: string } = {},
): TechnicianWithDistance[] {
  const q = opts.query?.trim().toLowerCase();
  const favorites = new Set(opts.favorites ?? []);
  return technicians
    .filter((t) => !opts.specialty || t.specialties.includes(opts.specialty))
    .filter(
      (t) =>
        !q ||
        t.businessName.toLowerCase().includes(q) ||
        t.area.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q),
    )
    .map((t) => ({ ...t, distanceKm: haversineKm(from, t.location) }))
    .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || a.distanceKm - b.distanceKm);
}

/** A pack older than this is refreshed in the background whenever the device is online. */
export const OFFLINE_PACK_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function isPackStale(pack: OfflinePack | null, now: Date = new Date()): boolean {
  return !pack || now.getTime() - new Date(pack.savedAt).getTime() > OFFLINE_PACK_MAX_AGE_MS;
}
