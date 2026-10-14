'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { ArrowRight, LocateFixed, MapPin, TriangleAlert, Wrench } from 'lucide-react';
import { m } from 'motion/react';
import {
  availabilityRank,
  effectiveAvailability,
  rankOffline,
  type CorridorId,
} from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useEnsureLocation, useLocation } from '@/lib/location';
import { useLocationLabel } from '@/lib/use-location-label';
import { useNearby } from '@/lib/queries';
import { useOnline } from '@/lib/online';
import { useOfflinePack } from '@/lib/offline-pack';
import { useSession } from '@/lib/session';
import { writeSession } from '@/lib/storage';
import { AskBox, ASSISTANT_PREFILL_KEY } from '@/components/assistant/ask-box';
import { useShellActions } from '@/components/shell/shell-actions';
import { TechnicianRow } from '@/components/technicians/technician-row';
import { ActiveRequestBanner } from '@/components/requests/active-request-banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { SectionTitle, Skeleton } from '@/components/ui/bits';

const CHIPS = ['flat_tire', 'battery', 'overheating', 'wont_start', 'accident'] as const;

export default function HomePage() {
  useEnsureLocation();
  const { t } = useI18n();
  const router = useRouter();
  const { openEmergency } = useShellActions();
  const { session } = useSession();

  const ask = (text: string) => {
    writeSession(ASSISTANT_PREFILL_KEY, text);
    router.push('/assistant');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6">
      {session && <ActiveRequestBanner className="mt-4" />}

      <section className="pt-8 pb-8 sm:pt-12" aria-labelledby="hero-title">
        <m.h1
          id="hero-title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[34px] leading-[1.05] text-ink sm:text-[46px]"
        >
          {t('home.headline')}
        </m.h1>
        <p className="mt-3 max-w-[34ch] text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">{t('home.sub')}</p>

        <AskBox variant="hero" onSubmit={ask} className="mt-7" />

        <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => ask(t(`home.chips.${c}`))}
              className="h-9 shrink-0 rounded-full border border-line bg-surface-1 px-3.5 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              {t(`home.chips.${c}`)}
            </button>
          ))}
        </div>

        <div className="mt-7 grid gap-2.5 sm:grid-cols-[1fr_auto]">
          <ButtonLink href="/technicians" size="lg" icon={<Wrench className="size-5" aria-hidden="true" />}>
            {t('home.findCta')}
          </ButtonLink>
          <Button size="lg" variant="danger" onClick={openEmergency} icon={<TriangleAlert className="size-5" aria-hidden="true" />}>
            {t('home.emergencyCta')}
          </Button>
        </div>
      </section>

      <NearbySection />

      <SafetyNote />

      {session?.profile.role !== 'technician' && session?.profile.role !== 'admin' && (
        <Link
          href={session ? '/pro/onboarding' : '/auth/sign-up?intent=technician'}
          className="group mt-10 mb-4 flex flex-col items-start gap-3 rounded-xl border border-line bg-surface-1 p-5 transition-colors hover:border-gold/40 sm:flex-row sm:items-center sm:gap-4"
        >
          <div className="min-w-0 flex-1">
            <p className="font-wide text-[16px] font-semibold text-ink">{t('home.joinPro')}</p>
            <p className="mt-1 text-[14px] text-ink-3">{t('home.joinProBody')}</p>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-medium text-gold-bright">
            {t('home.joinProCta')}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      )}
    </div>
  );
}

function NearbySection() {
  const { t, tp } = useI18n();
  const { position, status, locate } = useLocation();
  const { openLocation } = useShellActions();
  const loc = useLocationLabel();
  const online = useOnline();
  const pack = useOfflinePack();
  const corridor = loc.context && !loc.context.inDouala ? loc.context.corridor : null;

  const nearby = useNearby(
    position && online
      ? corridor
        ? { center: position, radiusKm: 150, corridor, limit: 30 }
        : { center: position, radiusKm: 15, limit: 30 }
      : null,
  );

  const list = useMemo(() => {
    const source = online ? nearby.data : position && pack ? rankOffline(pack.technicians, position) : undefined;
    if (!source) return undefined;
    const now = new Date();
    return [...source]
      .sort(
        (a, b) =>
          availabilityRank(effectiveAvailability(a, now, { offline: !online })) -
            availabilityRank(effectiveAvailability(b, now, { offline: !online })) || a.distanceKm - b.distanceKm,
      )
      .slice(0, 3);
  }, [nearby.data, online, pack, position]);

  if (!position) {
    return (
      <section className="rounded-xl border border-line bg-surface-1 p-5">
        <p className="font-wide text-[16px] font-semibold text-ink">{t('location.chooseAreaTitle')}</p>
        <p className="mt-1.5 text-[14px] text-ink-3">{status === 'denied' ? t('location.deniedHelp') : t('requestNew.locationNeeded')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" icon={<LocateFixed className="size-4 text-gold" />} loading={status === 'locating'} onClick={locate}>
            {t('location.useGps')}
          </Button>
          <Button variant="ghost" icon={<MapPin className="size-4" />} onClick={openLocation}>
            {t('location.chooseArea')}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="nearby-title">
      {corridor && (
        <div className="mb-5 flex gap-3.5 rounded-xl border border-blue/30 bg-blue/8 p-4">
          <span className="road-dashes mt-1 w-[3px] shrink-0 self-stretch rounded-full" aria-hidden="true" />
          <div>
            <p className="font-wide text-[15px] font-semibold text-ink">
              {t('home.corridorTitle', { corridor: t(`corridors.${corridor as CorridorId}`) })}
            </p>
            {nearby.data && (
              <p className="mt-1 text-[14px] text-ink-2">{tp('home.corridorBody', nearby.data.length)}</p>
            )}
          </div>
        </div>
      )}
      <SectionTitle
        id="nearby-title"
        action={
          <Link href="/technicians" className="text-sm font-medium text-gold-bright hover:text-gold">
            {t('common.seeAll')}
          </Link>
        }
      >
        {t('home.nearbyTitle')}
      </SectionTitle>
      {list === undefined ? (
        <div className="space-y-4 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3.5">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-line px-4 py-6 text-center text-[15px] text-ink-3">{t('home.nearbyEmpty')}</p>
      ) : (
        <div className="divide-y divide-line">
          {list.map((tech) => (
            <TechnicianRow key={tech.id} technician={tech} compact offline={!online} />
          ))}
        </div>
      )}
    </section>
  );
}

function SafetyNote() {
  const { t } = useI18n();
  const { openEmergency } = useShellActions();
  return (
    <aside className="mt-10 flex gap-4 rounded-xl bg-surface-1 p-5">
      <span className="road-dashes w-[3px] shrink-0 rounded-full" aria-hidden="true" />
      <div>
        <p className="font-wide text-[15px] font-semibold text-gold-bright">{t('home.safetyTitle')}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{t('home.safetyBody')}</p>
        <button type="button" onClick={openEmergency} className="mt-2 text-sm font-medium text-danger-soft underline-offset-4 hover:underline">
          {t('emergency.title')}: 118, 119, 117
        </button>
      </div>
    </aside>
  );
}
