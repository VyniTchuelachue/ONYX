import type { CorridorId, Locale } from '../constants';
import type { GeoPoint } from '../types';
import { ALL_PLACES, CORRIDORS, DOUALA_QUARTERS, type Place } from './places';

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function isValidPoint(p: unknown): p is GeoPoint {
  if (!p || typeof p !== 'object') return false;
  const { lat, lng } = p as GeoPoint;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Box that fully contains the circle; used to pre-filter with an index before exact distances. */
export function boundingBox(center: GeoPoint, radiusKm: number): BoundingBox {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(0.01, Math.cos(toRad(center.lat))));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Distance from a point to a segment, using a local equirectangular projection (accurate at road scale). */
export function distanceToSegmentKm(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const kx = 111.32 * Math.cos(toRad(p.lat));
  const ky = 110.57;
  const ax = (a.lng - p.lng) * kx;
  const ay = (a.lat - p.lat) * ky;
  const bx = (b.lng - p.lng) * kx;
  const by = (b.lat - p.lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt(cx * cx + cy * cy);
}

export function distanceToPolylineKm(p: GeoPoint, line: GeoPoint[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversineKm(p, line[0]!);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    best = Math.min(best, distanceToSegmentKm(p, line[i]!, line[i + 1]!));
  }
  return best;
}

export function nearestPlace(p: GeoPoint, places: Place[] = ALL_PLACES): { place: Place; distanceKm: number } | null {
  let best: { place: Place; distanceKm: number } | null = null;
  for (const place of places) {
    const d = haversineKm(p, place);
    if (!best || d < best.distanceKm) best = { place, distanceKm: d };
  }
  return best;
}

/** How far outside Douala's quarters a point must be before we treat it as "on the road". */
const CITY_RADIUS_KM = 6;
/** Buffer around a corridor polyline. */
const CORRIDOR_BUFFER_KM = 12;

export interface LocationContext {
  /** "Ndokoti", "Edéa"… */
  label: string;
  city: string;
  inDouala: boolean;
  corridor: CorridorId | null;
  /** Distance to the named place, km. */
  distanceKm: number;
}

/** Describe a point the way a driver would: nearest quarter in Douala, or road + nearest town outside it. */
export function describeLocation(p: GeoPoint): LocationContext {
  const quarter = nearestPlace(p, DOUALA_QUARTERS);
  if (quarter && quarter.distanceKm <= CITY_RADIUS_KM) {
    return { label: quarter.place.name, city: 'Douala', inDouala: true, corridor: null, distanceKm: quarter.distanceKm };
  }
  const corridor = nearestCorridor(p);
  const near = nearestPlace(p) ?? quarter;
  return {
    label: near?.place.name ?? '',
    city: near?.place.city ?? '',
    inDouala: false,
    corridor,
    distanceKm: near?.distanceKm ?? Infinity,
  };
}

export function nearestCorridor(p: GeoPoint, bufferKm = CORRIDOR_BUFFER_KM): CorridorId | null {
  let best: { id: CorridorId; d: number } | null = null;
  for (const c of CORRIDORS) {
    const d = distanceToPolylineKm(p, c.path);
    if (d <= bufferKm && (!best || d < best.d)) best = { id: c.id, d };
  }
  return best?.id ?? null;
}

/** Language-neutral label stored on a request: "Ndokoti, Douala" or "Edéa (N3)" (nearest town). */
export function placeLabelFor(p: GeoPoint): string {
  const ctx = describeLocation(p);
  if (ctx.inDouala) return `${ctx.label}, Douala`;
  const road = ctx.corridor ? CORRIDORS.find((c) => c.id === ctx.corridor)?.road : null;
  return road ? `${ctx.label} (${road})` : ctx.label;
}

/**
 * Rough travel time for a technician to reach the driver. Douala traffic averages
 * well under 20 km/h at peak; intercity roads are faster but degraded in places.
 */
export function estimateEtaMinutes(distanceKm: number): number {
  const prep = 5;
  if (distanceKm <= 10) return Math.round(prep + (distanceKm / 18) * 60);
  const city = (10 / 18) * 60;
  const road = ((distanceKm - 10) / 45) * 60;
  return Math.round(prep + city + road);
}

// A non-breaking space keeps a number on the same line as its unit.
const NBSP = ' ';

export function formatDistance(km: number, locale: Locale): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)}${NBSP}m`;
  const value = km < 10 ? km.toFixed(1) : Math.round(km).toString();
  return `${locale === 'fr' ? value.replace('.', ',') : value}${NBSP}km`;
}

export function formatDuration(minutes: number, locale: Locale): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}${NBSP}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (locale === 'fr') return m ? `${h}${NBSP}h${NBSP}${String(m).padStart(2, '0')}` : `${h}${NBSP}h`;
  return m ? `${h}${NBSP}h ${m}${NBSP}min` : `${h}${NBSP}h`;
}

/** Coarsen a position (≈1 km) before showing it to someone who hasn't been assigned yet. */
export function coarsen(p: GeoPoint, decimals = 2): GeoPoint {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}

/** Move `from` toward `to` by a fraction (0..1). Used by the demo simulator. */
export function interpolate(from: GeoPoint, to: GeoPoint, t: number): GeoPoint {
  const k = Math.max(0, Math.min(1, t));
  return { lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k };
}
