'use client';

import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAction, useMyTechnician, useProDocuments } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { errorMessage, fieldMessages } from '@/lib/errors';
import { PageContainer, PageHeader, PageSkeleton, RequireSession } from '@/components/page';
import {
  BUSINESS_FIELDS,
  BusinessFields,
  SERVICE_FIELDS,
  ServicesFields,
  ZONE_FIELDS,
  ZoneFields,
  useTechnicianForm,
} from '@/components/pro/technician-form';
import { DocumentsSection } from '@/components/pro/documents-section';
import { Button, ButtonLink } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STEPS = ['business', 'services', 'zone', 'documents'] as const;

export default function OnboardingPage() {
  return (
    <RequireSession>
      <Onboarding />
    </RequireSession>
  );
}

function Onboarding() {
  const me = useMyTechnician();
  if (me.isLoading || me.data === undefined) return <PageSkeleton />;
  // Already registered: go straight to documents, or show the finished state.
  return <Wizard startAtDocuments={!!me.data} />;
}

function Wizard({ startAtDocuments }: { startAtDocuments: boolean }) {
  const { t } = useI18n();
  const { refresh } = useSession();
  const form = useTechnicianForm(null);
  const listing = useMyTechnician().data;
  const documents = useProDocuments(!!listing).data ?? [];
  const [step, setStep] = useState(startAtDocuments ? 4 : 1);
  const [done, setDone] = useState(false);
  const register = useAction((b, _: void) => b.pro.register(form.toInput()), { silentError: true });

  const fieldsFor = [BUSINESS_FIELDS, SERVICE_FIELDS, ZONE_FIELDS];

  const next = async () => {
    if (step <= 3 && !form.validate(fieldsFor[step - 1])) return;
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    if (step === 3) {
      if (!form.validate()) {
        // Jump back to the first section with a problem.
        const firstBad = fieldsFor.findIndex((fields) => !form.validate(fields));
        if (firstBad >= 0) setStep(firstBad + 1);
        return;
      }
      try {
        await register.mutateAsync();
        await refresh();
        setStep(4);
      } catch (e) {
        const fields = fieldMessages(t, e);
        toast.error(Object.keys(fields).length ? t('errors.validation') : errorMessage(t, e));
      }
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <PageContainer>
        <div className="pt-12 text-center">
          <CircleCheck className="mx-auto size-14 text-ok" aria-hidden="true" />
          <h1 className="mt-5 font-display text-[28px] leading-tight text-ink">{t('pro.verification.pending')}</h1>
          <p className="mx-auto mt-3 max-w-sm text-[16px] leading-relaxed text-ink-2">
            {documents.length ? t('onboarding.submitted') : t('onboarding.submittedNoDocuments')}
          </p>
          <ButtonLink href="/pro" size="lg" className="mt-8">
            {t('nav.proHome')}
          </ButtonLink>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-32">
      <PageHeader title={t('onboarding.title')} subtitle={step === 1 ? t('onboarding.intro') : undefined} />
      <ol className="mb-7 grid grid-cols-4 gap-1.5" aria-label={t('requestNew.stepOf', { current: step, total: 4 })}>
        {STEPS.map((s, i) => (
          <li key={s}>
            <span className={cn('block h-[3px] rounded-full', i < step ? 'bg-gold' : 'bg-line-strong')} aria-hidden="true" />
            <span className={cn('mt-2 block text-[12px]', i + 1 === step ? 'font-medium text-ink' : 'text-ink-3')}>{t(`onboarding.steps.${s}`)}</span>
          </li>
        ))}
      </ol>

      {step === 1 && <BusinessFields form={form} />}
      {step === 2 && <ServicesFields form={form} />}
      {step === 3 && <ZoneFields form={form} />}
      {step === 4 && (
        <section>
          <h2 className="mb-1 font-wide text-[18px] font-semibold text-ink">{t('onboarding.documentsTitle')}</h2>
          <DocumentsSection />
        </section>
      )}

      <div
        className={cn(
          'fixed inset-x-0 z-20 border-t border-line bg-onyx/95 backdrop-blur lg:bottom-0 lg:left-[248px] lg:pb-0',
          // The pro navigation appears once the listing exists.
          listing ? 'bottom-[calc(64px+var(--safe-bottom))]' : 'bottom-0 pb-safe',
        )}
      >
        <div className="mx-auto flex max-w-2xl gap-2.5 px-4 py-3 sm:px-6">
          {step > 1 && step < 4 && (
            <Button variant="secondary" size="lg" onClick={() => setStep(step - 1)}>
              {t('common.back')}
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1"
            variant={step === 4 && !documents.length ? 'secondary' : 'primary'}
            loading={register.isPending}
            onClick={() => void next()}
          >
            {step === 3
              ? t('pro.createProfile')
              : step === 4
                ? documents.length
                  ? t('onboarding.submit')
                  : t('onboarding.documentsLater')
                : t('common.continue')}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
