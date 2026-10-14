'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { STORAGE_KEYS, type OnyxBackend } from '@onyx/core/backend';
import { config } from './config';
import { safeStorage } from './storage';

let instance: Promise<OnyxBackend> | null = null;

/**
 * One backend per page load. Each adapter is a separate chunk, so the demo data never
 * ships to production users and supabase-js never ships to demo users.
 */
export function getBackend(): Promise<OnyxBackend> {
  if (!instance) {
    instance =
      config.mode === 'supabase'
        ? (async () => {
            const [{ createClient }, { createSupabaseBackend }] = await Promise.all([
              import('@supabase/supabase-js'),
              import('@onyx/core/supabase'),
            ]);
            const client = createClient(config.supabaseUrl, config.supabaseKey, {
              auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
            });
            return createSupabaseBackend(client, { siteUrl: config.authSiteUrl ?? window.location.origin });
          })()
        : (async () => {
            const { createDemoBackend } = await import('@onyx/core/demo');
            return createDemoBackend({
              storage: safeStorage,
              watchExternalChanges(onChange) {
                const handler = (e: StorageEvent) => {
                  if (e.key === STORAGE_KEYS.demoDb) onChange();
                };
                window.addEventListener('storage', handler);
                return () => window.removeEventListener('storage', handler);
              },
            });
          })();
  }
  return instance;
}

const BackendContext = createContext<OnyxBackend | null>(null);

export function BackendProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<OnyxBackend | null>(null);
  useEffect(() => {
    let alive = true;
    void getBackend().then((b) => alive && setBackend(b));
    return () => {
      alive = false;
    };
  }, []);
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>;
}

/** The backend, or null for the first few milliseconds while it loads. */
export function useBackend(): OnyxBackend | null {
  return useContext(BackendContext);
}
