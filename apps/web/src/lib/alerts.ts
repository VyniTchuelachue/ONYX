'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { STORAGE_KEYS, type Locale } from '@onyx/core';
import type { OnyxBackend } from '@onyx/core/backend';
import { config, isDemo } from './config';
import { createPersistentStore } from './external-store';
import { useBackend } from './backend';
import { useSession } from './session';
import { useI18n } from './i18n';

/**
 * Phone alerts. With Supabase they are Web Push: this device subscribes, the database
 * remembers it, and the server sends alerts even when ONYX is closed. In the demo there is
 * no push server, so the open page shows them itself (see DemoAlerts).
 */
export type AlertsStatus =
  | 'pending' // not known until the page runs in the browser
  | 'on'
  | 'off'
  | 'denied' // blocked in the browser settings
  | 'install-first' // iPhone: only apps added to the home screen get alerts
  | 'unsupported'
  | 'not-configured'; // no push keys on this deployment (or a development build)

/** The account that turned alerts on here. Another account on the same phone starts with them off. */
const owner = createPersistentStore<string | null>(STORAGE_KEYS.alerts, null);

const local = new Set<() => void>();
const emit = () => local.forEach((l) => l());

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function statusFor(userId: string | null): AlertsStatus {
  const notInstalled = isIos() && !isStandalone();
  if (!('Notification' in window)) return notInstalled ? 'install-first' : 'unsupported';
  if (!isDemo) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return notInstalled ? 'install-first' : 'unsupported';
    // Alerts arrive through the service worker, which only runs in production builds.
    if (!config.pushPublicKey || process.env.NODE_ENV !== 'production') return 'not-configured';
  }
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && userId !== null && owner.get() === userId ? 'on' : 'off';
}

function subscribe(listener: () => void) {
  local.add(listener);
  const unsubscribeOwner = owner.subscribe(listener);
  // Permission can change in the browser settings while the app is in the background.
  const onVisible = () => document.visibilityState === 'visible' && listener();
  document.addEventListener('visibilitychange', onVisible);
  let permission: PermissionStatus | null = null;
  navigator.permissions
    ?.query({ name: 'notifications' })
    .then((p) => {
      permission = p;
      p.addEventListener('change', listener);
    })
    .catch(() => {});
  return () => {
    local.delete(listener);
    unsubscribeOwner();
    document.removeEventListener('visibilitychange', onVisible);
    permission?.removeEventListener('change', listener);
  };
}

export function useAlertsStatus(): AlertsStatus {
  const { session } = useSession();
  const userId = session?.userId ?? null;
  return useSyncExternalStore(
    subscribe,
    () => statusFor(userId),
    () => 'pending',
  );
}

/* ── Web Push subscription ─────────────────────────────────────────────── */

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

async function serviceWorker(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Service worker not ready')), 10_000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** Subscribe this device (or refresh its subscription) and tell the database about it. */
async function saveThisDevice(backend: OnyxBackend, locale: Locale) {
  const registration = await serviceWorker();
  const key = keyBytes(config.pushPublicKey);
  let subscription = await registration.pushManager.getSubscription();
  // A subscription made with an older key can no longer receive our alerts.
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const { keys } = subscription.toJSON();
  await backend.notifications.saveDevice(
    { endpoint: subscription.endpoint, keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' } },
    { locale, userAgent: navigator.userAgent },
  );
}

/** Keeps the saved device current (language, owner) each time the app opens with alerts on. */
export async function refreshThisDevice(backend: OnyxBackend, locale: Locale) {
  if (isDemo) return;
  await saveThisDevice(backend, locale);
}

/** Stop alerts on this device for the signed-in account. Call before signing out. */
export async function forgetThisDevice(backend: OnyxBackend | null) {
  owner.set(null);
  if (isDemo || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    if (backend) await backend.notifications.forgetDevice(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  } catch {
    /* signing out must never fail because of alerts */
  }
}

/**
 * Someone else signed in on a phone whose alerts belong to another account (who never
 * signed out): stop them here. The server drops that account's entry on its next send.
 */
export async function releaseForeignDevice(userId: string) {
  const current = owner.get();
  if (current && current !== userId) await forgetThisDevice(null);
}

/* ── Showing an alert from the page itself ─────────────────────────────── */

export interface LocalAlert {
  title: string;
  body: string;
  tag: string;
  url: string;
}

/** Demo alerts, and the confirmation shown when alerts are turned on. */
export async function showLocalAlert(alert: LocalAlert, onOpen?: (url: string) => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = { body: alert.body, tag: alert.tag, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url: alert.url } };
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration) {
    await registration.showNotification(alert.title, options);
    return;
  }
  try {
    const notification = new Notification(alert.title, options);
    notification.onclick = () => {
      window.focus();
      onOpen?.(alert.url);
      notification.close();
    };
  } catch {
    /* Android Chrome only shows alerts through a service worker (production builds) */
  }
}

/* ── The switch ────────────────────────────────────────────────────────── */

export function useAlerts() {
  const backend = useBackend();
  const { session } = useSession();
  const { locale, t } = useI18n();
  const status = useAlertsStatus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const userId = session?.userId ?? null;

  const enable = useCallback(async () => {
    if (!backend || !userId) return;
    setBusy(true);
    setFailed(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      if (!isDemo) await saveThisDevice(backend, locale);
      owner.set(userId);
      await showLocalAlert({ title: t('push.testTitle'), body: t('push.testBody'), tag: 'onyx-alerts-on', url: window.location.pathname });
    } catch {
      setFailed(true);
    } finally {
      emit();
      setBusy(false);
    }
  }, [backend, userId, locale, t]);

  const disable = useCallback(async () => {
    setBusy(true);
    await forgetThisDevice(backend);
    setBusy(false);
  }, [backend]);

  return { status, busy, failed, enable, disable };
}
