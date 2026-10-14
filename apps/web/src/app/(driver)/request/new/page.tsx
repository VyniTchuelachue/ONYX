'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/page';

// The wizard restores a draft from this tab's storage, so it renders on the client only.
const Wizard = dynamic(() => import('./wizard').then((m) => m.Wizard), { ssr: false, loading: () => <PageSkeleton /> });

export default function NewRequestPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Wizard />
    </Suspense>
  );
}