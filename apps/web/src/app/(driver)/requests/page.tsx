'use client';

import { useState } from 'react';
import { Route } from 'lucide-react';
import { isActive } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useMyRequests } from '@/lib/queries';
import { PageContainer, PageHeader, RequireSession } from '@/components/page';
import { RequestRow } from '@/components/requests/request-row';
import { Segmented } from '@/components/ui/choice';
import { EmptyState, Skeleton } from '@/components/ui/bits';
import { ButtonLink } from '@/components/ui/button';

export default function RequestsPage() {
  const { t } = useI18n();
  return (
    <RequireSession title={t('requests.title')} body={t('requests.signInBody')}>
      <RequestsList />
    </RequireSession>
  );
}

function RequestsList() {
  const { t } = useI18n();
  const { data } = useMyRequests();
  const [chosenTab, setTab] = useState<'active' | 'past' | null>(null);
  const active = data?.filter((r) => isActive(r.status)) ?? [];
  const past = data?.filter((r) => !isActive(r.status)) ?? [];
  // Until the user picks a tab, open on history when nothing is in progress.
  const tab = chosenTab ?? (active.length === 0 && past.length > 0 ? 'past' : 'active');

  const list = tab === 'active' ? active : past;

  return (
    <PageContainer>
      <PageHeader title={t('requests.title')} />
      <Segmented
        label={t('requests.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: `${t('requests.active')}${active.length ? ` (${active.length})` : ''}` },
          { value: 'past', label: t('requests.past') },
        ]}
      />
      {data === undefined ? (
        <div className="mt-4 space-y-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3.5">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Route className="size-6" aria-hidden="true" />}
          title={data.length === 0 ? t('requests.empty') : tab === 'active' ? t('requests.emptyActive') : t('requests.emptyPast')}
          action={tab === 'active' && <ButtonLink href="/assistant">{t('requests.emptyCta')}</ButtonLink>}
        />
      ) : (
        <div className="mt-2 divide-y divide-line">
          {list.map((r) => (
            <RequestRow key={r.id} request={r} href={`/requests/${r.id}`} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
