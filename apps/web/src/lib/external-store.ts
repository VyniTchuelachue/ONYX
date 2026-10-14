import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './storage';

/**
 * A value persisted in localStorage and shared by every component that reads it,
 * including across tabs. Small and dependency-free on purpose.
 */
export function createPersistentStore<T>(key: string, fallback: T) {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cache === undefined) cache = readJSON<T>(key) ?? fallback;
    return cache;
  };

  const emit = () => {
    for (const l of listeners) l();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        cache = undefined;
        emit();
      }
    });
  }

  return {
    get: read,
    set(value: T) {
      cache = value;
      writeJSON(key, value);
      emit();
    },
    update(fn: (current: T) => T) {
      this.set(fn(read()));
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    useValue(): T {
      return useSyncExternalStore(this.subscribe, read, () => fallback);
    },
  };
}
