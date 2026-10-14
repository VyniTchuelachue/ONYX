'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { RequestListItem, RequestStatus } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { Pill, type Tone } from '../ui/bits';
import { CategoryIcon } from './category-icon';

export const STATUS_TONE: Record<RequestStatus, Tone> = {
  pending: 'gold',
  accepted: 'blue',
  en_route: 'blue',
  arrived: 'blue',
  quoted: 'violet',
  in_progress: 'blue',
  completed: 'ok',
  cancelled: 'neutral',
};

export function StatusPill({ status }: { status: RequestStatus }) {
  const { t } = useI18n();
  return (
    <Pill tone={STATUS_TONE[status]} dot={status !== 'completed' && status !== 'cancelled'}>
      {t(`request.status.${status}`)}
    </Pill>
  );
}

/** A request in a list: what, who, when, and where it stands. */
export function RequestRow({ request: r, href, who }: { request: RequestListItem; href: string; who?: 'technician' | 'driver' }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const party = who === 'driver' ? r.contactName : (r.technicianName ?? (r.status === 'pending' ? t('request.headline.searching') : t('admin.unassigned')));
  return (
    <Link href={href} className="group flex items-center gap-3.5 py-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface-1 text-gold">
        <CategoryIcon category={r.category} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[16px] font-medium text-ink">{t(`categories.${r.category}`)}</span>
          <span className="tabular shrink-0 text-xs text-ink-3">{r.code}</span>
        </span>
        <span className="mt-0.5 block truncate text-[14px] text-ink-2">{party}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusPill status={r.status} />
          <span className="text-xs text-ink-3">{fmt.ago(r.createdAt)}</span>
          {r.acceptedTotal !== null && <span className="tabular text-xs text-ink-2">{fmt.money(r.acceptedTotal)}</span>}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
