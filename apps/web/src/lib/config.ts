/**
 * Public runtime configuration. `NEXT_PUBLIC_*` values are inlined at build time.
 * Without Supabase credentials the app runs entirely on the on-device demo backend.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const forceDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const config = {
  supabaseUrl,
  supabaseKey,
  mode: (!forceDemo && supabaseUrl && supabaseKey ? 'supabase' : 'demo') as 'supabase' | 'demo',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  /** Web Push public key (VAPID). Alerts stay off until it is set. */
  pushPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  map: {
    // OpenStreetMap's own tiles: free, no key, fine for development and light use. For
    // production traffic, point this at a keyed provider (MapTiler, Stadia…) per OSM's policy.
    tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    /** Light tiles are inverted to sit on the black interface; set to "false" for dark tile sets. */
    darken: process.env.NEXT_PUBLIC_MAP_DARKEN !== 'false',
  },
} as const;

export const isDemo = config.mode === 'demo';
export const LOCALE_COOKIE = 'onyx-locale';
