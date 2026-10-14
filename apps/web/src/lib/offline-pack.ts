'use client';

import { useEffect, useRef, useState } from 'react';
import {
  OFFLINE_PACK_RADIUS_KM,
  STORAGE_KEYS,
  buildOfflinePack,
  haversineKm,
  isPackStale,
  type GeoPoint,
  type OfflinePack,
} from '@onyx/core';
import type { OnyxBackend } from '@onyx/core/backend';
import { createPersistentStore } from './external-store';
import { useBackend } from './backend';
import { useLocation } from './location';
import { useOnline } from './online';

export const offlinePackStore = createPersistentStore<OfflinePack | null>(STORAGE_KEYS.offlinePack, null);
export const favoritesStore = createPersistentStore<string[]>(STORAGE_KEYS.favorites, []);

export function useOfflinePack() {
  return offlinePackStore.useValue();
}

export function useFavorites() {
  const ids = favoritesStore.useValue();
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
      favoritesStore.set(next);
      return next.includes(id);
    },
  };
}

export async function refreshOfflinePack(backend: OnyxBackend, center: GeoPoint): Promise<OfflinePack> {
  const technicians = await backend.directory.snapshot(center, OFFLINE_PACK_RADIUS_KM);
  const pack = buildOfflinePack(technicians, center, OFFLINE_PACK_RADIUS_KM);
  offlinePackStore.set(pack);
  return pack;
}

/**
 * Keeps the on-device technician list fresh: whenever we're online and the pack is
 * older than a few hours (or the driver has travelled far), download it again.
 */
export function useOfflinePackSync() {
  const backend = useBackend();
  const online = useOnline();
  const { position } = useLocation();
  const pack = useOfflinePack();
  const running = useRef(false);
  const [lastError, setLastError] = useState<unknown>(null);

  useEffect(() => {
    if (!backend || !online || running.current) return;
    const center = position ?? pack?.center;
    if (!center) return;
    const moved = pack ? haversineKm(pack.center, center) > OFFLINE_PACK_RADIUS_KM / 3 : true;
    if (!isPackStale(pack) && !moved) return;
    running.current = true;
    refreshOfflinePack(backend, { lat: center.lat, lng: center.lng })
      .then(() => setLastError(null), setLastError)
      .finally(() => {
        running.current = false;
      });
  }, [backend, online, position, pack]);

  return lastError;
}
