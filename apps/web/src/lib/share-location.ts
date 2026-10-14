'use client';

import { useEffect, useRef, useState } from 'react';
import { useBackend } from './backend';

/**
 * While the technician drives to a job, send their position every ~20 s. Positions are only
 * stored on the job, visible to that driver, and cleared on arrival.
 */
export function useShareLocation(requestId: string, active: boolean) {
  const backend = useBackend();
  const [error, setError] = useState<string | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (!active || !backend || !('geolocation' in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - last.current < 20_000) return;
        last.current = now;
        setError(null);
        void backend.pro.shareLocation(requestId, { lat: pos.coords.latitude, lng: pos.coords.longitude }).catch(() => {});
      },
      (err) => setError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [active, backend, requestId]);

  return { error };
}
