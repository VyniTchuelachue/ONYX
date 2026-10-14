'use client';

import { useState } from 'react';
import type { Session } from '@onyx/core/backend';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { errorMessage, fieldMessages } from '@/lib/errors';
import { Field, Input } from '../ui/field';
import { Button } from '../ui/button';

/**
 * The last step of an email sign-up when Supabase asks to confirm the address: the 6-digit code
 * from the email signs the person in right here.
 */
export function ConfirmCode({ email, onConfirmed }: { email: string; onConfirmed: (session: Session) => void }) {
  const { t } = useI18n();
  const backend = useBackend();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const confirm = async () => {
    if (!backend) return;
    setBusy(true);
    setError(null);
    try {
      onConfirmed(await backend.auth.verifySignUpCode(email, code));
    } catch (e) {
      setError(fieldMessages(t, e).code ?? errorMessage(t, e));
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!backend) return;
    setResending(true);
    try {
      await backend.auth.resendSignUpCode(email);
      toast.success(t('auth.codeResent'));
    } catch (e) {
      toast.error(errorMessage(t, e));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <span className="grid size-14 place-items-center rounded-full border border-line bg-surface-1 text-gold">
        <MailCheck className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-display text-[28px] leading-tight text-ink">{t('auth.codeTitle')}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('auth.codeIntro', { email })}</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        <Field label={t('auth.code')} error={error}>
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              className="tabular text-center text-[22px] tracking-[0.3em]"
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {t('auth.confirmCode')}
        </Button>
      </form>
      <Button variant="ghost" className="mt-3 w-full" loading={resending} onClick={() => void resend()}>
        {t('auth.resendCode')}
      </Button>
    </>
  );
}
