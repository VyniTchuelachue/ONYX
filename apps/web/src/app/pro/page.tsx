'use client';

import { useEffect, useRef } from 'react';
import { Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { AVAILABILITY_STATUSES, nextTechnicianStep, type Availability, type TechnicianPrivate } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAction, useInbox, useJobs, useProStats } from '@/lib/queries';
import { PageContainer, PageHeader } from '@/components/page';
import { RequireListing } from '@/components/pro/require-listing';
import { InboxCard } from '@/components/pro/inbox-card';
import { AlertsCard } from '@/components/alerts/alerts-card';
import { RequestRow } from '@/components/requests/request-row';
import { EmptyState, SectionTitle, Skeleton } from '@/components/ui/bits';
import { cn } from '@/lib/utils';

export default function ProDashboardPage() {
  return <RequireListing>{(listing) => <Dashboard listing={listing} />}</RequireListing>;
}

const AVAILABILITY_STYLE: Record<Availability, string> = {
  available: 'border-ok/60 bg-ok/12 text-ok',
  busy: 'border-gold/60 bg-gold/12 text-gold-bright',
  offline: 'border-line-strong bg-surface-3 text-ink',
};
const DOT: Record<Availability, string> = { available: 'bg-ok', busy: 'bg-gold', offline: 'bg-ink-3' };

function Dashboard({ listing }: { listing: TechnicianPrivate }) {
  const { t } = useI18n();
  const verified = listing.verificationStatus === 'verified';

  return (
    <PageContainer className="pb-10">
      <PageHeader title={t('pro.hello', { name: listing.ownerName.split(' ')[0] ?? '' })} subtitle={listing.businessName} />
      {!verified && <VerificationBanner listing={listing} />}
      <AvailabilityControl listing={listing} />
      {verified && <AlertsCard audience="technician" className="mb-8" />}
      {verified && <InboxSection listing={listing} />}
      <ActiveJobs />
      <Stats />
    </PageContainer>
  );
}

function VerificationBanner({ listing }: { listing: TechnicianPrivate }) {
  const { t } = useI18n();
  const s = listing.verificationStatus;
  const danger = s === 'rejected' || s === 'suspended';
  return (
    <section className={cn('mb-6 rounded-xl border p-4', danger ? 'border-danger/40 bg-danger/8' : 'border-gold/40 bg-gold/8')}>
      <p className={cn('font-wide text-[15px] font-semibold', danger ? 'text-danger-soft' : 'text-gold-bright')}>{t(`pro.verification.${s}`)}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{t(`pro.verificationBody.${s}`, { note: listing.verificationNote ?? '—' })}</p>
    </section>
  );
}

function AvailabilityControl({ listing }: { listing: TechnicianPrivate }) {
  const { t } = useI18n();
  const set = useAction((b, a: Availability) => b.pro.setAvailability(a), {
    success: (_) => null,
  });
  const current = set.isPending && set.variables ? set.variables : listing.availability;
  return (
    <section aria-labelledby="availability-title" className="mb-8">
      <SectionTitle id="availability-title">{t('pro.availabilityTitle')}</SectionTitle>
      <div role="radiogroup" aria-labelledby="availability-title" className="grid grid-cols-3 gap-2">
        {AVAILABILITY_STATUSES.map((a) => {
          const active = current === a;
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={listing.verificationStatus === 'suspended'}
              onClick={() =>
                a !== listing.availability &&
                set.mutate(a, { onSuccess: () => toast.success(t('pro.availabilityChanged', { status: t(`availability.${a}`) })) })
              }
              className={cn(
                'flex h-14 items-center justify-center gap-2 rounded-lg border text-[15px] font-semibold transition-colors disabled:opacity-50',
                active ? AVAILABILITY_STYLE[a] : 'border-line bg-surface-1 text-ink-3 hover:text-ink-2',
              )}
            >
              <span className={cn('size-2.5 rounded-full', active ? DOT[a] : 'bg-ink-3/50')} aria-hidden="true" />
              {t(`availability.${a}`)}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-[14px] text-ink-3">{t(`pro.availabilityHelp.${current}`)}</p>
    </section>
  );
}

function InboxSection({ listing }: { listing: TechnicianPrivate }) {
  const { t } = useI18n();
  const inbox = useInbox(true);
  const seen = useRef<Set<string> | null>(null);

  // Ring the bell for requests that arrive while the dashboard is open.
  useEffect(() => {
    if (!inbox.data) return;
    const ids = new Set(inbox.data.map((i) => i.id));
    if (seen.current) {
      const fresh = inbox.data.filter((i) => !seen.current!.has(i.id));
      if (fresh.length) {
        const label = t('pro.newRequest', { category: t(`categories.${fresh[0]!.category}`) });
        toast(label);
        navigator.vibrate?.([200, 100, 200]);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          new Notification('ONYX Pro', { body: label, icon: '/icons/icon-192.png' });
        }
      }
    }
    seen.current = ids;
  }, [inbox.data, t]);

  return (
    <section className="mb-8" aria-labelledby="inbox-title">
      <SectionTitle id="inbox-title">
        {t('pro.inbox')}
        {inbox.data && inbox.data.length > 0 && <span className="tabular ml-2 text-ink-3">{inbox.data.length}</span>}
      </SectionTitle>
      {inbox.data === undefined ? (
        <Skeleton className="h-44 w-full rounded-xl" />
      ) : inbox.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong">
          <EmptyState
            className="py-8"
            icon={<Inbox className="size-6" aria-hidden="true" />}
            title={listing.availability === 'available' ? t('pro.inboxEmpty') : t('pro.inboxHiddenWhileOffline')}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {inbox.data.map((item) => (
            <InboxCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function ActiveJobs() {
  const { t } = useI18n();
  const jobs = useJobs('active');
  return (
    <section className="mb-8" aria-labelledby="jobs-title">
      <SectionTitle id="jobs-title">{t('pro.activeJobs')}</SectionTitle>
      {jobs.data === undefined ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : jobs.data.length === 0 ? (
        <p className="text-[15px] text-ink-3">{t('pro.noActiveJobs')}</p>
      ) : (
        <div className="divide-y divide-line rounded-xl border border-line px-4">
          {jobs.data.map((j) => {
            const step = nextTechnicianStep(j.status);
            return (
              <div key={j.id}>
                <RequestRow request={j} href={`/pro/jobs/${j.id}`} who="driver" />
                {step && step !== 'accept' && <p className="-mt-2 pb-3 pl-[58px] text-[13px] font-medium text-gold-bright">{t(`pro.steps.${step}`)}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Stats() {
  const { t } = useI18n();
  const fmt = useFormat();
  const stats = useProStats();
  const s = stats.data;
  const tiles = [
    { label: t('pro.stats.jobs'), value: s ? fmt.number(s.jobsThisMonth) : null },
    { label: t('pro.stats.revenue'), value: s ? fmt.money(s.revenueThisMonth) : null },
    { label: t('pro.stats.commission'), value: s ? fmt.money(s.commissionDue) : null },
    { label: t('pro.stats.rating'), value: s ? (s.ratingCount ? s.ratingAvg.toFixed(1) : '—') : null },
  ];
  return (
    <section aria-labelledby="stats-title">
      <SectionTitle id="stats-title">{t('pro.statsTitle')}</SectionTitle>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-line bg-surface-1 p-4">
            <dt className="text-[13px] text-ink-3">{tile.label}</dt>
            <dd className="font-display tabular mt-1.5 text-[19px] text-ink">{tile.value ?? <Skeleton className="h-6 w-16" />}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
