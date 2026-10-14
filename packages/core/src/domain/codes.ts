/** Unambiguous alphabet (no 0/O, 1/I/L) so codes can be read over the phone. Mirrors SQL. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRequestCode(random: () => number = Math.random): string {
  let code = 'ONX-';
  for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

/** RFC 4122 v4 UUID. Uses Web Crypto when present (browsers, Node), falls back for other runtimes. */
export function uuid(random: () => number = Math.random): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (random === Math.random && c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(random() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Small deterministic PRNG (mulberry32) for reproducible demo data. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
