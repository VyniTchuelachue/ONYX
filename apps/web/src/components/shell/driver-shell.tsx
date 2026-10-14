'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Gem, House, LocateFixed, MapPin, Route, TriangleAlert, WifiOff } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useLocationLabel } from '@/lib/use-location-label';
import { useOfflinePackSync } from '@/lib/offline-pack';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { Emblem, Wordmark } from '../brand';
import { EmergencySheet } from '../emergency-sheet';
import { LocationSheet } from '../location-sheet';
import { AccountButton, DemoBadge, LanguageToggle, OfflineBanner, SkipLink } from './common';
import { ShellActionsContext } from './shell-actions';

const NAV = [
  { href: '/', key: 'nav.home', icon: House, match: (p: string) => p === '/' },
  { href: '/technicians', key: 'nav.find', icon: MapPin, match: (p: string) => p.startsWith('/technicians') || p === '/offline' },
  { href: '/assistant', key: 'nav.assistant', icon: Gem, match: (p: string) => p.startsWith('/assistant') },
  { href: '/requests', key: 'nav.requests', icon: Route, match: (p: string) => p.startsWith('/request') },
] as const;

export function DriverShell({ children }: { children: ReactNode }) {
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  useOfflinePackSync();
  const actions = useMemo(
    () => ({ openEmergency: () => setEmergencyOpen(true), openLocation: () => setLocationOpen(true) }),
    [],
  );

  return (
    <ShellActionsContext.Provider value={actions}>
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <SkipLink />
      <SideRail onEmergency={() => setEmergencyOpen(true)} />
      <div className="flex min-h-dvh min-w-0 flex-col">
        <TopBar onEmergency={() => setEmergencyOpen(true)} onLocation={() => setLocationOpen(true)} />
        <OfflineBanner />
        <main id="main" className="flex-1 pb-[calc(88px+var(--safe-bottom))] lg:pb-12">
          {children}
        </main>
        <BottomNav />
      </div>
      <EmergencySheet open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
      <LocationSheet open={locationOpen} onClose={() => setLocationOpen(false)} />
    </div>
    </ShellActionsContext.Provider>
  );
}

function TopBar({ onEmergency, onLocation }: { onEmergency: () => void; onLocation: () => void }) {
  const loc = useLocationLabel();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-onyx/85 pt-safe backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="ONYX">
          <Emblem size={30} priority />
        </Link>
        <DemoBadge className="hidden sm:inline-flex lg:hidden" />

        <button
          type="button"
          onClick={onLocation}
          className="ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-full py-1.5 pr-2 text-left lg:ml-0 lg:flex-none"
        >
          {loc.pending ? (
            <LocateFixed className="size-4 shrink-0 animate-pulse text-blue-soft" aria-hidden="true" />
          ) : (
            <MapPin className="size-4 shrink-0 text-gold" aria-hidden="true" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{loc.label}</span>
            {loc.detail && <span className="block truncate text-[11px] leading-tight text-ink-3">{loc.detail}</span>}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onEmergency}
            className="flex h-9 items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-3 text-sm font-semibold text-danger-soft hover:bg-danger/18 lg:hidden"
          >
            <TriangleAlert className="size-4" aria-hidden="true" />
            <span>SOS</span>
          </button>
          <LanguageToggle className="hidden sm:flex" />
          <AccountButton />
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('nav.mainNav')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-onyx/92 pb-safe backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {NAV.map(({ href, key, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-gold-bright' : 'text-ink-3 hover:text-ink-2',
                )}
              >
                {/* The active tab wears a short centre-line dash. */}
                <span
                  aria-hidden="true"
                  className={cn('absolute top-0 h-[3px] w-6 rounded-b-full bg-gold transition-opacity', active ? 'opacity-100' : 'opacity-0')}
                />
                <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SideRail({ onEmergency }: { onEmergency: () => void }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { session } = useSession();
  const role = session?.profile.role;
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-5 py-6 lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <Link href="/" aria-label="ONYX">
          <Wordmark height={30} priority />
        </Link>
        <DemoBadge />
      </div>
      <p className="mt-3 px-2 text-[13px] leading-snug text-ink-3">{t('common.tagline')}</p>

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
                    'relative flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors',
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
          <li>
            <Link
              href="/offline"
              className={cn(
                'flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors',
                pathname === '/offline' ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-1 hover:text-ink',
              )}
            >
              <WifiOff className="size-5 text-ink-3" aria-hidden="true" />
              {t('offline.title')}
            </Link>
          </li>
        </ul>
      </nav>

      {(role === 'technician' || role === 'admin') && (
        <div className="mt-6 space-y-1 border-t border-line pt-6">
          {role === 'technician' && (
            <Link href="/pro" className="flex h-10 items-center rounded-md px-3 text-sm text-ink-2 hover:bg-surface-1 hover:text-ink">
              {t('nav.proSpace')}
            </Link>
          )}
          {role === 'admin' && (
            <Link href="/admin" className="flex h-10 items-center rounded-md px-3 text-sm text-ink-2 hover:bg-surface-1 hover:text-ink">
              {t('nav.adminSpace')}
            </Link>
          )}
        </div>
      )}

      <div className="mt-auto space-y-4">
        <button
          type="button"
          onClick={onEmergency}
          className="flex h-12 w-full items-center gap-3 rounded-lg border border-danger/35 bg-danger/8 px-4 text-[15px] font-semibold text-danger-soft hover:bg-danger/15"
        >
          <TriangleAlert className="size-5" aria-hidden="true" />
          {t('home.emergencyCta')}
        </button>
        <LanguageToggle className="w-fit" />
      </div>
    </aside>
  );
}
