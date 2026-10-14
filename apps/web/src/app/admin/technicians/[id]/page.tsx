'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { VerificationStatus } from '@onyx/core';
import { formatPhone } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAction, useAdminTechnician } from '@/lib/queries';
import { Facts, PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { VERIFICATION_TONE } from '@/components/admin/tones';
import { StatTile } from '@/components/admin/charts';
import { EmptyState, Monogram, Pill, SectionTitle, StarRow } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/field';

export default function AdminTechnicianPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const fmt = useFormat();
  const detail = useAdminTechnician(id);
  const [noteFor, setNoteFor] = useState<VerificationStatus | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const setStatus = useAction((b, v: { status: VerificationStatus; note?: string | null }) => b.admin.setVerification(id, v.status, v.note), {
    success: (_) => null,
  });

  if (detail.isLoading || detail.data === undefined) return <PageSkeleton />;
  if (!detail.data) {
    return (
      <PageContainer>
        <PageHeader title="" back="/admin/technicians" />
        <EmptyState title={t('technicians.notFound')} />
      </PageContainer>
    );
  }
  const { technician: x, documents, reviews, performance: p } = detail.data;

  const apply = (status: VerificationStatus, withNote?: string) =>
    setStatus.mutate(
      { status, note: withNote ?? null },
      {
        onSuccess: () => {
          setNoteFor(null);
          setNote('');
          toast.success(t(`admin.done.${status}`));
        },
      },
    );

  return (
    <PageContainer wide className="max-w-4xl">
      <PageHeader
        back="/admin/technicians"
        title={
          <span className="flex items-center gap-3">
            <Monogram name={x.businessName} verified={x.verificationStatus === 'verified'} />
            <span className="min-w-0">{x.businessName}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={VERIFICATION_TONE[x.verificationStatus]}>{t(`admin.verificationStatus.${x.verificationStatus}`)}</Pill>
            <span className="text-[13px] text-ink-3">
              {t('admin.columns.joined')} {fmt.date(x.createdAt)}
            </span>
          </span>
        }
      />

      {x.verificationNote && x.verificationStatus !== 'verified' && (
        <p className="mb-5 rounded-lg border border-danger/30 bg-danger/8 px-4 py-3 text-[14px] text-ink-2">{x.verificationNote}</p>
      )}

      <div className="mb-8 flex flex-wrap gap-2">
        {x.verificationStatus !== 'verified' && (
          <Button loading={setStatus.isPending && setStatus.variables?.status === 'verified'} onClick={() => apply('verified')}>
            {x.verificationStatus === 'suspended' ? t('admin.actions.reinstate') : t('admin.actions.verify')}
          </Button>
        )}
        {x.verificationStatus === 'pending' && (
          <Button variant="danger" onClick={() => setNoteFor('rejected')}>
            {t('admin.actions.reject')}
          </Button>
        )}
        {x.verificationStatus === 'verified' && (
          <Button variant="danger" onClick={() => setNoteFor('suspended')}>
            {t('admin.actions.suspend')}
          </Button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>{t('admin.contact')}</SectionTitle>
          <Facts
            items={[
              { label: t('admin.owner'), value: x.ownerName },
              ...(x.phone ? [{ label: t('onboarding.phone'), value: <span className="tabular">{formatPhone(x.phone)}</span> }] : []),
              ...(x.whatsapp ? [{ label: t('onboarding.whatsapp'), value: <span className="tabular">{formatPhone(x.whatsapp)}</span> }] : []),
              { label: t('onboarding.area'), value: `${x.area}, ${x.city}` },
              ...(x.address ? [{ label: t('onboarding.address'), value: x.address }] : []),
            ]}
          />
        </section>
        <section>
          <SectionTitle>{t('admin.profileSection')}</SectionTitle>
          <Facts
            items={[
              { label: t('onboarding.specialties'), value: x.specialties.map((s) => t(`specialties.${s}`)).join(', ') },
              { label: t('onboarding.vehicleTypes'), value: x.vehicleTypes.map((v) => t(`vehicleTypes.${v}`)).join(', ') },
              { label: t('onboarding.radius'), value: `${x.serviceRadiusKm} km${x.mobileService ? '' : `, ${t('technicians.garageOnly')}`}` },
              ...(x.corridors.length ? [{ label: t('onboarding.corridors'), value: x.corridors.map((c) => t(`corridors.${c}`)).join(', ') }] : []),
              ...(x.hasTowTruck ? [{ label: t('technicians.towTruck'), value: t('common.yes') }] : []),
              ...(x.yearsExperience !== null ? [{ label: t('onboarding.years'), value: String(x.yearsExperience) }] : []),
              ...(x.openingHours ? [{ label: t('onboarding.hours'), value: x.openingHours }] : []),
            ]}
          />
          {x.bio && <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{x.bio}</p>}
        </section>
      </div>

      <section className="mt-8">
        <SectionTitle>{t('admin.documents')}</SectionTitle>
        {documents.length === 0 ? (
          <p className="text-[14px] text-ink-3">{t('admin.noDocuments')}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface-1 px-4 py-3">
                <FileText className="size-5 text-gold" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-ink">{t(`onboarding.documents.${d.kind}`)}</span>
                  <span className="block truncate text-[12px] text-ink-3">{d.fileName}</span>
                </span>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-gold-bright hover:underline">
                    {t('admin.view')}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-[13px] text-ink-3">—</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {p && (
        <section className="mt-8">
          <SectionTitle>{t('admin.performance')}</SectionTitle>
          <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <StatTile label={t('admin.columns.completed30d')} value={fmt.number(p.jobsCompleted30d)} />
            <StatTile label={t('admin.columns.completion')} value={p.completionRate !== null ? fmt.percent(p.completionRate) : '—'} />
            <StatTile label={t('admin.columns.response')} value={p.avgResponseMinutes !== null ? fmt.duration(p.avgResponseMinutes) : '—'} />
            <StatTile label={t('admin.columns.revenue')} value={fmt.money(p.revenue30d)} />
          </dl>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>{t('technicians.reviewsTitle')}</SectionTitle>
        {reviews.length === 0 && <p className="text-[14px] text-ink-3">{t('technicians.noReviewsYet')}</p>}
        <ul className="divide-y divide-line">
          {reviews.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <StarRow value={r.rating} />
                <span className="text-xs text-ink-3">
                  {r.reviewerName}, {fmt.date(r.createdAt)}
                </span>
              </div>
              {r.comment && <p className="mt-1 text-[14px] text-ink-2">{r.comment}</p>}
            </li>
          ))}
        </ul>
      </section>

      <Sheet
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        title={noteFor === 'suspended' ? t('admin.actions.suspend') : t('admin.actions.reject')}
        footer={
          <Button
            size="lg"
            variant="danger"
            className="w-full"
            loading={setStatus.isPending}
            onClick={() => {
              if (!note.trim()) {
                setNoteError(t('admin.actions.noteRequired'));
                return;
              }
              setNoteError(null);
              apply(noteFor!, note.trim());
            }}
          >
            {t('common.confirm')}
          </Button>
        }
      >
        <Textarea aria-label={t('admin.actions.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin.actions.notePlaceholder')} maxLength={500} />
        {noteError && <p className="mt-2 text-[13px] text-danger-soft">{noteError}</p>}
      </Sheet>
    </PageContainer>
  );
}
