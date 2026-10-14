'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { List, LocateFixed, Map as MapIcon, MapPin, Search, WifiOff } from 'lucide-react';
import {
  CORRIDOR_IDS,
  SEARCH_RADII_KM,
  SPECIALTIES,
  availabilityRank,
  effectiveAvailability,
  rankOffline,
  type CorridorId,
  type Specialty,
} from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useEnsureLocation, useLocation } from '@/lib/location';
import { useLocationLabel } from '@/lib/use-location-label';
import { useNearby } from '@/lib/queries';
import { useOnline } from '@/lib/online';
import { useFavorites, useOfflinePack } from '@/lib/offline-pack';
import { PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { TechnicianRow } from '@/components/technicians/technician-row';
import { useShellActions } from '@/components/shell/shell-actions';
import { Chip, Segmented } from '@/components/ui/choice';
import { Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/bits';
import type { MapMarker } from '@/components/map/onyx-map';

const OnyxMap = dynamic(() => import('@/components/map/onyx-map'), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});

export default function TechniciansPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TechniciansView />
    </Suspense>
  );
}

function TechniciansView() {
  useEnsureLocation();
  const { t, tp } = useI18n();
  const params = useSearchParams();
  const fromQuery = params.get('specialty');
  const [specialty, setSpecialty] = useState<Specialty | null>(
    SPECIALTIES.includes(fromQuery as Specialty) ? (fromQuery as Specialty) : null,
  );
  const [availableOnly, setAvailableOnly] = useState(false);
  const [radiusIndex, setRadiusIndex] = useState(1);
  // undefined = the user hasn't chosen; then the road they're on is used.
  const [corridorChoice, setCorridor] = useState<CorridorId | null | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<string | null>(null);

  const online = useOnline();
  const pack = useOfflinePack();
  const favorites = useFavorites();
  const { position, status, locate } = useLocation();
  const { openLocation } = useShellActions();
  const loc = useLocationLabel();

  // On an intercity road, show that road's technicians by default.
  const roadHere = loc.context && !loc.context.inDouala ? loc.context.corridor : null;
  const corridor = corridorChoice === undefined ? roadHere : corridorChoice;

  const radiusKm = SEARCH_RADII_KM[radiusIndex]!;
  const nearby = useNearby(
    online && position ? { center: position, radiusKm, specialty, availableOnly, corridor, limit: 120 } : null,
  );

  const results = useMemo(() => {
    const now = new Date();
    let list = online
      ? nearby.data
      : position && pack
        ? rankOffline(pack.technicians, position, { specialty, favorites: favorites.ids })
        : undefined;
    if (!list) return undefined;
    if (!online && corridor) list = list.filter((x) => x.corridors.includes(corridor));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((x) => `${x.businessName} ${x.area} ${x.city} ${x.ownerName}`.toLowerCase().includes(q));
    if (!online) return list;
    return [...list].sort(
      (a, b) =>
        availabilityRank(effectiveAvailability(a, now)) - availabilityRank(effectiveAvailability(b, now)) || a.distanceKm - b.distanceKm,
    );
  }, [online, nearby.data, position, pack, specialty, favorites.ids, corridor, query]);

  const markers = useMemo<MapMarker[]>(() => {
    const now = new Date();
    const list: MapMarker[] = (results ?? []).map((x) => ({
      id: x.id,
      point: x.location,
      kind: 'technician',
      label: x.businessName,
      available: effectiveAvailability(x, now) === 'available',
    }));
    if (position) list.push({ id: 'me', point: position, kind: 'driver', label: t('technicians.you') });
    return list;
  }, [results, position, t]);

  const selectedTech = results?.find((x) => x.id === selected) ?? null;
  const filtered = !!(specialty || availableOnly || query || corridor);

  const listBlock = (
    <div>
      {results === undefined ? (
        <div className="space-y-6 py-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3.5">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="mt-3 h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" aria-hidden="true" />}
          title={filtered ? t('technicians.emptyFiltered') : t('technicians.empty', { km: radiusKm })}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {online && radiusIndex < SEARCH_RADII_KM.length - 1 && !corridor && (
                <Button onClick={() => setRadiusIndex((i) => i + 1)}>{t('technicians.widen', { km: SEARCH_RADII_KM[radiusIndex + 1]! })}</Button>
              )}
              {filtered && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSpecialty(null);
                    setAvailableOnly(false);
                    setQuery('');
                    setCorridor(null);
                  }}
                >
                  {t('technicians.clearFilters')}
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <div className="divide-y divide-line">
          {results.map((x) => (
            <TechnicianRow key={x.id} technician={x} offline={!online} highlight={x.id === selected} onFocus={() => setSelected(x.id)} />
          ))}
        </div>
      )}
    </div>
  );

  const mapBlock = online ? (
    position ? (
      <OnyxMap
        center={position}
        zoom={corridor ? 9 : 13}
        markers={markers}
        selectedId={selected}
        onSelect={setSelected}
        fit={!!corridor}
        label={t('technicians.map')}
      />
    ) : null
  ) : (
    <div className="grid h-full place-items-center p-6 text-center text-[15px] text-ink-3">{t('technicians.mapUnavailable')}</div>
  );

  return (
    <PageContainer wide>
      <PageHeader
        title={t('technicians.title')}
        subtitle={
          results !== undefined ? (
            <span className="tabular">
              {tp('technicians.results', results.length)}
              {!online && pack ? `, ${t('offline.unverifiedNote')}` : ''}
            </span>
          ) : null
        }
        action={
          <Segmented
            className="lg:hidden"
            size="sm"
            label={t('technicians.title')}
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: t('technicians.list'), icon: <List className="size-4" aria-hidden="true" /> },
              { value: 'map', label: t('technicians.map'), icon: <MapIcon className="size-4" aria-hidden="true" /> },
            ]}
          />
        }
      />

      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">{t('technicians.searchLabel')}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('technicians.searchPlaceholder')}
            className="h-12 w-full rounded-md border border-line bg-surface-2 pr-3.5 pl-10 text-[16px] text-ink placeholder:text-ink-3 focus:border-gold/70 focus:outline-none focus:ring-3 focus:ring-gold/15"
          />
        </label>

        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip pressed={specialty === null} onClick={() => setSpecialty(null)}>
            {t('technicians.allSpecialties')}
          </Chip>
          {SPECIALTIES.map((s) => (
            <Chip key={s} pressed={specialty === s} onClick={() => setSpecialty(specialty === s ? null : s)}>
              {t(`specialtyShort.${s}`)}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip pressed={availableOnly} onClick={() => setAvailableOnly((v) => !v)} icon={<span className="size-2 rounded-full bg-ok" aria-hidden="true" />}>
            {t('technicians.availableNow')}
          </Chip>
          <div className="w-48">
            <Select
              aria-label={t('technicians.roads')}
              value={corridor ?? ''}
              onChange={(e) => {
                setCorridor((e.target.value || null) as CorridorId | null);
              }}
              className="h-9 rounded-full text-sm"
            >
              <option value="">{t('technicians.allRoads')}</option>
              {CORRIDOR_IDS.map((c) => (
                <option key={c} value={c}>
                  {t(`corridors.${c}`)}
                </option>
              ))}
            </Select>
          </div>
          {!corridor && online && (
            <div className="w-28">
              <Select
                aria-label={t('technicians.radius')}
                value={radiusIndex}
                onChange={(e) => setRadiusIndex(Number(e.target.value))}
                className="tabular h-9 rounded-full text-sm"
              >
                {SEARCH_RADII_KM.map((km, i) => (
                  <option key={km} value={i}>
                    {t('technicians.radiusValue', { km })}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>

      {!online && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/8 p-3.5 text-[14px] leading-snug text-ink-2">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
          <p>
            {t('offline.banner')}{' '}
            <Link href="/offline" className="font-medium text-gold-bright underline-offset-4 hover:underline">
              {t('offline.title')}
            </Link>
          </p>
        </div>
      )}

      {!position ? (
        <section className="mt-6 rounded-xl border border-line bg-surface-1 p-5">
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
      ) : (
        <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
          <div className={view === 'map' ? 'hidden lg:block' : ''}>{listBlock}</div>
          <div className={view === 'list' ? 'hidden lg:block' : ''}>
            <div className="sticky top-[72px] h-[calc(100dvh-260px)] min-h-[360px] overflow-hidden rounded-xl border border-line lg:h-[calc(100dvh-120px)]">
              {mapBlock}
            </div>
            {view === 'map' && selectedTech && (
              <div className="mt-3 rounded-xl border border-line bg-surface-1 px-4 lg:hidden">
                <TechnicianRow technician={selectedTech} offline={!online} />
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
