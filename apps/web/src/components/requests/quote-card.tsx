'use client';

import type { ReactNode } from 'react';
import { quoteItemTotal, type Quote } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Pill, type Tone } from '../ui/bits';

const STATUS_TONE: Record<Quote['status'], Tone> = {
  pending: 'gold',
  accepted: 'ok',
  declined: 'danger',
  superseded: 'neutral',
};

/** A quote, line by line. The total is always the server's number. */
export function QuoteCard({
  quote,
  actions,
  className,
  perspective = 'other',
}: {
  quote: Quote;
  actions?: ReactNode;
  className?: string;
  /** The driver is asked to answer; everyone else just sees that it was sent. */
  perspective?: 'driver' | 'other';
}) {
  const { t } = useI18n();
  const fmt = useFormat();
  const muted = quote.status === 'superseded' || quote.status === 'declined';
  const statusLabel =
    quote.status === 'pending' && perspective !== 'driver' ? t('request.status.quoted') : t(`request.quoteStatus.${quote.status}`);
  return (
    <section className={cn('rounded-xl border bg-surface-1', quote.status === 'pending' ? 'border-gold/45' : 'border-line', className)}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4">
        <h3 className="font-wide text-[16px] font-semibold text-ink">{t('request.quote')}</h3>
        <div className="flex items-center gap-2">
          <span className="tabular text-xs text-ink-3">{fmt.dateTime(quote.createdAt)}</span>
          <Pill tone={STATUS_TONE[quote.status]}>{statusLabel}</Pill>
        </div>
      </header>
      <ul className={cn('mt-3 divide-y divide-line px-4', muted && 'opacity-60')}>
        {quote.items.map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="text-[15px] text-ink">{item.label}</p>
              <p className="tabular text-[13px] text-ink-3">
                {t(`request.itemKinds.${item.kind}`)}
                {item.quantity > 1 ? `, ${item.quantity} × ${fmt.money(item.unitPrice)}` : ''}
              </p>
            </div>
            <p className="tabular shrink-0 text-[15px] text-ink">{fmt.money(quoteItemTotal(item))}</p>
          </li>
        ))}
      </ul>
      <div className={cn('mx-4 flex items-baseline justify-between border-t border-line-strong py-3', muted && 'opacity-60')}>
        <span className="text-[15px] font-medium text-ink-2">{t('request.total')}</span>
        <span className={cn('font-display tabular text-[22px] text-ink', muted && 'line-through decoration-ink-3')}>{fmt.money(quote.total)}</span>
      </div>
      {quote.note && <p className="px-4 pb-3 text-[14px] leading-relaxed text-ink-2">{quote.note}</p>}
      {actions && <div className="border-t border-line p-4">{actions}</div>}
    </section>
  );
}
