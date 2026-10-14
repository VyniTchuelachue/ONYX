'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useSyncExternalStore } from 'react';
import { CircleAlert } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { homeFor, safeNext } from '@/lib/redirects';
import { ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * Where Google and the links in emails bring people back. supabase-js reads the session from
 * the address as the page loads; as soon as it is there, the person carries on to where they
 * were going, already signed in.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}

const noSubscription = () => () => {};
// Google or Supabase send people back with error=… when the sign-in did not happen.
const returnedWithError = () => /(^|[#&?])error=/.test(window.location.hash + window.location.search);

function Callback() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { status, session } = useSession();
  const failedAtProvider = useSyncExternalStore(noSubscription, returnedWithError, () => false);
  const role = session?.profile.role ?? null;

  useEffect(() => {
    if (role) router.replace(next ?? homeFor(role));
  }, [role, next, router]);

  if (failedAtProvider || status === 'signed-out') {
    return (
      <div className="pt-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full border border-line bg-surface-1 text-danger-soft">
          <CircleAlert className="size-6" aria-hidden="true" />
        </span>
        <p role="alert" className="mx-auto mt-5 max-w-sm text-[16px] leading-relaxed text-ink-2">
          {t('auth.callbackFailed')}
        </p>
        <ButtonLink href={`/auth/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`} size="lg" className="mt-6">
          {t('auth.backToSignIn')}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-col items-center pt-20 text-center">
      <Spinner className="size-7 text-gold" />
      <p className="mt-4 text-[16px] text-ink-2">{t('auth.signingYouIn')}</p>
    </div>
  );
}
