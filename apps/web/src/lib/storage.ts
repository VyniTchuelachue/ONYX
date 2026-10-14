import type { KeyValueStorage } from '@onyx/core/backend';

/** localStorage that never throws (private mode, quota, disabled storage). */
export const safeStorage: KeyValueStorage = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage full or unavailable — the app keeps working without persistence */
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = safeStorage.getItem(key) as string | null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  void safeStorage.setItem(key, JSON.stringify(value));
}

export function readSession<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: unknown | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
