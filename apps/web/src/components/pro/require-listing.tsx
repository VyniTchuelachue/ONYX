'use client';

import type { ReactNode } from 'react';
import { Wrench } from 'lucide-react';
import type { TechnicianPrivate } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useMyTechnician } from '@/lib/queries';
import { PageContainer, PageSkeleton, RequireSession } from '../page';
import { EmptyState } from '../ui/bits';
import { ButtonLink } from '../ui/button';

/** Technician pages need an account and a listing; send everyone else to the right place. */
export function RequireListing({ children }: { children: (listing: TechnicianPrivate) => ReactNode }) {
  return (
    <RequireSession>
      <ListingGate>{children}</ListingGate>
    </RequireSession>
  );
}

function ListingGate({ children }: { children: (listing: TechnicianPrivate) => ReactNode }) {
  const { t } = useI18n();
  const me = useMyTechnician();
  if (me.isLoading || me.data === undefined) return <PageSkeleton />;
  if (!me.data) {
    return (
      <PageContainer>
        <EmptyState
          icon={<Wrench className="size-6" aria-hidden="true" />}
          title={t('pro.notTechnician')}
          body={t('onboarding.intro')}
          action={
            <ButtonLink href="/pro/onboarding" size="lg">
              {t('pro.createProfile')}
            </ButtonLink>
          }
        />
      </PageContainer>
    );
  }
  return <>{children(me.data)}</>;
}
