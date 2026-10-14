'use client';

import { useEffect, useRef } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RequestStatus, VerificationStatus } from '@onyx/core';
import type { NearbyQuery, OnyxBackend } from '@onyx/core/backend';
import { useBackend } from './backend';
import { useSession } from './session';
import { useI18n } from './i18n';
import { errorMessage } from './errors';

/* ── Public directory ──────────────────────────────────────────────────── */

const round = (n: number) => Math.round(n * 1000) / 1000;

export function useNearby(query: NearbyQuery | null) {
  const backend = useBackend();
  const key = query
    ? { ...query, center: { lat: round(query.center.lat), lng: round(query.center.lng) } }
    : null;
  return useQuery({
    queryKey: ['directory', 'nearby', key],
    queryFn: () => backend!.directory.nearby(key!),
    enabled: !!backend && !!key,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useTechnician(id: string | null) {
  const backend = useBackend();
  return useQuery({
    queryKey: ['directory', 'technician', id],
    queryFn: () => backend!.directory.get(id!),
    enabled: !!backend && !!id,
    staleTime: 60_000,
  });
}

export function useTechnicianReviews(id: string | null) {
  const backend = useBackend();
  return useQuery({
    queryKey: ['directory', 'reviews', id],
    queryFn: () => backend!.directory.reviews(id!, 20),
    enabled: !!backend && !!id,
    staleTime: 60_000,
  });
}

/* ── Signed-in data: always keyed under ['me', userId, …] ─────────────── */

function useMeKey(...parts: unknown[]): QueryKey | null {
  const { session } = useSession();
  return session ? ['me', session.userId, ...parts] : null;
}

/**
 * Refetch a query when the backend reports a change (Realtime, demo store, polling).
 * Subscribes once per query key, not on every render.
 */
function useLiveInvalidation(key: QueryKey | null, subscribe: ((onChange: () => void) => () => void) | null) {
  const queryClient = useQueryClient();
  const subscribeRef = useRef(subscribe);
  useEffect(() => {
    subscribeRef.current = subscribe;
  });
  const keyString = key ? JSON.stringify(key) : null;
  const active = !!subscribe;
  useEffect(() => {
    if (!active || !keyString || !subscribeRef.current) return;
    const queryKey = JSON.parse(keyString) as QueryKey;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeRef.current(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey }), 200);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [active, keyString, queryClient]);
}

export function useMyRequests() {
  const backend = useBackend();
  const key = useMeKey('requests');
  const query = useQuery({
    queryKey: key ?? ['me', 'none'],
    queryFn: () => backend!.requests.listMine(),
    enabled: !!backend && !!key,
  });
  useLiveInvalidation(key, backend && backend.mode === 'demo' ? (cb) => backend.requests.subscribe('*', cb) : null);
  return query;
}

export function useRequestDetail(id: string | null) {
  const backend = useBackend();
  const key = useMeKey('request', id);
  const query = useQuery({
    queryKey: key ?? ['me', 'none'],
    queryFn: () => backend!.requests.get(id!),
    enabled: !!backend && !!key && !!id,
    refetchInterval: (q) => {
      const status = q.state.data?.request.status;
      // Realtime pushes changes; this is only a safety net while a job is live.
      return status && status !== 'completed' && status !== 'cancelled' ? 30_000 : false;
    },
  });
  useLiveInvalidation(key, backend && id ? (cb) => backend.requests.subscribe(id, cb) : null);
  return query;
}

export function useMyTechnician() {
  const backend = useBackend();
  const key = useMeKey('pro', 'me');
  return useQuery({
    queryKey: key ?? ['me', 'none'],
    queryFn: () => backend!.pro.me(),
    enabled: !!backend && !!key,
  });
}

export function useProDocuments(enabled = true) {
  const backend = useBackend();
  const key = useMeKey('pro', 'documents');
  return useQuery({
    queryKey: key ?? ['me', 'none'],
    queryFn: () => backend!.pro.documents(),
    enabled: !!backend && !!key && enabled,
  });
}

export function useInbox(enabled: boolean) {
  const backend = useBackend();
  const key = useMeKey('pro', 'inbox');
  const query = useQuery({
    queryKey: key ?? ['me', 'none'],
    queryFn: () => backend!.pro.inbox(),
    enabled: !!backend && !!key && enabled,
    refetchOnWindowFocus: true,
  });
  useLiveInvalidation(enabled ? key : null, backend ? (cb) => backend.pro.subscribeInbox(cb) : null);
  return query;
}

export function useJobs(scope: 'active' | 'history', enabled = true) {
  const backend = useBackend();
  const key = useMeKey('pro', 'jobs', scope);
  const query = useQuery({
    queryKey: key ?? ['me', 'none'],
    queryFn: () => backend!.pro.jobs(scope),
    enabled: !!backend && !!key && enabled,
  });
  useLiveInvalidation(enabled ? key : null, backend && backend.mode === 'demo' ? (cb) => backend.pro.subscribeInbox(cb) : null);
  return query;
}

export function useJob(id: string | null) {
  const backend = useBackend();
  const key = useMeKey('pro', 'job', id);
  const query = useQuery({
    queryKey: key ?? ['me', 'none'],
    queryFn: () => backend!.pro.job(id!),
    enabled: !!backend && !!key && !!id,
  });
  useLiveInvalidation(key, backend && id ? (cb) => backend.pro.subscribeJob(id, cb) : null);
  return query;
}

export function useProStats(enabled = true) {
  const backend = useBackend();
  const key = useMeKey('pro', 'stats');
  return useQuery({
    queryKey: key ?? ['me', 'none'],
    queryFn: () => backend!.pro.stats(),
    enabled: !!backend && !!key && enabled,
  });
}

/* ── Admin ─────────────────────────────────────────────────────────────── */

function useAdminQuery<T>(parts: unknown[], fn: (b: OnyxBackend) => Promise<T>, enabled = true) {
  const backend = useBackend();
  const { session } = useSession();
  const key = useMeKey('admin', ...parts);
  return useQuery({
    queryKey: key ?? ['me', 'none'],
    queryFn: () => fn(backend!),
    enabled: !!backend && !!key && session?.profile.role === 'admin' && enabled,
  });
}

export const useAdminMetrics = () => useAdminQuery(['metrics'], (b) => b.admin.metrics());
export const useAdminTechnicians = (status: VerificationStatus | null) =>
  useAdminQuery(['technicians', status], (b) => b.admin.technicians(status));
export const useAdminTechnician = (id: string | null) =>
  useAdminQuery(['technician', id], (b) => b.admin.technician(id!), !!id);
export const useAdminRequests = (filter: RequestStatus | 'active' | null) =>
  useAdminQuery(['requests', filter], (b) => b.admin.requests(filter));
export const useAdminRequest = (id: string | null) => useAdminQuery(['request', id], (b) => b.admin.request(id!), !!id);
export const useAdminPayments = () => useAdminQuery(['payments'], (b) => b.admin.payments());
export const useAdminReviews = () => useAdminQuery(['reviews'], (b) => b.admin.reviews());
export const useAdminPerformance = () => useAdminQuery(['performance'], (b) => b.admin.performance());

/* ── Mutations ─────────────────────────────────────────────────────────── */

/**
 * Run a backend action with consistent feedback: a translated toast on failure,
 * an optional toast on success, and a refresh of the signed-in user's data.
 */
export function useAction<TInput, TResult>(
  action: (backend: OnyxBackend, input: TInput) => Promise<TResult>,
  options: { success?: string | ((result: TResult) => string | null); silentError?: boolean } = {},
) {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: async (input: TInput) => {
      if (!backend) throw new Error('Backend not ready');
      return action(backend, input);
    },
    onSuccess: (result) => {
      const message = typeof options.success === 'function' ? options.success(result) : options.success;
      if (message) toast.success(message);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
    onError: (error) => {
      if (!options.silentError) toast.error(errorMessage(t, error));
    },
  });
}
