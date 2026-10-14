'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { MessageCircle, Navigation, Phone, Radio } from 'lucide-react';
import { toast } from 'sonner';
import {
  canEditDiagnosis,
  canShareLocation,
  canTechnicianRelease,
  nextTechnicianStep,
  telHref,
  whatsappHref,
  type RequestDetail,
} from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAction, useJob } from '@/lib/queries';
import { useShareLocation } from '@/lib/share-location';
import { isDemo } from '@/lib/config';
import { Facts, PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { RequireListing } from '@/components/pro/require-listing';
import { QuoteBuilder } from '@/components/pro/quote-builder';
import { CompleteSheet } from '@/components/pro/complete-sheet';
import { QuoteCard } from '@/components/requests/quote-card';
import { Timeline } from '@/components/requests/timeline';
import { StatusPill } from '@/components/requests/request-row';
import { CancelSheet } from '@/components/requests/cancel-sheet';
import { Button, buttonClass } from '@/components/ui/button';
import { Switch } from '@/components/ui/choice';
import { Textarea } from '@/components/ui/field';
import { EmptyState, SectionTitle, StarRow } from '@/components/ui/bits';
import type { MapMarker } from '@/components/map/onyx-map';

const OnyxMap = dynamic(() => import('@/components/map/onyx-map'), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

export default function ProJobPage() {
  return <RequireListing>{() => <Job />}</RequireListing>;
}

function Job() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const job = useJob(id);
  if (job.isLoading || job.data === undefined) return <PageSkeleton />;
  if (!job.data) {
    return (
      <PageContainer>
        <PageHeader title="" back="/pro/jobs" />
        <EmptyState title={t('request.notFound')} />
      </PageContainer>
    );
  }
  return <JobView detail={job.data} />;
}

function guard(e: React.MouseEvent, message: string) {
  if (isDemo) {
    e.preventDefault();
    toast(message);
  }
}

function JobView({ detail }: { detail: RequestDetail }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const router = useRouter();
  const { request: r, quotes, events, review, payment } = detail;
  const step = nextTechnicianStep(r.status);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  // null = follow the default: share automatically once the technician sets off.
  const [sharingChoice, setSharing] = useState<boolean | null>(null);
  const sharing = canShareLocation(r.status) && (sharingChoice ?? r.status === 'en_route');
  // null = not editing: show what is saved.
  const [diagnosisDraft, setDiagnosisDraft] = useState<string | null>(null);
  const diagnosis = diagnosisDraft ?? r.diagnosis ?? '';
  const share = useShareLocation(r.id, sharing);

  const advance = useAction((b, status: 'en_route' | 'arrived' | 'in_progress') => b.pro.advance(r.id, status));
  const saveDiagnosis = useAction((b, text: string) => b.pro.saveDiagnosis(r.id, text), { success: t('pro.diagnosisSaved') });
  const release = useAction((b, _: void) => b.pro.release(r.id), { success: t('pro.released') });
  const cancel = useAction((b, reason: string) => b.pro.cancel(r.id, reason), { success: t('request.cancelled') });

  const accepted = quotes.find((q) => q.status === 'accepted');
  const latestQuote = quotes[0];
  const markers = useMemo<MapMarker[]>(() => [{ id: 'driver', point: r.location, kind: 'driver' }], [r.location]);
  const active = r.status !== 'completed' && r.status !== 'cancelled';
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${r.location.lat.toFixed(6)},${r.location.lng.toFixed(6)}`;
  const blocked = t('technicians.demoCallBlocked');

  return (
    <PageContainer className="pb-36">
      <PageHeader
        back="/pro"
        title={t(`categories.${r.category}`)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={r.status} />
            <span className="tabular text-[13px] text-ink-3">{t('request.code', { code: r.code })}</span>
            <span className="text-[13px] text-ink-3">{fmt.ago(r.createdAt)}</span>
          </span>
        }
      />

      <section className="rounded-xl border border-line bg-surface-1 p-4">
        <p className="text-[13px] text-ink-3">{t('pro.driver')}</p>
        <p className="mt-0.5 text-[17px] font-semibold text-ink">{r.contactName}</p>
        <p className="tabular text-[14px] text-ink-2">{fmt.phone(r.contactPhone)}</p>
        {active && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <a href={telHref(r.contactPhone)} onClick={(e) => guard(e, blocked)} className={buttonClass('primary', 'md')}>
              <Phone className="size-4" aria-hidden="true" />
              {t('pro.call')}
            </a>
            <a href={whatsappHref(r.contactPhone)} onClick={(e) => guard(e, blocked)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md')}>
              <MessageCircle className="size-4 text-ok" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t('technicians.whatsapp')}</span>
            </a>
            <a href={directions} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md')}>
              <Navigation className="size-4 text-blue-soft" aria-hidden="true" />
              {t('pro.directions')}
            </a>
          </div>
        )}
      </section>

      {active && (
        <section className="mt-4 overflow-hidden rounded-xl border border-line">
          <div className="h-48">
            <OnyxMap center={r.location} zoom={15} markers={markers} label={t('request.place')} />
          </div>
          <div className="border-t border-line bg-surface-1 px-4 py-3">
            <p className="text-[15px] text-ink">{r.landmark}</p>
            {r.placeLabel && <p className="text-[13px] text-ink-3">{r.placeLabel}</p>}
          </div>
        </section>
      )}

      {canShareLocation(r.status) && (
        <section className="mt-4 rounded-xl border border-line px-4 py-2">
          <Switch
            checked={sharing}
            onChange={setSharing}
            label={
              <span className="flex items-center gap-2">
                <Radio className="size-4 text-gold" aria-hidden="true" />
                {sharing ? t('pro.sharingLocation') : t('pro.shareLocation')}
              </span>
            }
            description={share.error === 'denied' ? t('location.deniedHelp') : t('pro.shareHelp')}
          />
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
          ]}
        />
        {r.aiSummary && (
          <div className="mt-3 rounded-lg border border-violet/30 bg-violet/6 p-4">
            <p className="text-[13px] font-medium text-violet-soft">{t('request.aiSummary')}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{r.aiSummary}</p>
          </div>
        )}
      </section>

      {canEditDiagnosis(r.status) && (
        <section className="mt-8">
          <SectionTitle>{t('pro.diagnosisTitle')}</SectionTitle>
          <Textarea
            aria-label={t('pro.diagnosisTitle')}
            value={diagnosis}
            onChange={(e) => setDiagnosisDraft(e.target.value)}
            placeholder={t('pro.diagnosisPlaceholder')}
            maxLength={2000}
            rows={3}
          />
          <Button
            className="mt-2"
            variant="secondary"
            loading={saveDiagnosis.isPending}
            disabled={diagnosis.trim() === (r.diagnosis ?? '').trim()}
            onClick={() => saveDiagnosis.mutate(diagnosis, { onSuccess: () => setDiagnosisDraft(null) })}
          >
            {t('pro.saveDiagnosis')}
          </Button>
        </section>
      )}
      {!canEditDiagnosis(r.status) && r.diagnosis && (
        <section className="mt-8">
          <SectionTitle>{t('pro.diagnosisTitle')}</SectionTitle>
          <p className="rounded-lg border border-line bg-surface-1 p-4 text-[15px] leading-relaxed text-ink-2">{r.diagnosis}</p>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="mt-8 space-y-3">
          <SectionTitle>{t('pro.quoteTitle')}</SectionTitle>
          {quotes.map((q) => (
            <QuoteCard key={q.id} quote={q} />
          ))}
        </section>
      )}

      {payment && (
        <section className="mt-8 flex items-center justify-between gap-4 rounded-xl border border-ok/30 bg-ok/8 p-4">
          <div>
            <p className="text-[13px] text-ink-3">{t('request.payment')}</p>
            <p className="text-[15px] text-ink">{t('request.paidWith', { method: t(`request.methods.${payment.method}`) })}</p>
            <p className="text-[13px] text-ink-3">{t('pro.commissionNote', { amount: fmt.money(payment.commission) })}</p>
          </div>
          <p className="font-display tabular text-[22px] text-ink">{fmt.money(payment.amount)}</p>
        </section>
      )}

      {review && (
        <section className="mt-4 rounded-xl border border-line bg-surface-1 p-4">
          <StarRow value={review.rating} size="md" />
          {review.comment && <p className="mt-2 text-[15px] text-ink-2">{review.comment}</p>}
          <p className="mt-1 text-[13px] text-ink-3">{review.reviewerName}</p>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>{t('request.timeline')}</SectionTitle>
        <Timeline events={events} />
      </section>

      {(canTechnicianRelease(r.status) || r.status === 'arrived' || r.status === 'quoted') && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
          {canTechnicianRelease(r.status) && (
            <Button variant="secondary" onClick={() => setReleaseOpen(true)}>
              {t('pro.release')}
            </Button>
          )}
          <Button variant="danger" onClick={() => setCancelOpen(true)}>
            {t('pro.cancelJob')}
          </Button>
        </div>
      )}

      {/* The next step, always within thumb reach. */}
      {step && step !== 'accept' && (
        <div className="fixed inset-x-0 bottom-[calc(64px+var(--safe-bottom))] z-20 border-t border-line bg-onyx/95 backdrop-blur lg:bottom-0 lg:left-[248px]">
          <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3 sm:px-6">
            {step === 'en_route' && (
              <Button size="lg" className="flex-1" loading={advance.isPending} onClick={() => advance.mutate('en_route')}>
                {t('pro.steps.en_route')}
              </Button>
            )}
            {step === 'arrived' && (
              <Button size="lg" className="flex-1" loading={advance.isPending} onClick={() => advance.mutate('arrived')}>
                {t('pro.steps.arrived')}
              </Button>
            )}
            {step === 'quote' && (
              <>
                <Button size="lg" className="flex-1" onClick={() => setQuoteOpen(true)}>
                  {t('pro.steps.quote')}
                </Button>
                <Button size="lg" variant="secondary" loading={advance.isPending} onClick={() => advance.mutate('in_progress')}>
                  {t('pro.steps.start')}
                </Button>
              </>
            )}
            {step === 'await_driver' && (
              <>
                <p className="flex flex-1 items-center text-[14px] text-ink-2">{t('pro.steps.await_driver')}</p>
                <Button size="lg" variant="secondary" onClick={() => setQuoteOpen(true)}>
                  {t('pro.newQuote')}
                </Button>
              </>
            )}
            {step === 'complete' && (
              <Button size="lg" className="flex-1" onClick={() => setCompleteOpen(true)}>
                {t('pro.steps.complete')}
              </Button>
            )}
          </div>
        </div>
      )}

      {quoteOpen && <QuoteBuilder requestId={r.id} open={quoteOpen} onClose={() => setQuoteOpen(false)} initial={latestQuote?.items} />}
      {completeOpen && <CompleteSheet requestId={r.id} open={completeOpen} onClose={() => setCompleteOpen(false)} suggestedAmount={accepted?.total ?? null} />}
      <CancelSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason, { onSuccess: () => setCancelOpen(false) })}
      />
      <CancelSheet
        open={releaseOpen}
        title={t('pro.releaseTitle')}
        description={t('pro.releaseBody')}
        withReasons={false}
        onClose={() => setReleaseOpen(false)}
        loading={release.isPending}
        onConfirm={() =>
          release.mutate(undefined, {
            onSuccess: () => {
              setReleaseOpen(false);
              router.push('/pro');
            },
          })
        }
      />
    </PageContainer>
  );
}
