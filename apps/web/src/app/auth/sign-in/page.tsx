'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { UserRole } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/errors';
import { homeFor, safeNext } from '@/lib/redirects';
import { isDemo } from '@/lib/config';
import { Field, Input, PasswordInput } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { DemoRolePicker } from '@/components/demo-role-picker';

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const backend = useBackend();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (role: UserRole) => router.replace(next ?? homeFor(role));

  // Already signed in, e.g. arriving from the email confirmation link: carry on.
  const session = useSession();
  const signedInRole = session.status === 'signed-in' ? session.session.profile.role : null;
  useEffect(() => {
    if (signedInRole) router.replace(next ?? homeFor(signedInRole));
  }, [signedInRole, next, router]);

  const submit = async () => {
    if (!backend) return;
    setBusy(true);
    setError(null);
    try {
      const session = await backend.auth.signIn({ email, password });
      go(session.profile.role);
    } catch (e) {
      setError(errorMessage(t, e));
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-[30px] leading-tight text-ink">{t('auth.signInTitle')}</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={t('auth.email')}>
          {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <div>
          <Field label={t('auth.password')}>
            {(p) => <PasswordInput {...p} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <div className="mt-2 text-right">
            <Link href="/auth/forgot-password" className="text-[14px] font-medium text-gold-bright hover:underline">
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[14px] text-danger-soft">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>
      <p className="mt-5 text-center text-[15px] text-ink-3">
        {t('auth.noAccount')}{' '}
        <Link href={`/auth/sign-up${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-gold-bright hover:underline">
          {t('auth.signUp')}
        </Link>
      </p>

      {isDemo && (
        <section className="mt-10 border-t border-line pt-8">
          <h2 className="font-wide text-[17px] font-semibold text-ink">{t('auth.demoTitle')}</h2>
          <p className="mt-1 text-[14px] text-ink-3">{t('auth.demoIntro')}</p>
          <DemoRolePicker className="mt-4" onDone={(role) => go(role)} />
        </section>
      )}
    </>
  );
}
