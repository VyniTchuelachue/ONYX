'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Banknote, ChartColumn, ClipboardList, LayoutDashboard, Users } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Emblem, Wordmark } from '../brand';
import { RequireSession } from '../page';
import { AccountButton, DemoBadge, LanguageToggle, SkipLink } from './common';

const NAV = [
  { href: '/admin', key: 'nav.adminOverview', icon: LayoutDashboard, match: (p: string) => p === '/admin' },
  { href: '/admin/technicians', key: 'nav.adminTechnicians', icon: Users, match: (p: string) => p.startsWith('/admin/technicians') },
  { href: '/admin/requests', key: 'nav.adminRequests', icon: ClipboardList, match: (p: string) => p.startsWith('/admin/requests') },
  { href: '/admin/payments', key: 'nav.adminPayments', icon: Banknote, match: (p: string) => p.startsWith('/admin/payments') },
  { href: '/admin/quality', key: 'nav.adminQuality', icon: ChartColumn, match: (p: string) => p.startsWith('/admin/quality') },
] as const;

/** Desktop-first operations console; on phones the sections become a scrollable tab row. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-6 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <Link href="/admin" aria-label={t('admin.title')}>
            <Wordmark height={26} priority />
          </Link>
          <DemoBadge />
        </div>
        <p className="mt-2 px-2 text-[13px] text-ink-3">{t('nav.adminSpace')}</p>
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
                      'relative flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium',
                      active ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-1 hover:text-ink',
                    )}
                  >
                    <span aria-hidden="true" className={cn('absolute left-0 h-5 w-[3px] rounded-r-full bg-gold', active ? 'opacity-100' : 'opacity-0')} />
                    <Icon className={cn('size-[18px]', active ? 'text-gold-bright' : 'text-ink-3')} aria-hidden="true" />
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-6 border-t border-line pt-6">
          <Link href="/" className="flex h-10 items-center rounded-md px-3 text-sm text-ink-2 hover:bg-surface-1 hover:text-ink">
            {t('nav.driverSpace')}
          </Link>
        </div>
        <LanguageToggle className="mt-auto w-fit" />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-onyx/90 pt-safe backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center gap-2.5 px-4">
            <Link href="/admin" aria-label={t('admin.title')}>
              <Emblem size={30} priority />
            </Link>
            <span className="text-sm font-medium text-ink-2">{t('nav.adminSpace')}</span>
            <DemoBadge />
            <div className="ml-auto flex items-center gap-2">
              <AccountButton />
            </div>
          </div>
          <nav aria-label={t('nav.mainNav')} className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map(({ href, key, match }) => {
              const active = match(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'h-8 shrink-0 rounded-full px-3 text-[13px] leading-8 font-medium',
                    active ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2',
                  )}
                >
                  {t(key)}
                </Link>
              );
            })}
          </nav>
        </header>
        <main id="main" className="flex-1 pb-16">
          <RequireSession role="admin">{children}</RequireSession>
        </main>
      </div>
    </div>
  );
}
