'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { VERIFICATION_STATUSES, type VerificationStatus } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAdminTechnicians } from '@/lib/queries';
import { PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { Chip } from '@/components/ui/choice';
import { EmptyState, Monogram, Pill, Rating, Skeleton } from '@/components/ui/bits';
import { VERIFICATION_TONE } from '@/components/admin/tones';

export default function AdminTechniciansPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TechniciansAdmin />
    </Suspense>
  );
}

function TechniciansAdmin() {
  const { t } = useI18n();
  const fmt = useFormat();
  const params = useSearchParams();
  const initial = params.get('status');
  const [status, setStatus] = useState<VerificationStatus | null>(
    VERIFICATION_STATUSES.includes(initial as VerificationStatus) ? (initial as VerificationStatus) : null,
  );
  const [query, setQuery] = useState('');
  const list = useAdminTechnicians(status);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data ?? []).filter((x) => !q || `${x.businessName} ${x.ownerName} ${x.area} ${x.city} ${x.phone}`.toLowerCase().includes(q));
  }, [list.data, query]);

  return (
    <PageContainer wide>
      <PageHeader title={t('nav.adminTechnicians')} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip pressed={status === null} onClick={() => setStatus(null)}>
            {t('admin.filters.all')}
          </Chip>
          {VERIFICATION_STATUSES.map((s) => (
            <Chip key={s} pressed={status === s} onClick={() => setStatus(s)}>
              {t(`admin.verificationStatus.${s}`)}
            </Chip>
          ))}
        </div>
        <label className="relative sm:ml-auto sm:w-72">
          <span className="sr-only">{t('technicians.searchLabel')}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('technicians.searchPlaceholder')}
            className="h-10 w-full rounded-md border border-line bg-surface-2 pr-3 pl-10 text-[15px] text-ink placeholder:text-ink-3 focus:border-gold/70 focus:outline-none"
          />
        </label>
      </div>

      {list.data === undefined ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t('admin.noData')} />
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="border-b border-line bg-surface-1 text-[13px] text-ink-3">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.technician')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.area')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.specialties')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.status')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.rating')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.jobs')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('admin.columns.joined')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((x) => (
                <tr key={x.id} className="hover:bg-surface-1">
                  <td className="px-4 py-3">
                    <Link href={`/admin/technicians/${x.id}`} className="flex items-center gap-3">
                      <Monogram name={x.businessName} size="sm" verified={x.verificationStatus === 'verified'} />
                      <span className="min-w-0">
                        <span className="block max-w-[16rem] truncate font-medium text-ink">{x.businessName}</span>
                        <span className="block text-[13px] text-ink-3">{x.ownerName}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {x.area}
                    {x.city !== 'Douala' && x.city !== x.area ? `, ${x.city}` : ''}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-ink-2">{x.specialties.map((s) => t(`specialtyShort.${s}`)).join(', ')}</td>
                  <td className="px-4 py-3">
                    <Pill tone={VERIFICATION_TONE[x.verificationStatus]}>{t(`admin.verificationStatus.${x.verificationStatus}`)}</Pill>
                  </td>
                  <td className="px-4 py-3">{x.ratingCount > 0 ? <Rating value={x.ratingAvg} count={`(${x.ratingCount})`} /> : <span className="text-ink-3">—</span>}</td>
                  <td className="tabular px-4 py-3 text-right text-ink">{fmt.number(x.jobsCompleted)}</td>
                  <td className="tabular px-4 py-3 text-right text-ink-3">{fmt.date(x.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
