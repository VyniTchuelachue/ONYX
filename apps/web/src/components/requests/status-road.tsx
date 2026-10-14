'use client';

import { Check } from 'lucide-react';
import { MILESTONES, milestoneIndex, type Milestone, type ServiceRequest } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';

const reachedAt = (r: ServiceRequest, m: Milestone): string | null =>
  ({
    pending: r.createdAt,
    accepted: r.acceptedAt,
    en_route: r.enRouteAt,
    arrived: r.arrivedAt,
    in_progress: r.startedAt,
    completed: r.completedAt,
  })[m];

/**
 * The job as a stretch of road: each milestone is a marker on the centre line, the
 * travelled part is painted gold, the road ahead is dim.
 */
export function StatusRoad({ request, className }: { request: ServiceRequest; className?: string }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const current = milestoneIndex(request.status);
  const done = request.status === 'completed';

  return (
    <ol className={cn('relative', className)} aria-label={t('request.timeline')}>
      {MILESTONES.map((m, i) => {
        const at = reachedAt(request, m);
        const passed = i < current || (done && i === current);
        const isCurrent = i === current && !done;
        const last = i === MILESTONES.length - 1;
        return (
          <li key={m} className="relative flex gap-4 pb-6 last:pb-0" aria-current={isCurrent ? 'step' : undefined}>
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-7 bottom-1 left-[13px] w-[3px] rounded-full',
                  i < current ? 'road-dashes' : 'bg-[repeating-linear-gradient(to_bottom,var(--color-line-strong)_0_9px,transparent_9px_18px)]',
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 grid size-[29px] shrink-0 place-items-center rounded-full',
                passed && 'bg-gold text-onyx',
                isCurrent && 'gem-ring bg-surface-1',
                !passed && !isCurrent && 'border border-line-strong bg-onyx',
              )}
            >
              {passed && <Check className="size-4" strokeWidth={3} />}
              {isCurrent && (
                <>
                  <span className="absolute size-3 rounded-full bg-gold-bright/40 animate-pulse-ring" />
                  <span className="size-2.5 rounded-full bg-gold-bright" />
                </>
              )}
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn('text-[15px] leading-tight font-medium', passed || isCurrent ? 'text-ink' : 'text-ink-3')}>
                {t(`request.milestones.${m}`)}
              </p>
              {at && (passed || isCurrent) && <p className="tabular mt-0.5 text-[13px] text-ink-3">{fmt.time(at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
