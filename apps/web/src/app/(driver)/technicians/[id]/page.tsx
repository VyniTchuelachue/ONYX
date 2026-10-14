'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { BadgeCheck, Bookmark, BookmarkCheck, Clock, Navigation, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { haversineKm, type Technician } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useLocation } from '@/lib/location';
import { useOnline } from '@/lib/online';
import { useTechnician, useTechnicianReviews } from '@/lib/queries';
import { useFavorites, useOfflinePack } from '@/lib/offline-pack';
import { Facts, PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { AvailabilityPill } from '@/components/technicians/availability';
import { ContactActions } from '@/components/technicians/contact-actions';
import { EmptyState, Monogram, Pill, Rating, SectionTitle, StarRow } from '@/components/ui/bits';
import { ButtonLink } from '@/components/ui/button';
import type { MapMarker } from '@/components/map/onyx-map';

const OnyxMap = dynamic(() => import('@/components/map/onyx-map'), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

export default function TechnicianPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const online = useOnline();
  const pack = useOfflinePack();
  const query = useTechnician(online ? id : null);
  const technician: Technician | null | undefined = online ? query.data : (pack?.technicians.find((x) => x.id === id) ?? null);

  if (technician === undefined || (online && query.isLoading)) return <PageSkeleton />;
  if (!technician) {
    return (
      <PageContainer>
        <PageHeader title="" back="/technicians" />
        <EmptyState title={t('technicians.notFound')} action={<ButtonLink href="/technicians">{t('technicians.title')}</ButtonLink>} />
      </PageContainer>
    );
  }
  return <Profile technician={technician} offline={!online} />;
}

function Profile({ technician: x, offline }: { technician: Technician; offline: boolean }) {
  const { t, tp } = useI18n();
  const fmt = useFormat();
  const { position } = useLocation();
  const favorites = useFavorites();
  const reviews = useTechnicianReviews(offline ? null : x.id);
  const distance = position ? haversineKm(position, x.location) : null;
  const saved = favorites.has(x.id);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [{ id: x.id, point: x.location, kind: 'technician', available: true, label: x.businessName }];
    if (position) list.push({ id: 'me', point: position, kind: 'driver', label: t('technicians.you') });
    return list;
  }, [x, position, t]);

  return (
    <PageContainer>
      <PageHeader title="" back="/technicians" className="pb-0" />

      <section className="flex items-start gap-4">
        <Monogram name={x.businessName} verified={x.verificationStatus === 'verified'} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] leading-[1.1] text-ink sm:text-[32px]">{x.businessName}</h1>
          <p className="mt-1.5 text-[15px] text-ink-2">
            {x.ownerName}
            {x.area ? `, ${x.area}` : ''}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {x.verificationStatus === 'verified' && (
              <Pill tone="gold">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                {t('technicians.verifiedLong')}
              </Pill>
            )}
            <AvailabilityPill technician={x} offline={offline} />
          </div>
        </div>
      </section>

      {/* Key numbers, read at a glance: how far, how good, how experienced. */}
      <dl className="mt-6 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface-1">
        <div className="px-3 py-3.5 text-center">
          <dt className="text-xs text-ink-3">{t('technicians.distance')}</dt>
          <dd className="font-display tabular mt-1 text-[20px] text-ink">{distance !== null ? fmt.distance(distance) : '—'}</dd>
          {distance !== null && x.mobileService && <dd className="tabular text-xs text-ink-3">{t('technicians.eta', { duration: fmt.eta(distance) })}</dd>}
        </div>
        <div className="px-3 py-3.5 text-center">
          <dt className="text-xs text-ink-3">{t('technicians.rating')}</dt>
          <dd className="mt-1 flex justify-center">
            {x.ratingCount > 0 ? <Rating value={x.ratingAvg} className="font-display text-[20px]" /> : <span className="text-[15px] text-ink-2">{t('technicians.newcomer')}</span>}
          </dd>
          {x.ratingCount > 0 && <dd className="text-xs text-ink-3">{tp('technicians.reviews', x.ratingCount)}</dd>}
        </div>
        <div className="px-3 py-3.5 text-center">
          <dt className="text-xs text-ink-3">{t('technicians.jobsLabel')}</dt>
          <dd className="font-display tabular mt-1 text-[20px] text-ink">{fmt.number(x.jobsCompleted)}</dd>
          {x.yearsExperience !== null && <dd className="text-xs text-ink-3">{tp('technicians.years', x.yearsExperience)}</dd>}
        </div>
      </dl>

      <ContactActions technician={x} size="lg" className="mt-5 [&>*]:flex-1" showRequest={!offline} showSms={offline} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-3">
        <button
          type="button"
          onClick={() => {
            const added = favorites.toggle(x.id);
            toast.success(added ? t('technicians.favoriteAdded') : t('technicians.favoriteRemoved'));
          }}
          aria-pressed={saved}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-1 text-sm text-ink-2 hover:text-ink"
        >
          {saved ? <BookmarkCheck className="size-4 text-gold" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}
          {saved ? t('technicians.unfavorite') : t('technicians.favorite')}
        </button>
        {x.lastSeenAt && !offline && <span>{t('technicians.lastSeen', { time: fmt.ago(x.lastSeenAt) })}</span>}
        {x.avgResponseMinutes !== null && !offline && <span>{t('technicians.respondsIn', { duration: fmt.duration(x.avgResponseMinutes) })}</span>}
      </div>

      {x.bio && (
        <section className="mt-8">
          <SectionTitle>{t('technicians.about')}</SectionTitle>
          <p className="max-w-[62ch] text-[16px] leading-relaxed text-ink-2">{x.bio}</p>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>{t('technicians.services')}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {x.specialties.map((s) => (
            <Pill key={s}>{t(`specialties.${s}`)}</Pill>
          ))}
        </div>
        <Facts
          className="mt-4"
          items={[
            {
              label: t('technicians.vehicles'),
              value: x.vehicleTypes.map((v) => t(`vehicleTypes.${v}`)).join(', '),
            },
            {
              label: t('technicians.coverage'),
              value: (
                <span className="inline-flex items-center gap-1.5">
                  <Navigation className="size-4 text-ink-3" aria-hidden="true" />
                  {x.mobileService ? t('technicians.serviceArea', { km: x.serviceRadiusKm }) : t('technicians.garageOnly')}
                </span>
              ),
            },
            ...(x.hasTowTruck
              ? [{ label: t('technicians.towTruck'), value: <Truck className="size-4 text-gold" aria-label={t('common.yes')} /> }]
              : []),
            ...(x.corridors.length
              ? [{ label: t('technicians.roads'), value: x.corridors.map((c) => t(`corridors.${c}`)).join(', ') }]
              : []),
            ...(x.openingHours
              ? [
                  {
                    label: t('technicians.hours'),
                    value: (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-4 text-ink-3" aria-hidden="true" />
                        {x.openingHours}
                      </span>
                    ),
                  },
                ]
              : []),
            ...(x.address ? [{ label: t('request.landmark'), value: x.address }] : []),
          ]}
        />
      </section>

      {!offline && (
        <section className="mt-8 h-56 overflow-hidden rounded-xl border border-line">
          <OnyxMap center={x.location} zoom={14} markers={markers} fit={markers.length > 1 && (distanceOk(position, x))} label={x.businessName} />
        </section>
      )}

      {!offline && (
        <section className="mt-8">
          <SectionTitle>{t('technicians.reviewsTitle')}</SectionTitle>
          {reviews.data && reviews.data.length === 0 && <p className="text-[15px] text-ink-3">{t('technicians.noReviewsYet')}</p>}
          <ul className="divide-y divide-line">
            {reviews.data?.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-medium text-ink">{r.reviewerName || '—'}</span>
                  <span className="text-xs text-ink-3">{fmt.date(r.createdAt)}</span>
                </div>
                <div className="mt-1">
                  <StarRow value={r.rating} />
                  <span className="sr-only">{tp('request.stars', r.rating)}</span>
                </div>
                {r.comment && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{r.comment}</p>}
                {r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.tags.map((tag) => (
                      <Pill key={tag} className="h-5 text-[11px]">
                        {t(`request.tags.${tag}`)}
                      </Pill>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}

/** Only frame both pins when the driver is reasonably close; otherwise centre on the garage. */
function distanceOk(position: { lat: number; lng: number } | null, x: Technician) {
  return !!position && haversineKm(position, x.location) < 60;
}
