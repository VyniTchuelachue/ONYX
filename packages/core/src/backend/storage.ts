/**
 * Minimal key-value storage. `localStorage` satisfies it on the web; on React Native wrap
 * AsyncStorage or MMKV (async results are supported).
 */
export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

/** Storage keys used on the device. Bump the version suffix when a format changes. */
export const STORAGE_KEYS = {
  offlinePack: 'onyx.offline-pack.v1',
  lastLocation: 'onyx.last-location.v1',
  manualArea: 'onyx.manual-area.v1',
  favorites: 'onyx.favorites.v1',
  assistantChat: 'onyx.assistant-chat.v1',
  requestDraft: 'onyx.request-draft.v1',
  /** Account that turned on phone alerts on this device. */
  alerts: 'onyx.alerts.v1',
  locale: 'onyx.locale',
  demoDb: 'onyx.demo-db.v4',
} as const;
