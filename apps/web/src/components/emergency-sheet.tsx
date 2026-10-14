'use client';

import { Ambulance, Flame, Phone, Share2, Shield } from 'lucide-react';
import { EMERGENCY_NUMBERS } from '@onyx/core';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useLocation } from '@/lib/location';
import { Sheet } from './ui/sheet';
import { Button } from './ui/button';

const ICONS = { fire: Flame, ambulance: Ambulance, police: Shield } as const;

/** Emergency numbers and the roadside safety routine, one tap from anywhere. */
export function EmergencySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, ta } = useI18n();
  const { position } = useLocation();

  const shareLocation = async () => {
    const url = position ? `https://maps.google.com/?q=${position.lat.toFixed(5)},${position.lng.toFixed(5)}` : null;
    const text = url ? t('emergency.shareText', { url }) : t('emergency.locationUnknown');
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success(t('common.copied'));
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('emergency.title')} description={t('emergency.intro')}>
      <ul className="space-y-2">
        {EMERGENCY_NUMBERS.map(({ id, number }) => {
          const Icon = ICONS[id];
          return (
            <li key={id}>
              <a
                href={`tel:${number}`}
                className="flex h-16 items-center gap-4 rounded-lg border border-danger/30 bg-danger/8 px-4 transition-colors hover:bg-danger/14"
              >
                <Icon className="size-6 text-danger-soft" aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-[15px] font-medium text-ink">{t(`emergency.${id}`)}</span>
                  <span className="block text-[13px] text-ink-3">{t('emergency.call', { number })}</span>
                </span>
                <span className="font-display tabular text-2xl text-danger-soft">{number}</span>
                <Phone className="size-5 text-danger-soft" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-7 mb-3 font-wide text-[15px] font-semibold text-ink">{t('emergency.checklistTitle')}</h3>
      <ol className="space-y-2.5">
        {ta('emergency.checklist').map((item, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-snug text-ink-2">
            <span className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-semibold text-gold">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>

      <Button variant="secondary" className="mt-6 w-full" icon={<Share2 className="size-4" />} onClick={shareLocation}>
        {t('emergency.shareLocation')}
      </Button>
    </Sheet>
  );
}
