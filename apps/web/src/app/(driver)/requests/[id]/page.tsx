'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, MessageCircle, Phone } from 'lucide-react';
import {
  canDriverCancel,
  estimateEtaMinutes,
  haversineKm,
  whatsappHref,
  telHref,
  type RequestDetail,
} from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAction, useRequestDetail } from '@/lib/queries';
import { isDemo } from '@/lib/config';
import { Facts, PageContainer, PageHeader, PageSkeleton, RequireSession } from '@/components/page';
import { StatusRoad } from '@/components/requests/status-road';
import { TrackAlertsPrompt } from '@/components/alerts/alerts-card';
import { QuoteCard } from '@/components/requests/quote-card';
import { Timeline } from '@/components/requests/timeline';
import { ReviewForm } from '@/components/requests/review-form';
import { StatusPill } from '@/components/requests/request-row';
import { Emblem } from '@/components/brand';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { EmptyState, Monogram, Rating, SectionTitle, StarRow } from '@/components/ui/bits';
import { CancelSheet } from '@/components/requests/cancel-sheet';
import { toast } from 'sonner';
import type { MapMarker } from '@/components/map/onyx-map';

const OnyxMap = dynamic(() => import('@/components/map/onyx-map'), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

export default function RequestPage() {
  const { t } = useI18n();
  return (
    <RequireSession title={t('requests.title')} body={t('requests.signInBody')}>
      <Tracking />
    </RequireSession>
  );
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Tracking() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { data, isLoading } = useRequestDetail(id);
  if (isLoading || data === undefined) return <PageSkeleton />;
  if (!data) {
    return (
      <PageContainer>
        <PageHeader title="" back="/requests" />
        <EmptyState title={t('request.notFound')} action={<ButtonLink href="/requests">{t('requests.title')}</ButtonLink>} />
      </PageContainer>
    );
  }
  return <TrackingView detail={data} />;
}

function TrackingView({ detail }: { detail: RequestDetail }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const now = useNow();
  const { request: r, technician, requestedTechnician, quotes, events, review, payment } = detail;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const name = technician?.businessName ?? requestedTechnician?.businessName ?? '';
  const headline =
    r.status === 'pending'
      ? r.requestedTechnicianId && requestedTechnician
        ? t('request.headline.waitingFor', { name: requestedTechnician.businessName })
        : t('request.headline.searching')
      : t(`request.headline.${r.status}`, { name });

  const etaMinutes = useMemo(() => {
    if (!technician || !['accepted', 'en_route'].includes(r.status)) return null;
    const from = r.technicianLocation ?? technician.location;
    return estimateEtaMinutes(haversineKm(from, r.location));
  }, [technician, r.status, r.technicianLocation, r.location]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [{ id: 'me', point: r.location, kind: 'driver' }];
    if (r.technicianLocation) list.push({ id: 'tech', point: r.technicianLocation, kind: 'live' });
    else if (technician && r.status === 'accepted') list.push({ id: technician.id, point: technician.location, kind: 'technician', available: true });
    return list;
  }, [r.location, r.technicianLocation, technician, r.status]);

  const respond = useAction((b, v: { id: string; accept: boolean }) => b.requests.respondToQuote(v.id, v.accept), {
    success: (_) => null,
  });
  const cancel = useAction((b, reason: string) => b.requests.cancel(r.id, reason), { success: t('request.cancelled') });

  const pendingQuote = quotes.find((q) => q.status === 'pending');
  const otherQuotes = quotes.filter((q) => q !== pendingQuote);
  const requestedContact = requestedTechnician?.whatsapp ?? requestedTechnician?.phone ?? null;
  const minutesWaiting = (now - new Date(r.createdAt).getTime()) / 60000;
  const showMap = r.status === 'en_route' || (r.status === 'accepted' && !!technician);

  return (
    <PageContainer className="pb-10">
      <PageHeader
        back="/requests"
        title={headline}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={r.status} />
            <span className="tabular text-[13px] text-ink-3">{t('request.code', { code: r.code })}</span>
            {etaMinutes !== null && <span className="tabular text-[14px] font-medium text-gold-bright">{t('request.eta', { duration: fmt.duration(etaMinutes) })}</span>}
          </span>
        }
      />

      {r.status === 'pending' && (
        <section className="flex gap-4 rounded-xl border border-line bg-surface-1 p-5">
          <span className="relative grid size-12 shrink-0 place-items-center" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-gold/25 animate-pulse-ring" />
            <Emblem size={44} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] leading-relaxed text-ink-2">
              {r.requestedTechnicianId && requestedTechnician
                ? t('request.waitingBody', { name: requestedTechnician.businessName })
                : t('request.searchingBody')}
            </p>
            {r.requestedTechnicianId && requestedContact && (
              <a
                href={whatsappHref(
                  requestedContact,
                  t('request.whatsappText', { code: r.code, category: t(`categories.${r.category}`), place: r.placeLabel ?? '' }),
                )}
                onClick={(e) => {
                  if (isDemo) {
                    e.preventDefault();
                    toast(t('technicians.demoCallBlocked'));
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass('secondary', 'md', 'mt-3')}
              >
                <MessageCircle className="size-4 text-ok" aria-hidden="true" />
                {t('request.notifyWhatsapp')}
              </a>
            )}
            {minutesWaiting > 3 && (
              <p className="mt-3 text-[14px] text-ink-3">
                {t('request.slowHelp')}{' '}
                <Link href="/technicians" className="font-medium text-gold-bright underline-offset-4 hover:underline">
                  {t('request.seeNearby')}
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {technician && r.status !== 'pending' && (
        <section className="rounded-xl border border-line bg-surface-1 p-4">
          <p className="mb-3 text-[13px] text-ink-3">{t('request.yourTechnician')}</p>
          <div className="flex items-center gap-3.5">
            <Monogram name={technician.businessName} verified={technician.verificationStatus === 'verified'} />
            <div className="min-w-0 flex-1">
              <Link href={`/technicians/${technician.id}`} className="flex items-center gap-1.5 text-[16px] font-semibold text-ink hover:underline">
                <span className="truncate">{technician.businessName}</span>
                <BadgeCheck className="size-4 shrink-0 text-gold" aria-hidden="true" />
              </Link>
              <p className="text-[14px] text-ink-2">{technician.ownerName}</p>
              {technician.ratingCount > 0 && <Rating value={technician.ratingAvg} count={`(${technician.ratingCount})`} className="mt-0.5" />}
            </div>
          </div>
          {r.status !== 'completed' && r.status !== 'cancelled' && technician.phone && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={telHref(technician.phone)}
                onClick={(e) => {
                  if (isDemo) {
                    e.preventDefault();
                    toast(t('technicians.demoCallBlocked'));
                  }
                }}
                className={buttonClass('primary', 'md')}
              >
                <Phone className="size-4" aria-hidden="true" />
                {t('technicians.call')}
              </a>
              <a
                href={whatsappHref(technician.whatsapp ?? technician.phone)}
                onClick={(e) => {
                  if (isDemo) {
                    e.preventDefault();
                    toast(t('technicians.demoCallBlocked'));
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass('secondary', 'md')}
              >
                <MessageCircle className="size-4 text-ok" aria-hidden="true" />
                {t('technicians.whatsapp')}
              </a>
            </div>
          )}
        </section>
      )}

      {showMap && (
        <section className="mt-4 overflow-hidden rounded-xl border border-line">
          <div className="h-56">
            <OnyxMap center={r.location} zoom={14} markers={markers} fit={markers.length > 1} label={t('request.yourTechnician')} />
          </div>
          {r.technicianLocation && (
            <p className="border-t border-line bg-surface-1 px-4 py-2.5 text-[13px] text-ink-3">
              {t('request.liveLocation', { time: fmt.ago(r.technicianLocation.at) })}
            </p>
          )}
        </section>
      )}

      {/* Waiting is when an alert helps most: the driver can leave the app. */}
      {(r.status === 'pending' || r.status === 'accepted' || r.status === 'en_route') && <TrackAlertsPrompt className="mt-4" />}

      {pendingQuote && (
        <QuoteCard
          className="mt-5"
          quote={pendingQuote}
          perspective="driver"
          actions={
            <>
              <p className="mb-3 text-[13px] leading-snug text-ink-3">{t('request.quoteHelp')}</p>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button
                  size="lg"
                  loading={respond.isPending && respond.variables?.accept === true}
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: pendingQuote.id, accept: true }, { onSuccess: () => toast.success(t('request.quoteAccepted')) })}
                >
                  {t('request.acceptQuote')}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  loading={respond.isPending && respond.variables?.accept === false}
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: pendingQuote.id, accept: false }, { onSuccess: () => toast(t('request.quoteDeclined')) })}
                >
                  {t('request.declineQuote')}
                </Button>
              </div>
            </>
          }
        />
      )}

      {r.status === 'completed' && payment && (
        <section className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-ok/30 bg-ok/8 p-4">
          <div>
            <p className="text-[13px] text-ink-3">{t('request.payment')}</p>
            <p className="text-[15px] text-ink">{t('request.paidWith', { method: t(`request.methods.${payment.method}`) })}</p>
          </div>
          <p className="font-display tabular text-[22px] text-ink">{fmt.money(payment.amount)}</p>
        </section>
      )}

      {r.status === 'completed' && !review && <div className="mt-5"><ReviewForm requestId={r.id} /></div>}
      {review && (
        <section className="mt-5 rounded-xl border border-line bg-surface-1 p-4">
          <p className="text-[13px] text-ink-3">{t('request.yourReview')}</p>
          <StarRow value={review.rating} size="md" />
          {review.comment && <p className="mt-2 text-[15px] text-ink-2">{review.comment}</p>}
        </section>
      )}

      {r.status === 'cancelled' && (
        <section className="mt-2 rounded-xl border border-line bg-surface-1 p-4 text-[15px] text-ink-2">
          {r.cancelledBy && <p>{t(`request.cancelledBy.${r.cancelledBy}`)}</p>}
          {r.cancelReason && <p className="mt-1 text-ink-3">{r.cancelReason}</p>}
        </section>
      )}

      {r.status !== 'cancelled' && (
        <section className="mt-8">
          <StatusRoad request={r} />
        </section>
      )}

      {r.diagnosis && (
        <section className="mt-8">
          <SectionTitle>{t('request.diagnosis')}</SectionTitle>
          <p className="rounded-lg border border-line bg-surface-1 p-4 text-[15px] leading-relaxed text-ink-2">{r.diagnosis}</p>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>{t('request.details')}</SectionTitle>
        <Facts
          items={[
            { label: t('request.problem'), value: t(`categories.${r.category}`) },
            ...(r.description ? [{ label: t('requestNew.describe'), value: r.description }] : []),
            {
              label: t('request.vehicle'),
              value: [t(`vehicleTypes.${r.vehicle.type}`), r.vehicle.make, r.vehicle.model, r.vehicle.color, r.vehicle.plate].filter(Boolean).join(', '),
            },
            ...(r.placeLabel ? [{ label: t('request.place'), value: r.placeLabel }] : []),
            { label: t('request.landmark'), value: r.landmark },
          ]}
        />
        {r.aiSummary && (
          <div className="mt-3 rounded-lg border border-violet/30 bg-violet/6 p-4">
            <p className="text-[13px] font-medium text-violet-soft">{t('request.aiSummary')}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{r.aiSummary}</p>
          </div>
        )}
      </section>

      {otherQuotes.length > 0 && (
        <section className="mt-8 space-y-3">
          <SectionTitle>{t('request.quote')}</SectionTitle>
          {otherQuotes.map((q) => (
            <QuoteCard key={q.id} quote={q} perspective="driver" />
          ))}
        </section>
      )}

      <section className="mt-8">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="text-[15px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          {t('request.timeline')} ({events.length})
        </button>
        {showHistory && (
          <div className="mt-4">
            <Timeline events={events} />
          </div>
        )}
      </section>

      {canDriverCancel(r.status) && (
        <div className="mt-10 border-t border-line pt-6">
          <Button variant="danger" onClick={() => setCancelOpen(true)}>
            {t('request.cancel')}
          </Button>
        </div>
      )}

      <CancelSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason, { onSuccess: () => setCancelOpen(false) })}
      />
    </PageContainer>
  );
}
