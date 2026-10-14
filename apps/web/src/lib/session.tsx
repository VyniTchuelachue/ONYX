'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@onyx/core/backend';
import { useBackend } from './backend';

type SessionState =
  | { status: 'loading'; session: null }
  | { status: 'signed-out'; session: null }
  | { status: 'signed-in'; session: Session };

type SessionValue = SessionState & {
  /** Re-read the profile after editing it. */
  refresh(): Promise<void>;
};

const SessionContext = createContext<SessionValue>({ status: 'loading', session: null, refresh: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  const apply = useCallback(
    (session: Session | null) => {
      setState((prev) => {
        // A different person on this device must never see the previous person's data.
        if ((prev.session?.userId ?? null) !== (session?.userId ?? null)) {
          queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'me' });
        }
        return session ? { status: 'signed-in', session } : { status: 'signed-out', session: null };
      });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!backend) return;
    let alive = true;
    backend.auth.getSession().then(
      (s) => alive && apply(s),
      () => alive && apply(null),
    );
    const unsubscribe = backend.auth.onChange((s) => alive && apply(s));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [backend, apply]);

  const refresh = useCallback(async () => {
    if (backend) apply(await backend.auth.getSession());
  }, [backend, apply]);

  const value = useMemo(() => ({ ...state, refresh }) as SessionValue, [state, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
