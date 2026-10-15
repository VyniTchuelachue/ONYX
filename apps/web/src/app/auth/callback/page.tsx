'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { CircleAlert } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useBackend } from '@/lib/backend';
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

/**
 * Why Google or Supabase sent the person back without a session (error_description in the
 * address). Read once, as the page loads, before supabase-js tidies the address.
 */
const RETURN_ERROR: string | null = (() => {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const detail = hash.get('error_description') ?? query.get('error_description') ?? hash.get('error') ?? query.get('error');
  if (detail) console.error('[auth] sign-in returned an error:', detail);
  return detail;
})();
const noSubscription = () => () => {};

function Callback() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const backend = useBackend();
  const next = safeNext(params.get('next'));
  const { status, session } = useSession();
  const returnError = useSyncExternalStore(noSubscription, () => RETURN_ERROR, () => null);
  const role = session?.profile.role ?? null;
  // Signed in with Supabase but no ONYX profile came back: the database isn't set up.
  const [profileMissing, setProfileMissing] = useState(false);

  useEffect(() => {
    if (role) router.replace(next ?? homeFor(role));
  }, [role, next, router]);

  useEffect(() => {
    if (status !== 'signed-out' || !backend) return;
    let alive = true;
    void backend.auth.getAccessToken().then((token) => {
      if (alive && token) setProfileMissing(true);
    });
    return () => {
      alive = false;
    };
  }, [status, backend]);

  if (returnError || status === 'signed-out') {
    return (
      <div className="pt-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full border border-line bg-surface-1 text-danger-soft">
          <CircleAlert className="size-6" aria-hidden="true" />
        </span>
        <p role="alert" className="mx-auto mt-5 max-w-sm text-[16px] leading-relaxed text-ink-2">
          {profileMissing && !returnError ? t('auth.profileMissing') : t('auth.callbackFailed')}
        </p>
        {returnError && <p className="mx-auto mt-3 max-w-sm break-words text-[13px] text-ink-3">{t('auth.errorDetail', { detail: returnError })}</p>}
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
