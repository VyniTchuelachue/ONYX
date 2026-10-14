'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Gem, MapPin, PhoneCall, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { rankOffline } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useBackend } from '@/lib/backend';
import { useOnline } from '@/lib/online';
import { useEnsureLocation, useLocation } from '@/lib/location';
import { useLocationLabel } from '@/lib/use-location-label';
import { refreshOfflinePack, useFavorites, useOfflinePack } from '@/lib/offline-pack';
import { errorMessage } from '@/lib/errors';
import { PageContainer, PageHeader } from '@/components/page';
import { TechnicianRow } from '@/components/technicians/technician-row';
import { useShellActions } from '@/components/shell/shell-actions';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/bits';

export default function OfflinePage() {
  useEnsureLocation();
  const { t, tp } = useI18n();
  const fmt = useFormat();
  const backend = useBackend();
  const online = useOnline();
  const pack = useOfflinePack();
  const favorites = useFavorites();
  const { position } = useLocation();
  const loc = useLocationLabel();
  const { openLocation } = useShellActions();
  const [updating, setUpdating] = useState(false);

  const ranked = useMemo(() => {
    if (!pack) return [];
    const from = position ?? pack.center;
    return rankOffline(pack.technicians, from, { favorites: favorites.ids }).slice(0, 60);
  }, [pack, position, favorites.ids]);

  const update = async () => {
    if (!backend) return;
    const center = position ?? pack?.center;
    if (!center) {
      openLocation();
      return;
    }
    setUpdating(true);
    try {
      await refreshOfflinePack(backend, { lat: center.lat, lng: center.lng });
      toast.success(t('offline.updated'));
    } catch (e) {
      toast.error(errorMessage(t, e));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title={t('offline.title')} subtitle={t('offline.intro')} />

      <section className="rounded-xl border border-line bg-surface-1 p-5">
        <p className="text-[16px] font-medium text-ink">
          {pack ? tp('offline.packStatus', pack.technicians.length, { time: fmt.ago(pack.savedAt) }) : t('offline.packEmpty')}
        </p>
        <p className="mt-1 text-[14px] text-ink-3">{t('offline.coverage')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" icon={<RefreshCw className="size-4" aria-hidden="true" />} loading={updating} disabled={!online} onClick={() => void update()}>
            {updating ? t('offline.updating') : t('offline.update')}
          </Button>
          <span className="text-[13px] text-ink-3">{online ? t('offline.autoSync') : t('offline.needsNetwork')}</span>
        </div>
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-xl border border-line p-4">
          <PhoneCall className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
          <p className="text-[14px] leading-snug text-ink-2">{t('offline.callsWork')}</p>
        </div>
        <Link href="/assistant" className="flex gap-3 rounded-xl border border-line p-4 transition-colors hover:border-violet/40">
          <Gem className="mt-0.5 size-5 shrink-0 text-violet-soft" aria-hidden="true" />
          <span className="text-[14px] leading-snug text-ink-2">
            {t('offline.assistantWorks')} <span className="font-medium text-ink">{t('offline.openAssistant')}</span>
          </span>
        </Link>
      </div>

      {ranked.length > 0 && (
        <section className="mt-8">
          <SectionTitle
            action={
              <button type="button" onClick={openLocation} className="flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
                <MapPin className="size-4" aria-hidden="true" />
                <span className="max-w-[40vw] truncate">{loc.label}</span>
              </button>
            }
          >
            {t('nav.find')}
          </SectionTitle>
          <p className="mb-2 text-[13px] text-gold-bright">{t('offline.unverifiedNote')}</p>
          <div className="divide-y divide-line">
            {ranked.map((x) => (
              <TechnicianRow key={x.id} technician={x} offline />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
