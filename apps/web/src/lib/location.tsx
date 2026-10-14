'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { STORAGE_KEYS, type Place, type StoredLocation } from '@onyx/core';
import { createPersistentStore } from './external-store';

export type LocationStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';
export type LocationSource = 'gps' | 'last' | 'manual';

interface LocationValue {
  status: LocationStatus;
  /** Best position we have: fresh GPS, then the last known fix, then a chosen area. */
  position: StoredLocation | null;
  source: LocationSource | null;
  manualArea: string | null;
  locate(): void;
  setManualArea(place: Place): void;
}

const LocationContext = createContext<LocationValue | null>(null);

/** A last fix older than this is no longer used to search. */
const LAST_KNOWN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type ManualArea = StoredLocation & { name: string };
const lastFixStore = createPersistentStore<StoredLocation | null>(STORAGE_KEYS.lastLocation, null);
const manualAreaStore = createPersistentStore<ManualArea | null>(STORAGE_KEYS.manualArea, null);

// A fix from yesterday would send a technician to the wrong place: forget it on load.
if (typeof window !== 'undefined') {
  const last = lastFixStore.get();
  if (last && Date.now() - new Date(last.at).getTime() > LAST_KNOWN_MAX_AGE_MS) lastFixStore.set(null);
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [fixedThisVisit, setFixedThisVisit] = useState(false);
  const last = lastFixStore.useValue();
  const manual = manualAreaStore.useValue();
  const inFlight = useRef(false);

  const locate = useCallback(() => {
    if (inFlight.current) return;
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    inFlight.current = true;
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        inFlight.current = false;
        lastFixStore.set({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
          at: new Date().toISOString(),
        });
        manualAreaStore.set(null);
        setFixedThisVisit(true);
        setStatus('ready');
      },
      (err) => {
        inFlight.current = false;
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      // GPS works without data; a generous timeout matters on slow phones.
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  }, []);

  const setManualArea = useCallback((place: Place) => {
    manualAreaStore.set({ lat: place.lat, lng: place.lng, accuracy: null, at: new Date().toISOString(), name: place.name });
    setFixedThisVisit(false);
    setStatus('ready');
  }, []);

  // Choose the best position from what we know: a fix from this visit, a manual choice
  // newer than the last fix, or a last fix that is still recent.
  const value = useMemo<LocationValue>(() => {
    let position: StoredLocation | null = null;
    let source: LocationSource | null = null;
    if (fixedThisVisit && last) {
      position = last;
      source = 'gps';
    } else if (manual && (!last || new Date(manual.at) >= new Date(last.at))) {
      position = manual;
      source = 'manual';
    } else if (last) {
      position = last;
      source = 'last';
    }
    return { status, position, source, manualArea: source === 'manual' ? (manual?.name ?? null) : null, locate, setManualArea };
  }, [status, fixedThisVisit, last, manual, locate, setManualArea]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>');
  return ctx;
}

/**
 * Ask for a fresh fix once when a screen that needs it opens. If the user refused before,
 * the browser answers "denied" straight away without prompting again.
 */
export function useEnsureLocation() {
  const { status, source, locate } = useLocation();
  useEffect(() => {
    if (status === 'idle' && source !== 'gps') locate();
  }, [status, source, locate]);
}
