'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAdminMetrics, useAdminPerformance, useAdminReviews } from '@/lib/queries';
import { PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { HorizontalBars, StatTile } from '@/components/admin/charts';
import { SectionTitle, StarRow } from '@/components/ui/bits';

export default function AdminQualityPage() {
  const { t, tp } = useI18n();
  const fmt = useFormat();
  const metrics = useAdminMetrics();
  const reviews = useAdminReviews();
  const performance = useAdminPerformance();
  const m = metrics.data;
  if (!m) return <PageSkeleton />;

  const low = (reviews.data ?? []).filter((r) => r.rating <= 2).slice(0, 8);

  return (
    <PageContainer wide>
      <PageHeader title={t('admin.quality.title')} />

      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatTile label={t('admin.kpis.rating')} value={m.rating.avg !== null ? fmt.number(m.rating.avg, 2) : '—'} context={tp('technicians.reviews', m.rating.count)} />
        <StatTile label={t('admin.kpis.csat')} value={m.rating.csat !== null ? fmt.percent(m.rating.csat) : '—'} />
        <StatTile label={t('admin.kpis.completionRate')} value={m.requests.completionRate !== null ? fmt.percent(m.requests.completionRate) : '—'} context={t('admin.period30')} />
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface-1 p-5">
          <SectionTitle>{t('admin.quality.distribution')}</SectionTitle>
          <HorizontalBars
            caption={t('admin.quality.distribution')}
            rows={[5, 4, 3, 2, 1].map((stars) => ({
              key: String(stars),
              label: tp('request.stars', stars),
              value: m.rating.distribution[stars - 1] ?? 0,
            }))}
            format={(n) => fmt.number(n)}
          />
        </section>

        <section>
          <SectionTitle>{t('admin.quality.lowRatings')}</SectionTitle>
          {low.length === 0 ? (
            <p className="text-[14px] text-ink-3">{t('admin.quality.lowRatingsEmpty')}</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {low.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <StarRow value={r.rating} />
                    <Link href={`/admin/technicians/${r.technicianId}`} className="text-[13px] text-gold-bright hover:underline">
                      {performance.data?.find((p) => p.technicianId === r.technicianId)?.businessName ?? t('admin.columns.technician')}
                    </Link>
                  </div>
                  {r.comment && <p className="mt-1 text-[14px] text-ink-2">{r.comment}</p>}
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {r.reviewerName}, {fmt.date(r.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <SectionTitle>{t('admin.quality.performanceTable')}</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[820px] text-left text-[14px]">
            <thead className="border-b border-line bg-surface-1 text-[13px] text-ink-3">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.technician')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.completed30d')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.cancelled30d')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.completion')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.response')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.rating')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.revenue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {performance.data?.map((p) => (
                <tr key={p.technicianId} className="hover:bg-surface-1">
                  <td className="px-4 py-3">
                    <Link href={`/admin/technicians/${p.technicianId}`} className="font-medium text-ink hover:underline">
                      {p.businessName}
                    </Link>
                    <span className="block text-[12px] text-ink-3">{p.area}</span>
                  </td>
                  <td className="tabular px-4 py-3 text-right text-ink">{p.jobsCompleted30d}</td>
                  <td className="tabular px-4 py-3 text-right text-ink-2">{p.jobsCancelled30d}</td>
                  <td className="tabular px-4 py-3 text-right text-ink">{p.completionRate !== null ? fmt.percent(p.completionRate) : '—'}</td>
                  <td className="tabular px-4 py-3 text-right text-ink-2">{p.avgResponseMinutes !== null ? fmt.duration(p.avgResponseMinutes) : '—'}</td>
                  <td className="tabular px-4 py-3 text-right text-ink">{p.ratingCount ? p.ratingAvg.toFixed(1) : '—'}</td>
                  <td className="tabular px-4 py-3 text-right text-ink">{fmt.money(p.revenue30d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageContainer>
  );
}
