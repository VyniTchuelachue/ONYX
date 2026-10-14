'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Gem, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { InboxItem } from '@onyx/core';
import { isBackendError } from '@onyx/core/backend';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAction } from '@/lib/queries';
import { CategoryIcon } from '../requests/category-icon';
import { Pill } from '../ui/bits';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

/** A request offered to this technician. Contact details appear only after accepting. */
export function InboxCard({ item }: { item: InboxItem }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const router = useRouter();
  const [showSummary, setShowSummary] = useState(false);
  const accept = useAction((b, id: string) => b.pro.accept(id), { success: t('pro.accepted'), silentError: true });
  const decline = useAction((b, id: string) => b.pro.decline(id), { success: t('pro.declined') });
  const urgent = item.urgency === 'critical' || item.urgency === 'high';
  const v = item.vehicle;

  return (
    <article className={cn('rounded-xl border bg-surface-1 p-4', item.isDirect ? 'border-gold/50' : 'border-line')}>
      <header className="flex items-start gap-3">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-full bg-surface-3', urgent ? 'text-danger-soft' : 'text-gold')}>
          <CategoryIcon category={item.category} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-semibold text-ink">{t(`categories.${item.category}`)}</h3>
            {item.isDirect && <Pill tone="gold">{t('pro.forYou')}</Pill>}
            {urgent && <Pill tone="danger">{t(`assistant.urgency.${item.urgency}`)}</Pill>}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[14px] text-ink-2">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.placeLabel ?? '—'}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display tabular text-[19px] leading-none text-ink">{fmt.distance(item.distanceKm)}</p>
          <p className="mt-1 text-xs text-ink-3">{fmt.ago(item.createdAt)}</p>
        </div>
      </header>

      <p className="mt-3 text-[14px] text-ink-3">
        {[t(`vehicleTypes.${v.type}`), v.make, v.model, v.color].filter(Boolean).join(', ')}
      </p>
      {item.description && <p className="mt-1.5 line-clamp-3 text-[15px] leading-relaxed text-ink">{item.description}</p>}

      {item.aiSummary && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowSummary((s) => !s)}
            aria-expanded={showSummary}
            className="flex items-center gap-1.5 text-[13px] font-medium text-violet-soft"
          >
            <Gem className="size-3.5" aria-hidden="true" />
            {t('request.aiSummary')}
          </button>
          {showSummary && <p className="mt-1.5 rounded-md bg-violet/8 p-3 text-[14px] leading-relaxed text-ink-2">{item.aiSummary}</p>}
        </div>
      )}

      <p className="mt-3 text-[12px] text-ink-3">{t('pro.contactAfterAccept')}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Button
          size="lg"
          loading={accept.isPending}
          disabled={decline.isPending}
          onClick={() =>
            accept.mutate(item.id, {
              onSuccess: () => router.push(`/pro/jobs/${item.id}`),
              onError: (e) => toast.error(isBackendError(e) && e.code === 'conflict' ? t('errors.conflict') : t('errors.generic')),
            })
          }
        >
          {t('pro.accept')}
        </Button>
        <Button size="lg" variant="secondary" loading={decline.isPending} disabled={accept.isPending} onClick={() => decline.mutate(item.id)}>
          {t('pro.decline')}
        </Button>
      </div>
    </article>
  );
}
