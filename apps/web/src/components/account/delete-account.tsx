'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { isBackendError } from '@onyx/core/backend';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/errors';
import { forgetThisDevice } from '@/lib/alerts';
import { isDemo } from '@/lib/config';
import { Button, type ButtonVariant } from '../ui/button';
import { Sheet } from '../ui/sheet';
import { cn } from '@/lib/utils';

/** What deletion erases and what it keeps, in plain words (the same as the privacy policy). */
export function DeletionDetails({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <dl className={cn('space-y-4 text-[14px] leading-relaxed', className)}>
      <div>
        <dt className="font-medium text-ink">{t('account.goneTitle')}</dt>
        <dd className="mt-1 text-ink-2">{t('account.gone')}</dd>
      </div>
      <div>
        <dt className="font-medium text-ink">{t('account.keptTitle')}</dt>
        <dd className="mt-1 text-ink-2">{t('account.kept')}</dd>
      </div>
    </dl>
  );
}

/** "Delete my account", with a confirmation that says exactly what happens. */
export function DeleteAccount({ variant = 'ghost', className }: { variant?: ButtonVariant; className?: string }) {
  const { t } = useI18n();
  const backend = useBackend();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!backend) return;
    setBusy(true);
    setError(null);
    try {
      await backend.auth.deleteAccount();
      // The account's saved phones are gone on the server; stop this one listening too.
      await forgetThisDevice(null);
      toast.success(t('account.deleted'));
      router.replace('/');
    } catch (e) {
      if (isBackendError(e) && e.code === 'conflict') setError(t('account.activeJob'));
      else if (isBackendError(e) && e.code === 'forbidden') setError(isDemo ? t('account.demoCannot') : t('account.adminCannot'));
      else setError(errorMessage(t, e));
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        className={cn(variant === 'ghost' && 'text-danger-soft hover:text-danger-soft', className)}
        icon={<Trash2 className="size-4" aria-hidden="true" />}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t('account.deleteTitle')}
      </Button>
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={t('account.deleteTitle')}
        description={t('account.deleteIntro')}
        footer={
          <Button size="lg" variant="danger" className="w-full" loading={busy} onClick={() => void confirm()}>
            {t('account.deleteConfirm')}
          </Button>
        }
      >
        <DeletionDetails />
        {error && (
          <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[14px] text-danger-soft">
            {error}
          </p>
        )}
      </Sheet>
    </>
  );
}
