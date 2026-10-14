'use client';

import { effectiveAvailability, type DisplayAvailability, type Technician } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { Pill, type Tone } from '../ui/bits';

const TONE: Record<DisplayAvailability, Tone> = {
  available: 'ok',
  busy: 'gold',
  offline: 'neutral',
  unconfirmed: 'neutral',
  unverified: 'neutral',
};

export function useDisplayAvailability(t: Pick<Technician, 'availability' | 'lastSeenAt' | 'availabilityUpdatedAt'>, offline = false) {
  return effectiveAvailability(t, new Date(), { offline });
}

export function AvailabilityPill({ technician, offline = false, className }: { technician: Technician; offline?: boolean; className?: string }) {
  const { t } = useI18n();
  const a = useDisplayAvailability(technician, offline);
  return (
    <Pill tone={TONE[a]} dot className={className}>
      <span title={a === 'unconfirmed' || a === 'unverified' ? t(`availabilityHelp.${a}`) : undefined}>{t(`availability.${a}`)}</span>
    </Pill>
  );
}
