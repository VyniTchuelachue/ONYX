'use client';

import { LocateFixed } from 'lucide-react';
import { CORRIDOR_TOWNS, DOUALA_QUARTERS, type Place } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useLocation } from '@/lib/location';
import { Sheet } from './ui/sheet';
import { Button } from './ui/button';

/** Pick a position by hand when GPS is refused or unavailable. */
export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { locate, setManualArea, status, manualArea } = useLocation();

  const choose = (p: Place) => {
    setManualArea(p);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('location.chooseAreaTitle')}
      description={status === 'denied' ? t('location.deniedHelp') : undefined}
    >
      <Button
        variant="secondary"
        size="lg"
        className="mb-6 w-full"
        icon={<LocateFixed className="size-5 text-gold" />}
        loading={status === 'locating'}
        onClick={() => {
          locate();
          onClose();
        }}
      >
        {t('location.useGps')}
      </Button>

      <PlaceGroup title={t('location.douala')} places={DOUALA_QUARTERS} selected={manualArea} onChoose={choose} />
      <PlaceGroup title={t('location.roads')} places={CORRIDOR_TOWNS} selected={manualArea} onChoose={choose} />
    </Sheet>
  );
}

function PlaceGroup({ title, places, selected, onChoose }: { title: string; places: Place[]; selected: string | null; onChoose: (p: Place) => void }) {
  const sorted = [...places].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return (
    <section className="mb-6">
      <h3 className="mb-2.5 text-sm font-medium text-ink-3">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {sorted.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => onChoose(p)}
            aria-pressed={selected === p.name}
            className="h-10 rounded-full border border-line bg-surface-2 px-3.5 text-[15px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink aria-pressed:border-gold/60 aria-pressed:text-gold-bright"
          >
            {p.name}
          </button>
        ))}
      </div>
    </section>
  );
}
