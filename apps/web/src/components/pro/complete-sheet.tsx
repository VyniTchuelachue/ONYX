'use client';

import { useState } from 'react';
import { commissionFor, PAYMENT_METHODS, type PaymentMethod } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAction } from '@/lib/queries';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/field';
import { cn } from '@/lib/utils';

/** Close the job and record how the customer paid. */
export function CompleteSheet({ requestId, open, onClose, suggestedAmount }: { requestId: string; open: boolean; onClose: () => void; suggestedAmount: number | null }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState(suggestedAmount !== null ? String(suggestedAmount) : '');
  const value = Math.max(0, Math.round(Number(amount) || 0));
  const complete = useAction((b, _: void) => b.pro.complete(requestId, { method, amount: value }), { success: t('pro.completed') });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('pro.completeTitle')}
      footer={
        <Button size="lg" className="w-full" loading={complete.isPending} onClick={() => complete.mutate(undefined, { onSuccess: onClose })}>
          {t('pro.completeConfirm')}
        </Button>
      }
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-2">{t('pro.paymentMethod')}</legend>
        <div role="radiogroup" className="grid gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={cn(
                'flex h-12 items-center gap-3 rounded-lg border px-4 text-left text-[15px]',
                method === m ? 'border-gold bg-gold/10 text-ink' : 'border-line text-ink-2',
              )}
            >
              <span className="grid size-5 place-items-center rounded-full border border-line-strong" aria-hidden="true">
                {method === m && <span className="size-2.5 rounded-full bg-gold" />}
              </span>
              {t(`request.methods.${m}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-5">
        <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-ink-2">
          {t('pro.amountReceived')}
        </label>
        <div className="relative">
          <Input id="amount" inputMode="numeric" className="tabular pr-16 text-lg" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 8))} />
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-ink-3">FCFA</span>
        </div>
        <p className="mt-2 text-[13px] text-ink-3">{t('pro.commissionNote', { amount: fmt.money(commissionFor(value)) })}</p>
      </div>
    </Sheet>
  );
}
