'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ChevronLeft, LogIn } from 'lucide-react';
import type { UserRole } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useBackend } from '@/lib/backend';
import { isDemo } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Button, ButtonLink } from './ui/button';
import { EmptyState, Skeleton } from './ui/bits';

export function PageContainer({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 sm:px-6', wide ? 'max-w-6xl' : 'max-w-2xl', className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <header className={cn('pt-5 pb-5 sm:pt-8', className)}>
      {back && (
        <Link href={back} className="-ml-2 mb-3 inline-flex h-9 items-center gap-1 rounded-full pr-3 pl-1.5 text-sm text-ink-3 hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t('common.back')}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[27px] leading-[1.1] text-ink sm:text-[34px]">{title}</h1>
          {subtitle && <div className="mt-2 text-[15px] leading-relaxed text-ink-2">{subtitle}</div>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function PageSkeleton() {
  return (
    <PageContainer className="space-y-4 pt-8" aria-busy="true">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-6 h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </PageContainer>
  );
}

/** Shown in place of a page that needs an account. */
export function SignInPrompt({ title, body }: { title?: ReactNode; body?: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const backend = useBackend();
  const next = encodeURIComponent(pathname);
  return (
    <PageContainer>
      <EmptyState
        icon={<LogIn className="size-6" aria-hidden="true" />}
        title={title ?? t('profile.guestTitle')}
        body={body ?? t('profile.guestBody')}
        action={
          <div className="flex flex-col items-center gap-3">
            <ButtonLink href={`/auth/sign-in?next=${next}`} size="lg">
              {t('auth.signIn')}
            </ButtonLink>
            <Link href={`/auth/sign-up?next=${next}`} className="text-sm text-ink-2 hover:text-ink">
              {t('auth.noAccount')} <span className="text-gold-bright">{t('auth.signUp')}</span>
            </Link>
            {isDemo && backend?.auth.demo && (
              <Button variant="ghost" size="sm" onClick={() => void backend.auth.demo!.signInAs('driver')}>
                {t('auth.continueAs', { role: t('auth.demoRoles.driver') })}
              </Button>
            )}
          </div>
        }
      />
    </PageContainer>
  );
}

/** Renders children only for a signed-in user (optionally with a given role). */
export function RequireSession({
  children,
  role,
  title,
  body,
}: {
  children: ReactNode;
  role?: UserRole;
  title?: ReactNode;
  body?: ReactNode;
}) {
  const { status, session } = useSession();
  const { t } = useI18n();
  if (status === 'loading') return <PageSkeleton />;
  if (!session) return <SignInPrompt title={title} body={body} />;
  if (role && session.profile.role !== role && session.profile.role !== 'admin') {
    return (
      <PageContainer>
        <EmptyState title={t('errors.forbidden')} action={<ButtonLink href="/">{t('errors.goHome')}</ButtonLink>} />
      </PageContainer>
    );
  }
  return <>{children}</>;
}

/** Label/value pairs, used for request and listing details. */
export function Facts({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-line rounded-lg border border-line', className)}>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 px-4 py-3">
          <dt className="text-[14px] text-ink-3">{item.label}</dt>
          <dd className="text-[15px] break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
