'use client';

import { useMemo } from 'react';
import { PAYMENT_METHODS } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAction, useAdminPayments } from '@/lib/queries';
import { PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { HorizontalBars, StatTile } from '@/components/admin/charts';
import { Pill, SectionTitle } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';

export default function AdminPaymentsPage() {
  const { t } = useI18n();
  const fmt = useFormat();
  const payments = useAdminPayments();
  const settle = useAction((b, id: string) => b.admin.settleCommission(id), { success: t('admin.payments.settledToast') });

  const totals = useMemo(() => {
    const paid = (payments.data ?? []).filter((p) => p.status === 'paid');
    return {
      gmv: paid.reduce((s, p) => s + p.amount, 0),
      commission: paid.reduce((s, p) => s + p.commission, 0),
      unsettled: paid.filter((p) => !p.commissionSettledAt).reduce((s, p) => s + p.commission, 0),
      byMethod: PAYMENT_METHODS.map((m) => ({ method: m, amount: paid.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) })),
    };
  }, [payments.data]);

  if (!payments.data) return <PageSkeleton />;

  return (
    <PageContainer wide>
      <PageHeader title={t('admin.payments.title')} subtitle={t('admin.payments.note')} />

      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatTile label={t('admin.kpis.gmv')} value={fmt.money(totals.gmv)} />
        <StatTile label={t('admin.kpis.commission')} value={fmt.money(totals.commission)} />
        <StatTile label={t('admin.kpis.unsettled')} value={fmt.money(totals.unsettled)} tone={totals.unsettled > 0 ? 'warn' : undefined} />
      </dl>

      <section className="mt-8 rounded-xl border border-line bg-surface-1 p-5">
        <SectionTitle>{t('admin.payments.byMethod')}</SectionTitle>
        <HorizontalBars
          caption={t('admin.payments.byMethod')}
          rows={totals.byMethod.map((m) => ({ key: m.method, label: t(`request.methods.${m.method}`), value: m.amount }))}
          format={(n) => fmt.money(n)}
        />
      </section>

      <div className="mt-8 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[780px] text-left text-[14px]">
          <thead className="border-b border-line bg-surface-1 text-[13px] text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.date')}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.code')}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.technician')}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.method')}</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.amount')}</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.commission')}</th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">{t('admin.columns.status')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.data.map((p) => (
              <tr key={p.id}>
                <td className="tabular px-4 py-3 text-ink-3">{fmt.dateTime(p.paidAt ?? p.createdAt)}</td>
                <td className="tabular px-4 py-3 text-ink-2">{p.requestCode ?? '—'}</td>
                <td className="max-w-[14rem] truncate px-4 py-3 text-ink">{p.technicianName ?? '—'}</td>
                <td className="px-4 py-3 text-ink-2">{t(`request.methods.${p.method}`)}</td>
                <td className="tabular px-4 py-3 text-right text-ink">{fmt.money(p.amount)}</td>
                <td className="tabular px-4 py-3 text-right text-ink">{fmt.money(p.commission)}</td>
                <td className="px-4 py-3 text-right">
                  {p.commissionSettledAt ? (
                    <Pill tone="ok">{t('admin.payments.settled')}</Pill>
                  ) : (
                    <Button size="sm" variant="secondary" loading={settle.isPending && settle.variables === p.id} onClick={() => settle.mutate(p.id)}>
                      {t('admin.payments.settle')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
