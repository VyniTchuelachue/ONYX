'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { Toaster } from 'sonner';
import { isBackendError } from '@onyx/core/backend';
import type { Locale } from '@onyx/core';
import { I18nProvider } from '@/lib/i18n';
import { BackendProvider } from '@/lib/backend';
import { SessionProvider } from '@/lib/session';
import { LocationProvider } from '@/lib/location';
import { AlertsBridge } from '@/components/alerts/alerts-bridge';
// Registers the "add to home screen" listener early, before the event fires.
import '@/lib/install-prompt';

function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* the app works without it; offline support is a bonus */
    });
  }, []);
  return null;
}

export function Providers({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            // Retry network hiccups (common on mobile data), never permission or validation errors.
            retry: (count, error) => (isBackendError(error) && error.code !== 'network' ? false : count < 2),
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <I18nProvider initialLocale={initialLocale}>
      <QueryClientProvider client={queryClient}>
        <BackendProvider>
          <SessionProvider>
            <LocationProvider>
              <MotionConfig reducedMotion="user">
                <LazyMotion features={domAnimation} strict>
                  {children}
                </LazyMotion>
              </MotionConfig>
              <Toaster
                position="top-center"
                theme="dark"
                offset={16}
                mobileOffset={{ top: 'calc(12px + env(safe-area-inset-top))' }}
                toastOptions={{
                  classNames: {
                    toast: '!bg-surface-2 !border !border-line-strong !text-ink !rounded-lg !font-sans !shadow-2xl',
                    description: '!text-ink-2',
                    success: '[&_[data-icon]]:!text-ok',
                    error: '[&_[data-icon]]:!text-danger-soft',
                  },
                }}
              />
              <ServiceWorkerRegistration />
              <AlertsBridge />
            </LocationProvider>
          </SessionProvider>
        </BackendProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
