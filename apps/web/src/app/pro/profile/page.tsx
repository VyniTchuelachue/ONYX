'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { TechnicianPrivate } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useAction } from '@/lib/queries';
import { PageContainer, PageHeader } from '@/components/page';
import { RequireListing } from '@/components/pro/require-listing';
import { BusinessFields, ServicesFields, ZoneFields, useTechnicianForm } from '@/components/pro/technician-form';
import { DocumentsSection } from '@/components/pro/documents-section';
import { Pill } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';

export default function ProProfilePage() {
  return <RequireListing>{(listing) => <ListingEditor listing={listing} />}</RequireListing>;
}

const STATUS_TONE = { pending: 'gold', verified: 'ok', rejected: 'danger', suspended: 'danger' } as const;

function ListingEditor({ listing }: { listing: TechnicianPrivate }) {
  const { t } = useI18n();
  const form = useTechnicianForm(listing);
  const save = useAction((b, _: void) => b.pro.update(form.toInput()), { success: t('onboarding.saved') });

  return (
    <PageContainer className="pb-32">
      <PageHeader
        title={t('nav.proProfile')}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={STATUS_TONE[listing.verificationStatus]}>{t(`admin.verificationStatus.${listing.verificationStatus}`)}</Pill>
            {listing.verificationStatus === 'verified' && (
              <Link href={`/technicians/${listing.id}`} className="inline-flex items-center gap-1 text-[14px] text-gold-bright hover:underline">
                {t('technicians.openProfile')}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </span>
        }
      />

      <section className="space-y-10">
        <div>
          <h2 className="mb-4 font-wide text-[18px] font-semibold text-ink">{t('onboarding.steps.business')}</h2>
          <BusinessFields form={form} />
        </div>
        <div>
          <h2 className="mb-4 font-wide text-[18px] font-semibold text-ink">{t('onboarding.steps.services')}</h2>
          <ServicesFields form={form} />
        </div>
        <div>
          <h2 className="mb-4 font-wide text-[18px] font-semibold text-ink">{t('onboarding.steps.zone')}</h2>
          <ZoneFields form={form} />
        </div>
        <div>
          <h2 className="mb-1 font-wide text-[18px] font-semibold text-ink">{t('onboarding.documentsTitle')}</h2>
          <DocumentsSection />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-[calc(64px+var(--safe-bottom))] z-20 border-t border-line bg-onyx/95 backdrop-blur lg:bottom-0 lg:left-[248px]">
        <div className="mx-auto max-w-2xl px-4 py-3 sm:px-6">
          <Button size="lg" className="w-full" loading={save.isPending} onClick={() => form.validate() && save.mutate()}>
            {t('onboarding.saveChanges')}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
