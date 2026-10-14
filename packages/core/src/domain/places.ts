import type { CorridorId } from '../constants';
import type { GeoPoint } from '../types';

export interface Place extends GeoPoint {
  name: string;
  city: string;
  kind: 'quarter' | 'town';
}

/**
 * Douala quarters and landmarks drivers use to describe where they are.
 * Coordinates from OpenStreetMap (Nominatim), rounded to ~10 m.
 */
export const DOUALA_QUARTERS: Place[] = [
  { name: 'Akwa', lat: 4.05254, lng: 9.69633 },
  { name: 'Akwa Nord', lat: 4.0786, lng: 9.71853 },
  { name: 'Bonanjo', lat: 4.04302, lng: 9.6865 },
  { name: 'Bonapriso', lat: 4.02562, lng: 9.69302 },
  { name: 'Bali', lat: 4.03999, lng: 9.69305 },
  { name: 'Deido', lat: 4.06376, lng: 9.71518 },
  { name: 'New Bell', lat: 4.03148, lng: 9.70576 },
  { name: 'Mboppi', lat: 4.0468, lng: 9.71504 },
  { name: 'Ange Raphaël', lat: 4.02256, lng: 9.70175 },
  { name: 'Youpwe', lat: 4.01051, lng: 9.69961 },
  { name: 'Aéroport', lat: 4.01296, lng: 9.71615 },
  { name: 'Village', lat: 4.01177, lng: 9.72942 },
  { name: 'Bassa', lat: 4.04587, lng: 9.72899 },
  { name: 'Bépanda', lat: 4.05654, lng: 9.72272 },
  { name: 'Ndokoti', lat: 4.04343, lng: 9.74368 },
  { name: 'Makepe', lat: 4.06381, lng: 9.74096 },
  { name: 'Ndogbong', lat: 4.06447, lng: 9.75213 },
  { name: 'Cité des Palmiers', lat: 4.05427, lng: 9.76406 },
  { name: 'Beedi', lat: 4.06117, lng: 9.76629 },
  { name: 'Logbaba', lat: 4.03285, lng: 9.76032 },
  { name: 'Ndogpassi', lat: 4.01009, lng: 9.75667 },
  { name: 'PK10', lat: 4.04768, lng: 9.77096 },
  { name: 'Nyalla', lat: 4.03341, lng: 9.77442 },
  { name: 'Logpom', lat: 4.07691, lng: 9.77118 },
  { name: 'Bonamoussadi', lat: 4.09435, lng: 9.73937 },
  { name: 'PK14 Logbessou', lat: 4.07884, lng: 9.7937 },
  { name: 'Japoma', lat: 4.03233, lng: 9.82269 },
  { name: 'Yassa', lat: 3.99133, lng: 9.81038 },
  { name: 'Bonabéri', lat: 4.08221, lng: 9.66497 },
].map((p) => ({ ...p, city: 'Douala', kind: 'quarter' as const }));

/** Towns along the intercity roads served from Douala. */
export const CORRIDOR_TOWNS: Place[] = [
  { name: 'Edéa', lat: 3.79901, lng: 10.12656 },
  { name: 'Pouma', lat: 3.85463, lng: 10.52519 },
  { name: 'Boumnyébel', lat: 3.88389, lng: 10.84928 },
  { name: 'Mbankomo', lat: 3.78791, lng: 11.4024 },
  { name: 'Yaoundé', lat: 3.86899, lng: 11.52133 },
  { name: 'Souza', lat: 4.23176, lng: 9.61325 },
  { name: 'Mbanga', lat: 4.49908, lng: 9.56574 },
  { name: 'Njombé', lat: 4.58672, lng: 9.65293 },
  { name: 'Penja', lat: 4.6408, lng: 9.68291 },
  { name: 'Loum', lat: 4.72005, lng: 9.7275 },
  { name: 'Manjo', lat: 4.84752, lng: 9.82303 },
  { name: 'Nkongsamba', lat: 4.95251, lng: 9.93917 },
  { name: 'Melong', lat: 5.12158, lng: 9.94915 },
  { name: 'Kékem', lat: 5.15767, lng: 10.01931 },
  { name: 'Bafang', lat: 5.15866, lng: 10.17975 },
  { name: 'Bafoussam', lat: 5.47588, lng: 10.42179 },
  { name: 'Mutengene', lat: 4.09011, lng: 9.31696 },
  { name: 'Tiko', lat: 4.07557, lng: 9.36502 },
  { name: 'Limbé', lat: 4.01029, lng: 9.20706 },
  { name: 'Buea', lat: 4.15679, lng: 9.23159 },
  { name: 'Kribi', lat: 2.94341, lng: 9.9127 },
].map((p) => ({ ...p, city: p.name, kind: 'town' as const }));

export const ALL_PLACES: Place[] = [...DOUALA_QUARTERS, ...CORRIDOR_TOWNS];

export interface Corridor {
  id: CorridorId;
  /** Road number where it is official and well known. */
  road: string | null;
  from: string;
  to: string;
  /** Simplified polyline through the main towns, used to tell if a driver is on this road. */
  path: GeoPoint[];
}

const town = (name: string): GeoPoint => {
  const p = CORRIDOR_TOWNS.find((t) => t.name === name);
  if (!p) throw new Error(`Unknown corridor town: ${name}`);
  return { lat: p.lat, lng: p.lng };
};

const DOUALA_EAST: GeoPoint = { lat: 4.03233, lng: 9.82269 }; // Japoma exit
const DOUALA_WEST: GeoPoint = { lat: 4.08221, lng: 9.66497 }; // Bonabéri

export const CORRIDORS: Corridor[] = [
  {
    id: 'douala-yaounde',
    road: 'N3',
    from: 'Douala',
    to: 'Yaoundé',
    path: [DOUALA_EAST, town('Edéa'), town('Pouma'), town('Boumnyébel'), town('Mbankomo'), town('Yaoundé')],
  },
  {
    id: 'douala-bafoussam',
    road: 'N5',
    from: 'Douala',
    to: 'Bafoussam',
    path: [
      DOUALA_WEST,
      town('Souza'),
      town('Mbanga'),
      town('Njombé'),
      town('Penja'),
      town('Loum'),
      town('Manjo'),
      town('Nkongsamba'),
      town('Melong'),
      town('Kékem'),
      town('Bafang'),
      town('Bafoussam'),
    ],
  },
  {
    id: 'douala-limbe',
    road: null,
    from: 'Douala',
    to: 'Limbé',
    path: [DOUALA_WEST, town('Tiko'), town('Mutengene'), town('Limbé')],
  },
  {
    id: 'douala-kribi',
    road: null,
    from: 'Douala',
    to: 'Kribi',
    path: [DOUALA_EAST, town('Edéa'), town('Kribi')],
  },
];

export function getCorridor(id: CorridorId): Corridor {
  const c = CORRIDORS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown corridor: ${id}`);
  return c;
}

export function corridorLabel(id: CorridorId): string {
  const c = getCorridor(id);
  return `${c.from} – ${c.to}${c.road ? ` (${c.road})` : ''}`;
}
