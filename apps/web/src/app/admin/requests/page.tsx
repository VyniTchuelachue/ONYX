'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { RequestStatus } from '@onyx/core';
import { isActive } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAction, useAdminRequest, useAdminRequests } from '@/lib/queries';
import { Facts, PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { StatusPill } from '@/components/requests/request-row';
import { QuoteCard } from '@/components/requests/quote-card';
import { Timeline } from '@/components/requests/timeline';
import { CategoryIcon } from '@/components/requests/category-icon';
import { CancelSheet } from '@/components/requests/cancel-sheet';
import { Chip } from '@/components/ui/choice';
import { EmptyState, SectionTitle, Skeleton } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const FILTERS: (RequestStatus | 'active' | null)[] = [null, 'active', 'pending', 'completed', 'cancelled'];

export default function AdminRequestsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequestsAdmin />
    </Suspense>
  );
}

function RequestsAdmin() {
  const { t } = useI18n();
  const fmt = useFormat();
  const params = useSearchParams();
  const router = useRouter();
  const [filter, setFilter] = useState<RequestStatus | 'active' | null>(null);
  const openId = params.get('open');
  const list = useAdminRequests(filter);

  const open = (id: string | null) => router.replace(id ? `/admin/requests?open=${id}` : '/admin/requests', { scroll: false });

  return (
    <PageContainer wide>
      <PageHeader title={t('nav.adminRequests')} />
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <Chip key={f ?? 'all'} pressed={filter === f} onClick={() => setFilter(f)}>
            {f === null ? t('admin.filters.all') : f === 'active' ? t('admin.filters.active') : t(`request.status.${f}`)}
          </Chip>
        ))}
      </div>

      {list.data === undefined ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.data.length === 0 ? (
        <EmptyState title={t('admin.noData')} />
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <thead className="border-b border-line bg-surface-1 text-[13px] text-ink-3">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.code')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.category')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.driver')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.technician')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.status')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.amount')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.created')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-surface-1" onClick={() => open(r.id)}>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => open(r.id)} className="tabular font-medium text-gold-bright hover:underline">
                      {r.code}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    <span className="flex items-center gap-2">
                      <CategoryIcon category={r.category} className="size-4 text-ink-3" />
                      {t(`categories.${r.category}`)}
                    </span>
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-3 text-ink-2">{r.contactName}</td>
                  <td className="max-w-[12rem] truncate px-4 py-3 text-ink-2">{r.technicianName ?? <span className="text-ink-3">{t('admin.unassigned')}</span>}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="tabular px-4 py-3 text-right text-ink">{r.acceptedTotal !== null ? fmt.money(r.acceptedTotal) : '—'}</td>
                  <td className="tabular px-4 py-3 text-right text-ink-3">{fmt.dateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RequestSheet id={openId} onClose={() => open(null)} />
    </PageContainer>
  );
}

function RequestSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const detail = useAdminRequest(id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancel = useAction((b, reason: string) => b.admin.cancelRequest(id!, reason || t('admin.cancelReason')), { success: t('request.cancelled') });
  const d = detail.data;
  const r = d?.request;

  return (
    <>
      <Sheet open={!!id} onClose={onClose} title={r ? `${r.code}` : t('common.loading')} description={r ? t(`categories.${r.category}`) : undefined}>
        {!r ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={r.status} />
              <span className="text-[13px] text-ink-3">{fmt.dateTime(r.createdAt)}</span>
            </div>
            <Facts
              items={[
                { label: t('admin.columns.driver'), value: `${r.contactName}, ${fmt.phone(r.contactPhone)}` },
                { label: t('admin.columns.technician'), value: d.technician?.businessName ?? t('admin.unassigned') },
                { label: t('request.place'), value: r.placeLabel ?? '—' },
                { label: t('request.landmark'), value: r.landmark },
                ...(r.description ? [{ label: t('requestNew.describe'), value: r.description }] : []),
                ...(d.payment ? [{ label: t('request.payment'), value: `${fmt.money(d.payment.amount)}, ${t(`request.methods.${d.payment.method}`)}` }] : []),
                ...(r.cancelReason ? [{ label: t('request.cancelled'), value: r.cancelReason }] : []),
              ]}
            />
            {d.quotes.map((q) => (
              <QuoteCard key={q.id} quote={q} />
            ))}
            <section>
              <SectionTitle>{t('request.timeline')}</SectionTitle>
              <Timeline events={d.events} />
            </section>
            {isActive(r.status) && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                {t('admin.cancelRequest')}
              </Button>
            )}
          </div>
        )}
      </Sheet>
      <CancelSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason, { onSuccess: () => setCancelOpen(false) })}
      />
    </>
  );
}
