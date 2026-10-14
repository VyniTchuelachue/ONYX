'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pushMessage } from '@onyx/core';
import { watchMyRequests, watchOffers } from '@onyx/core/backend';
import { useBackend } from '@/lib/backend';
import { useSession } from '@/lib/session';
import { useI18n } from '@/lib/i18n';
import { isDemo } from '@/lib/config';
import { refreshThisDevice, releaseForeignDevice, showLocalAlert, useAlertsStatus } from '@/lib/alerts';

/**
 * Keeps alerts working across the app. In production it refreshes this device's
 * subscription (owner, language) whenever the app opens. In the demo, which has no push
 * server, it watches the on-device data and shows the alerts itself while the page is hidden.
 */
export function AlertsBridge() {
  const backend = useBackend();
  const { session } = useSession();
  const { locale } = useI18n();
  const status = useAlertsStatus();
  const router = useRouter();
  const userId = session?.userId ?? null;
  const role = session?.profile.role ?? null;

  useEffect(() => {
    if (userId) void releaseForeignDevice(userId);
  }, [userId]);

  useEffect(() => {
    if (isDemo || !backend || status !== 'on') return;
    void refreshThisDevice(backend, locale).catch(() => {});
  }, [backend, status, locale, userId]);

  useEffect(() => {
    if (!isDemo || !backend || status !== 'on' || (role !== 'driver' && role !== 'technician')) return;
    const watcher = role === 'technician' ? watchOffers(backend, locale) : watchMyRequests(backend, locale);
    const open = (url: string) => router.push(url);
    let running = false;
    let again = false;
    const check = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        do {
          again = false;
          for (const target of await watcher.next()) {
            const message = pushMessage(target);
            if (message && document.visibilityState === 'hidden') void showLocalAlert(message, open);
          }
        } while (again);
      } catch {
        /* the next change tries again */
      } finally {
        running = false;
      }
    };
    void check(); // the first look only takes stock of what is already there
    return role === 'technician' ? backend.pro.subscribeInbox(() => void check()) : backend.requests.subscribe('*', () => void check());
  }, [backend, status, userId, role, locale, router]);

  return null;
}
