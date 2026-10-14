'use client';

import { useState } from 'react';
import { Briefcase } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useJobs } from '@/lib/queries';
import { PageContainer, PageHeader } from '@/components/page';
import { RequireListing } from '@/components/pro/require-listing';
import { RequestRow } from '@/components/requests/request-row';
import { Segmented } from '@/components/ui/choice';
import { EmptyState, Skeleton } from '@/components/ui/bits';

export default function ProJobsPage() {
  return <RequireListing>{() => <Jobs />}</RequireListing>;
}

function Jobs() {
  const { t } = useI18n();
  const [scope, setScope] = useState<'active' | 'history'>('active');
  const jobs = useJobs(scope);
  return (
    <PageContainer>
      <PageHeader title={t('pro.jobsTitle')} />
      <Segmented
        label={t('pro.jobsTitle')}
        value={scope}
        onChange={setScope}
        options={[
          { value: 'active', label: t('pro.jobsActive') },
          { value: 'history', label: t('pro.jobsHistory') },
        ]}
      />
      {jobs.data === undefined ? (
        <div className="mt-4 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : jobs.data.length === 0 ? (
        <EmptyState icon={<Briefcase className="size-6" aria-hidden="true" />} title={t('pro.jobsEmpty')} />
      ) : (
        <div className="mt-2 divide-y divide-line">
          {jobs.data.map((j) => (
            <RequestRow key={j.id} request={j} href={`/pro/jobs/${j.id}`} who="driver" />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
