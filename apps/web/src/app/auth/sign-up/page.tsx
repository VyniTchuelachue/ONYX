'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Car, Wrench } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { errorMessage, fieldMessages } from '@/lib/errors';
import { safeNext } from '@/lib/redirects';
import { Field, Input, PasswordInput } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GoogleButton, OrWithEmail } from '@/components/auth/google-button';
import { ConfirmCode } from '@/components/auth/confirm-code';

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUp />
    </Suspense>
  );
}

function SignUp() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const backend = useBackend();
  const next = safeNext(params.get('next'));
  const [intent, setIntent] = useState<'driver' | 'technician'>(params.get('intent') === 'technician' ? 'technician' : 'driver');
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when Supabase asks to confirm the address: the code step follows.
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const destination = intent === 'technician' ? '/pro/onboarding' : (next ?? '/');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!backend) return;
    if (form.password !== form.confirmPassword) {
      setErrors({ confirmPassword: t('errors.password_mismatch') });
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await backend.auth.signUp(
        {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          phone: form.phone.trim() ? form.phone : null,
          intent,
          locale,
        },
        // If the email's link is used instead of the code, it leads to the same place.
        { redirectPath: destination },
      );
      if (res.needsEmailConfirmation) {
        setConfirmFor(form.email.trim());
        return;
      }
      // Signed in already: no separate sign-in step.
      router.replace(destination);
    } catch (e) {
      setErrors(fieldMessages(t, e));
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  if (confirmFor) return <ConfirmCode email={confirmFor} onConfirmed={() => router.replace(destination)} />;

  return (
    <>
      <h1 className="font-display text-[30px] leading-tight text-ink">{t('auth.signUpTitle')}</h1>

      <fieldset className="mt-6">
        <legend className="mb-2.5 text-sm font-medium text-ink-2">{t('auth.iAm')}</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(['driver', 'technician'] as const).map((i) => {
            const Icon = i === 'driver' ? Car : Wrench;
            const active = intent === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setIntent(i)}
                className={cn(
                  // Top-aligned so both cards read on the same lines whatever the text length.
                  'flex flex-col items-start justify-start rounded-xl border p-4 text-left transition-colors',
                  active ? 'border-gold bg-gold/8' : 'border-line bg-surface-1 hover:border-line-strong',
                )}
              >
                <Icon className={cn('size-5', active ? 'text-gold-bright' : 'text-ink-3')} aria-hidden="true" />
                <span className="mt-2 block text-[16px] font-semibold text-ink">{t(`auth.intent.${i}`)}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{t(`auth.intentHelp.${i}`)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <GoogleButton className="mt-6" redirectPath={intent === 'technician' ? '/pro/onboarding' : (next ?? undefined)} />
      <OrWithEmail />

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={t('auth.fullName')} error={errors.fullName}>
          {(p) => <Input {...p} autoComplete="name" required value={form.fullName} onChange={set('fullName')} />}
        </Field>
        <Field label={t('auth.phone')} optional={intent === 'driver' ? t('common.optional') : undefined} error={errors.phone}>
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="6 99 12 34 56" />}
        </Field>
        <Field label={t('auth.email')} error={errors.email}>
          {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={set('email')} />}
        </Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHelp')} error={errors.password}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />}
        </Field>
        <Field label={t('auth.confirmPassword')} error={errors.confirmPassword}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={8} value={form.confirmPassword} onChange={set('confirmPassword')} />}
        </Field>
        {error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[14px] text-danger-soft">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {busy ? t('auth.signingUp') : t('auth.signUp')}
        </Button>
      </form>
      <p className="mt-4 text-center text-[13px] leading-relaxed text-ink-3">
        {t('account.signUpNotice')}{' '}
        <Link href="/privacy" className="text-ink-2 underline underline-offset-4 hover:text-ink">
          {t('account.privacyLink')}
        </Link>
        .
      </p>
      <p className="mt-5 text-center text-[15px] text-ink-3">
        {t('auth.haveAccount')}{' '}
        <Link href={`/auth/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-gold-bright hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </>
  );
}
