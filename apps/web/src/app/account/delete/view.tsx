'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { config } from '@/lib/config';
import { DeleteAccount, DeletionDetails } from '@/components/account/delete-account';
import { ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/bits';

export function DeleteAccountPage() {
  const { t } = useI18n();
  const { status, session } = useSession();
  const email = config.supportEmail;

  return (
    <>
      <h1 className="font-display text-[30px] leading-tight text-ink">{t('account.pageTitle')}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t('account.pageIntro')}</p>
      <DeletionDetails className="mt-6 rounded-xl border border-line bg-surface-1 p-4" />

      <div className="mt-6">
        {status === 'loading' ? (
          <Skeleton className="h-12 w-full rounded-md" />
        ) : session ? (
          <>
            <p className="mb-3 text-[14px] text-ink-3">{t('account.signedInAs', { email: session.email ?? session.profile.fullName })}</p>
            <DeleteAccount variant="danger" className="w-full" />
          </>
        ) : (
          <>
            <ButtonLink href="/auth/sign-in?next=/account/delete" size="lg" className="w-full">
              {t('account.signInToDelete')}
            </ButtonLink>
            <p className="mt-4 text-[14px] leading-relaxed text-ink-3">
              {email ? t('account.lostAccess', { email }) : t('account.lostAccessNoEmail')}{' '}
              <Link href="/auth/forgot-password" className="font-medium text-gold-bright hover:underline">
                {t('auth.forgotPassword')}
              </Link>
            </p>
          </>
        )}
      </div>

      <p className="mt-8 text-center">
        <Link href="/privacy" className="text-[14px] font-medium text-gold-bright hover:underline">
          {t('account.privacy')}
        </Link>
      </p>
    </>
  );
}
