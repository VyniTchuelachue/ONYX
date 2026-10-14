'use client';

import Link from 'next/link';
import { CircleUserRound, WifiOff } from 'lucide-react';
import type { Locale } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useOnline } from '@/lib/online';
import { useBackend } from '@/lib/backend';
import { isDemo } from '@/lib/config';
import { cn, initials } from '@/lib/utils';

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const backend = useBackend();
  const { session, refresh } = useSession();
  const choose = (l: Locale) => {
    if (l === locale) return;
    setLocale(l);
    if (session && backend) void backend.auth.updateProfile({ locale: l }).then(refresh, () => {});
  };
  return (
    <div role="group" aria-label={t('common.language')} className={cn('flex h-9 rounded-full border border-line p-0.5', className)}>
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          aria-label={l === 'fr' ? 'Français' : 'English'}
          onClick={() => choose(l)}
          className={cn(
            'w-9 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors',
            locale === l ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function AccountButton({ href = '/profile' }: { href?: string }) {
  const { t } = useI18n();
  const { status, session } = useSession();
  if (status === 'loading') return <span className="size-9 rounded-full bg-surface-2" aria-hidden="true" />;
  if (!session) {
    return (
      <Link
        href="/auth/sign-in"
        aria-label={t('nav.signIn')}
        className="grid size-9 place-items-center rounded-full border border-line text-ink-2 hover:text-ink sm:flex sm:w-auto sm:px-3.5 sm:text-sm sm:font-medium"
      >
        <CircleUserRound className="size-5 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline">{t('nav.signIn')}</span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-label={t('nav.profile')}
      className="grid size-9 place-items-center rounded-full bg-surface-3 font-wide text-xs font-semibold text-gold-bright ring-1 ring-line-strong hover:ring-gold/50"
    >
      {initials(session.profile.fullName || session.email || '?')}
    </Link>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  if (!isDemo) return null;
  return (
    <Link
      href="/demo"
      title={t('auth.demoNotice')}
      className={cn('rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-violet-soft', className)}
    >
      {t('common.demo')}
    </Link>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const { t } = useI18n();
  if (online) return null;
  return (
    <div role="status" className="flex items-start gap-3 border-b border-gold/25 bg-gold/8 px-4 py-2.5 text-[13px] leading-snug text-ink-2 sm:px-6">
      <WifiOff className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
      <p>
        <span className="font-semibold text-gold-bright">{t('offline.bannerTitle')}.</span> {t('offline.banner')}
      </p>
    </div>
  );
}

export function SkipLink() {
  const { t } = useI18n();
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-md bg-gold px-4 py-2 font-medium text-onyx focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      {t('common.skipToContent')}
    </a>
  );
}
