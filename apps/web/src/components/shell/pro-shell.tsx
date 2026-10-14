'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Briefcase, LayoutDashboard, UserRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { useMyTechnician } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Emblem, Wordmark } from '../brand';
import { AccountButton, DemoBadge, LanguageToggle, OfflineBanner, SkipLink } from './common';

const NAV = [
  { href: '/pro', key: 'nav.proHome', icon: LayoutDashboard, match: (p: string) => p === '/pro' },
  { href: '/pro/jobs', key: 'nav.proJobs', icon: Briefcase, match: (p: string) => p.startsWith('/pro/jobs') },
  { href: '/pro/profile', key: 'nav.proProfile', icon: UserRound, match: (p: string) => p.startsWith('/pro/profile') || p.startsWith('/pro/onboarding') },
] as const;

const AVAILABILITY_DOT = { available: 'bg-ok', busy: 'bg-gold', offline: 'bg-ink-3' } as const;

export function ProShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const backend = useBackend();
  const me = useMyTechnician();
  const listing = me.data;
  // No listing yet means no dashboard or jobs: keep onboarding free of dead ends.
  const showNav = listing !== null;

  // Keep "available" honest: technicians who leave the app stop looking available after a while.
  useEffect(() => {
    if (!backend || !listing) return;
    void backend.pro.heartbeat().catch(() => {});
    const id = setInterval(() => void backend.pro.heartbeat().catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, [backend, listing]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-5 py-6 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <Link href="/pro" aria-label="ONYX Pro">
            <Wordmark height={28} priority />
          </Link>
          <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[11px] font-semibold text-gold">Pro</span>
        </div>
        {showNav && (
          <nav aria-label={t('nav.mainNav')} className="mt-8">
            <ul className="space-y-1">
              {NAV.map(({ href, key, icon: Icon, match }) => {
                const active = match(pathname);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium',
                        active ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-1 hover:text-ink',
                      )}
                    >
                      <span aria-hidden="true" className={cn('absolute left-0 h-5 w-[3px] rounded-r-full bg-gold', active ? 'opacity-100' : 'opacity-0')} />
                      <Icon className={cn('size-5', active ? 'text-gold-bright' : 'text-ink-3')} aria-hidden="true" />
                      {t(key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <div className={cn('border-line', showNav ? 'mt-6 border-t pt-6' : 'mt-8')}>
          <Link href="/" className="flex h-10 items-center rounded-md px-3 text-sm text-ink-2 hover:bg-surface-1 hover:text-ink">
            {t('nav.driverSpace')}
          </Link>
        </div>
        <LanguageToggle className="mt-auto w-fit" />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-onyx/85 pt-safe backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2.5 px-4 sm:px-6">
            <Link href="/pro" className="flex items-center gap-2 lg:hidden" aria-label="ONYX Pro">
              <Emblem size={30} priority />
              <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[11px] font-semibold text-gold">Pro</span>
            </Link>
            <DemoBadge className="lg:hidden" />
            {listing && (
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink-2">
                <span className={cn('size-2 shrink-0 rounded-full', AVAILABILITY_DOT[listing.availability])} aria-hidden="true" />
                <span className="truncate">{listing.businessName}</span>
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <LanguageToggle className="hidden sm:flex" />
              <AccountButton href="/profile" />
            </div>
          </div>
        </header>
        <OfflineBanner />
        <main id="main" className="flex-1 pb-[calc(88px+var(--safe-bottom))] lg:pb-12">
          {children}
        </main>
        {showNav && (
          <nav aria-label={t('nav.mainNav')} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-onyx/92 pb-safe backdrop-blur-xl lg:hidden">
            <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
              {NAV.map(({ href, key, icon: Icon, match }) => {
                const active = match(pathname);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn('relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-gold-bright' : 'text-ink-3')}
                    >
                      <span aria-hidden="true" className={cn('absolute top-0 h-[3px] w-6 rounded-b-full bg-gold', active ? 'opacity-100' : 'opacity-0')} />
                      <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                      {t(key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
