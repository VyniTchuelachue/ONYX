'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { isActive } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useMyRequests } from '@/lib/queries';
import { cn } from '@/lib/utils';

/** The driver's live job, pinned above everything else on the home screen. */
export function ActiveRequestBanner({ className }: { className?: string }) {
  const { t } = useI18n();
  const { data } = useMyRequests();
  const active = data?.find((r) => isActive(r.status));
  if (!active) return null;
  return (
    <Link
      href={`/requests/${active.id}`}
      className={cn('flex items-center gap-4 rounded-xl border border-gold/35 bg-gold/8 p-4 transition-colors hover:border-gold/60', className)}
    >
      <span className="road-dashes w-[3px] self-stretch rounded-full" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-ink-3">{t('home.activeRequest')}</span>
        <span className="block truncate font-wide text-[16px] font-semibold text-ink">
          {t(`request.status.${active.status}`)}
          {active.technicianName ? `, ${active.technicianName}` : ''}
        </span>
        <span className="tabular block text-xs text-ink-3">{active.code}</span>
      </span>
      <ChevronRight className="size-5 text-gold" aria-hidden="true" />
    </Link>
  );
}
