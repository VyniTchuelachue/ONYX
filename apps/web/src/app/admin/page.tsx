'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAdminMetrics, useAdminRequests, useAdminTechnicians } from '@/lib/queries';
import { PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { CHART, HorizontalBars, StackedColumns, StatTile } from '@/components/admin/charts';
import { RequestRow } from '@/components/requests/request-row';
import { Monogram, SectionTitle } from '@/components/ui/bits';

export default function AdminOverviewPage() {
  const { t, locale } = useI18n();
  const fmt = useFormat();
  const metrics = useAdminMetrics();
  const pending = useAdminTechnicians('pending');
  const recent = useAdminRequests(null);
  const m = metrics.data;
  if (!m) return <PageSkeleton />;

  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const dayTitle = (date: string) =>
    new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      new Date(`${date}T00:00:00Z`),
    );

  return (
    <PageContainer wide>
      <PageHeader title={t('nav.adminOverview')} subtitle={<span className="text-ink-3">{fmt.dateTime(m.generatedAt)}</span>} />

      <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label={t('admin.kpis.requestsToday')} value={fmt.number(m.requests.today)} context={t('admin.last7', { count: m.requests.last7d })} />
        <StatTile label={t('admin.kpis.active')} value={fmt.number(m.requests.active)} />
        <StatTile
          label={t('admin.kpis.completionRate')}
          value={m.requests.completionRate !== null ? fmt.percent(m.requests.completionRate) : '—'}
          context={t('admin.period30')}
        />
        <StatTile
          label={t('admin.kpis.responseTime')}
          value={m.avgResponseMinutes !== null ? fmt.duration(m.avgResponseMinutes) : '—'}
          context={m.avgArrivalMinutes !== null ? `${t('admin.kpis.arrivalTime')} ${fmt.duration(m.avgArrivalMinutes)}` : undefined}
        />
        <StatTile
          label={t('admin.kpis.rating')}
          value={m.rating.avg !== null ? fmt.number(m.rating.avg, 1) : '—'}
          context={m.rating.csat !== null ? `${t('admin.kpis.csat')} ${fmt.percent(m.rating.csat)}` : undefined}
        />
        <StatTile label={t('admin.kpis.gmv')} value={fmt.money(m.revenue.gmv30d)} context={`${t('admin.kpis.commission')} ${fmt.money(m.revenue.commission30d)}`} />
        <StatTile label={t('admin.kpis.unsettled')} value={fmt.money(m.revenue.commissionUnsettled)} />
        <Link href="/admin/technicians?status=pending" className="block">
          <StatTile
            label={t('admin.kpis.pendingVerification')}
            value={fmt.number(m.technicians.pending)}
            context={`${t('admin.kpis.availableNow')} ${fmt.number(m.technicians.availableNow)}`}
            tone={m.technicians.pending > 0 ? 'warn' : undefined}
          />
        </Link>
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-line bg-surface-1 p-5">
          <SectionTitle>{t('admin.chartRequests')}</SectionTitle>
          <StackedColumns
            caption={t('admin.chartRequests')}
            legend={[
              { label: t('admin.series.completed'), color: CHART.accent },
              { label: t('admin.series.other'), color: CHART.muted },
            ]}
            tableHeaders={[t('admin.columns.date'), t('admin.series.created'), t('admin.series.completed'), t('admin.series.cancelled')]}
            data={m.daily.map((d) => ({
              key: d.date,
              label: dayLabel(d.date),
              title: dayTitle(d.date),
              segments: [
                { value: d.completed, color: CHART.accent },
                { value: Math.max(0, d.created - d.completed), color: CHART.muted },
              ],
              details: [
                { label: t('admin.series.created'), value: fmt.number(d.created) },
                { label: t('admin.series.completed'), value: fmt.number(d.completed), color: CHART.accent },
                { label: t('admin.series.cancelled'), value: fmt.number(d.cancelled), color: CHART.muted },
              ],
            }))}
          />
        </section>

        <section className="rounded-xl border border-line bg-surface-1 p-5">
          <SectionTitle>{t('admin.chartCategories')}</SectionTitle>
          {m.byCategory.length === 0 ? (
            <p className="text-[14px] text-ink-3">{t('admin.noData')}</p>
          ) : (
            <HorizontalBars
              caption={t('admin.chartCategories')}
              rows={m.byCategory.slice(0, 8).map((c) => ({ key: c.category, label: t(`categories.${c.category}`), value: c.count }))}
              format={(n) => fmt.number(n)}
            />
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle
            action={
              <Link href="/admin/technicians?status=pending" className="flex items-center gap-1 text-sm text-gold-bright hover:underline">
                {t('common.seeAll')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          >
            {t('admin.verificationQueue')}
          </SectionTitle>
          {pending.data && pending.data.length === 0 && <p className="text-[14px] text-ink-3">{t('admin.queueEmpty')}</p>}
          <ul className="divide-y divide-line rounded-xl border border-line">
            {pending.data?.slice(0, 5).map((x) => (
              <li key={x.id}>
                <Link href={`/admin/technicians/${x.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1">
                  <Monogram name={x.businessName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">{x.businessName}</span>
                    <span className="block text-[13px] text-ink-3">
                      {x.area}, {fmt.ago(x.createdAt)}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-ink-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle
            action={
              <Link href="/admin/requests" className="flex items-center gap-1 text-sm text-gold-bright hover:underline">
                {t('common.seeAll')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          >
            {t('admin.recentRequests')}
          </SectionTitle>
          <div className="divide-y divide-line rounded-xl border border-line px-4">
            {recent.data?.slice(0, 5).map((r) => (
              <RequestRow key={r.id} request={r} href={`/admin/requests?open=${r.id}`} />
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
