'use client';

import Link from 'next/link';
import { BadgeCheck, MapPin, Truck } from 'lucide-react';
import type { TechnicianWithDistance } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Monogram, Rating } from '../ui/bits';
import { AvailabilityPill } from './availability';
import { ContactActions } from './contact-actions';

/**
 * One technician in a list. Distance sits on the right like a kilometre marker:
 * it's what a stranded driver scans for first.
 */
export function TechnicianRow({
  technician,
  offline = false,
  compact = false,
  highlight = false,
  onFocus,
}: {
  technician: TechnicianWithDistance;
  offline?: boolean;
  compact?: boolean;
  highlight?: boolean;
  onFocus?: () => void;
}) {
  const { t, tp } = useI18n();
  const fmt = useFormat();
  const specialties = technician.specialties.slice(0, 2).map((s) => t(`specialtyShort.${s}`));

  return (
    <article
      className={cn('group relative py-4 transition-colors', highlight && 'bg-surface-1')}
      onMouseEnter={onFocus}
      aria-label={technician.businessName}
    >
      <div className="flex gap-3.5">
        <Monogram name={technician.businessName} verified={technician.verificationStatus === 'verified'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-1.5 text-[16px] leading-snug font-semibold text-ink">
                <Link href={`/technicians/${technician.id}`} className="truncate after:absolute after:inset-0 after:content-['']">
                  {technician.businessName}
                </Link>
                {technician.verificationStatus === 'verified' && (
                  <BadgeCheck className="size-4 shrink-0 text-gold" aria-label={t('technicians.verified')} />
                )}
              </h3>
              <p className="mt-0.5 truncate text-[13px] text-ink-2">{specialties.join(', ')}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display tabular text-[19px] leading-none text-ink">{fmt.distance(technician.distanceKm)}</p>
              {technician.mobileService && !offline && (
                <p className="tabular mt-1 text-xs text-ink-3">{t('technicians.eta', { duration: fmt.eta(technician.distanceKm) })}</p>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <AvailabilityPill technician={technician} offline={offline} />
            {technician.area && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                <MapPin className="size-3.5" aria-hidden="true" />
                {technician.area}
              </span>
            )}
            {technician.ratingCount > 0 ? (
              <Rating value={technician.ratingAvg} count={`(${technician.ratingCount})`} />
            ) : (
              <span className="text-xs text-ink-3">{t('technicians.newcomer')}</span>
            )}
            {!compact && technician.jobsCompleted > 0 && (
              <span className="text-xs text-ink-3">{tp('technicians.jobs', technician.jobsCompleted)}</span>
            )}
            {technician.hasTowTruck && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                <Truck className="size-3.5" aria-hidden="true" />
                {t('technicians.towTruck')}
              </span>
            )}
          </div>

          {!compact && <ContactActions technician={technician} className="relative z-10 mt-3" showRequest={!offline} showSms={offline} />}
        </div>
      </div>
    </article>
  );
}
