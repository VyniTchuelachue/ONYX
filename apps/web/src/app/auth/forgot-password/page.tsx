'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { errorMessage, fieldMessages } from '@/lib/errors';
import { homeFor } from '@/lib/redirects';
import { isDemo } from '@/lib/config';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { DemoRolePicker } from '@/components/demo-role-picker';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const backend = useBackend();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!backend) return;
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      await backend.auth.requestPasswordReset(email);
      setSentTo(email.trim());
    } catch (e) {
      const fields = fieldMessages(t, e);
      if (fields.email) setFieldError(fields.email);
      else setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-[30px] leading-tight text-ink">{t('auth.forgotTitle')}</h1>

      {isDemo ? (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t('auth.forgotDemo')}</p>
          <DemoRolePicker className="mt-6" onDone={(role) => router.replace(homeFor(role))} />
        </>
      ) : sentTo ? (
        <div role="status" className="mt-6 flex gap-3.5 rounded-xl border border-line bg-surface-1 p-4">
          <MailCheck className="mt-0.5 size-6 shrink-0 text-gold" aria-hidden="true" />
          <p className="text-[15px] leading-relaxed text-ink-2">{t('auth.linkSent', { email: sentTo })}</p>
        </div>
      ) : (
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-[15px] leading-relaxed text-ink-2">{t('auth.forgotIntro')}</p>
          <Field label={t('auth.email')} error={fieldError}>
            {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          {error && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[14px] text-danger-soft">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {t('auth.sendLink')}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center">
        <Link href="/auth/sign-in" className="text-[15px] font-medium text-gold-bright hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      </p>
    </>
  );
}
