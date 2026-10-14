'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';

/** Confirm a cancellation (with a reason the other party sees) or a withdrawal. */
export function CancelSheet({
  open,
  onClose,
  onConfirm,
  loading,
  title,
  description,
  withReasons = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
  title?: string;
  description?: string;
  withReasons?: boolean;
}) {
  const { t, ta } = useI18n();
  const reasons = ta('request.cancelReasons');
  const [reason, setReason] = useState(reasons[0] ?? '');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title ?? t('request.cancelTitle')}
      description={description ?? t('request.cancelBody')}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button variant="danger" size="lg" className="flex-1" loading={loading} onClick={() => onConfirm(withReasons ? reason : '')}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      {withReasons && (
        <div role="radiogroup" className="space-y-2">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className="flex h-12 w-full items-center gap-3 rounded-lg border border-line px-4 text-left text-[15px] text-ink-2 aria-checked:border-gold/60 aria-checked:text-ink"
            >
              <span className="grid size-5 place-items-center rounded-full border border-line-strong" aria-hidden="true">
                {reason === r && <span className="size-2.5 rounded-full bg-gold" />}
              </span>
              {r}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
