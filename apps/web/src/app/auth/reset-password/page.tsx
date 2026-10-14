'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { useSession } from '@/lib/session';
import { errorMessage, fieldMessages } from '@/lib/errors';
import { homeFor } from '@/lib/redirects';
import { Field, PasswordInput } from '@/components/ui/field';
import { Button, ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * Landing page of the reset link. Supabase signs the person in from the link itself, so a
 * session here means the link was valid; without one it expired or was already used.
 */
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const backend = useBackend();
  const session = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session.status === 'loading') {
    return (
      <div role="status" className="grid place-items-center pt-16">
        <Spinner className="size-6 text-gold" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  if (session.status === 'signed-out') {
    return (
      <div className="pt-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full border border-line bg-surface-1 text-gold">
          <KeyRound className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-[26px] text-ink">{t('auth.resetTitle')}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{t('auth.resetLinkInvalid')}</p>
        <ButtonLink href="/auth/forgot-password" size="lg" className="mt-6">
          {t('auth.requestNewLink')}
        </ButtonLink>
      </div>
    );
  }

  const role = session.session.profile.role;
  const submit = async () => {
    if (!backend) return;
    if (password !== confirmation) {
      setConfirmError(t('errors.password_mismatch'));
      return;
    }
    setConfirmError(null);
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      await backend.auth.updatePassword(password);
      toast.success(t('auth.passwordUpdated'));
      router.replace(homeFor(role));
    } catch (e) {
      const fields = fieldMessages(t, e);
      if (fields.password) setFieldError(fields.password);
      else setError(errorMessage(t, e));
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-[30px] leading-tight text-ink">{t('auth.resetTitle')}</h1>
      <p className="mt-2 text-[15px] text-ink-3">{session.session.email}</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={t('auth.newPassword')} hint={t('auth.passwordHelp')} error={fieldError}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field label={t('auth.confirmPassword')} error={confirmError}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />}
        </Field>
        {error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[14px] text-danger-soft">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {t('auth.savePassword')}
        </Button>
      </form>
    </>
  );
}
