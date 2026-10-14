'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Bus, Car, Gem, LocateFixed, MapPin, Motorbike, Truck, Users, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  ISSUE_CATEGORIES,
  TRIAGE_RULES,
  normalizePhone,
  placeLabelFor,
  type IssueCategory,
  type VehicleType,
} from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useBackend } from '@/lib/backend';
import { useEnsureLocation, useLocation } from '@/lib/location';
import { useLocationLabel } from '@/lib/use-location-label';
import { useTechnician, useAction } from '@/lib/queries';
import { clearDraft, readDraft, writeDraft, type RequestDraft } from '@/lib/request-draft';
import { errorMessage } from '@/lib/errors';
import { isDemo } from '@/lib/config';
import { isBackendError } from '@onyx/core/backend';
import { PageContainer, PageHeader } from '@/components/page';
import { CategoryIcon } from '@/components/requests/category-icon';
import { useShellActions } from '@/components/shell/shell-actions';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Segmented } from '@/components/ui/choice';
import { Button, ButtonLink } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { MapMarker } from '@/components/map/onyx-map';

const OnyxMap = dynamic(() => import('@/components/map/onyx-map'), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

const STEPS = ['problem', 'vehicle', 'location', 'confirm'] as const;
const VEHICLE_ICONS = { car: Car, motorcycle: Motorbike, truck: Truck, bus: Bus } as const;

/** Rendered on the client only (see page.tsx), so the saved draft can be read on first render. */
export function Wizard() {
  useEnsureLocation();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const backend = useBackend();
  const { session, status: sessionStatus } = useSession();
  const { position, source, status: locStatus, locate } = useLocation();
  const { openLocation } = useShellActions();
  const loc = useLocationLabel();
  // Restore the draft (from the assistant, or from before a sign-in); a ?technician= link picks who.
  const [draft, setDraft] = useState<RequestDraft>(() => {
    const techParam = params.get('technician');
    return { step: 1, ...readDraft(), ...(techParam ? { technicianId: techParam, broadcast: false } : {}) };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    writeDraft(draft);
  }, [draft]);

  const tech = useTechnician(draft.technicianId ?? null);
  const create = useAction((b, input: Parameters<typeof b.requests.create>[0]) => b.requests.create(input), {
    success: t('requestNew.sent'),
    silentError: true,
  });

  const markers = useMemo<MapMarker[]>(() => (position ? [{ id: 'me', point: position, kind: 'driver' }] : []), [position]);

  const step = Math.min(Math.max(draft.step ?? 1, 1), 4);
  const update = (patch: Partial<RequestDraft>) => setDraft((d) => ({ ...d, ...patch }));
  // Fields the driver hasn't touched fall back to their profile.
  const profile = session?.profile;
  const vehicle = draft.vehicle ?? profile?.defaultVehicle ?? { type: 'car' as VehicleType };
  const contactName = draft.contactName ?? profile?.fullName ?? '';
  const contactPhone = draft.contactPhone ?? profile?.phone ?? '';

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1 && !draft.category) e.category = t('errors.pick_one');
    if (s === 3) {
      if (!position) e.location = t('requestNew.locationNeeded');
      if ((draft.landmark ?? '').trim().length < 3) e.landmark = t('errors.too_short');
    }
    if (s === 4) {
      if (contactName.trim().length < 2) e.contactName = t('errors.too_short');
      if (!normalizePhone(contactPhone)) e.contactPhone = t('errors.invalid_phone');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate(step)) update({ step: step + 1 });
  };

  const submit = async () => {
    if (!validate(4) || !position || !draft.category) return;
    if (!session) {
      setSignInOpen(true);
      return;
    }
    const urgency = draft.urgency ?? TRIAGE_RULES.find((r) => r.category === draft.category)?.urgency ?? 'medium';
    try {
      const created = await create.mutateAsync({
        category: draft.category,
        description: (draft.description ?? '').trim(),
        urgency,
        aiSummary: draft.aiSummary ?? null,
        vehicle,
        location: { lat: position.lat, lng: position.lng },
        landmark: (draft.landmark ?? '').trim(),
        contactName: contactName.trim(),
        contactPhone,
        requestedTechnicianId: draft.broadcast === false && draft.technicianId ? draft.technicianId : null,
        placeLabel: placeLabelFor(position),
      });
      clearDraft();
      router.replace(`/requests/${created.id}`);
    } catch (e) {
      if (isBackendError(e) && e.code === 'limit_reached') {
        toast.error(t('errors.limit_reached'), { action: { label: t('requests.title'), onClick: () => router.push('/requests') } });
      } else if (isBackendError(e) && e.code === 'unauthenticated') {
        setSignInOpen(true);
      } else {
        toast.error(errorMessage(t, e));
      }
    }
  };

  return (
    <PageContainer className="pb-28">
      <PageHeader
        title={t('requestNew.title')}
        back={step === 1 ? '/' : undefined}
        subtitle={<span className="tabular text-ink-3">{t('requestNew.stepOf', { current: step, total: STEPS.length })}</span>}
      />

      {/* Progress as a road being driven. */}
      <div className="mb-7 flex gap-1.5" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} className={cn('h-[3px] flex-1 rounded-full', i < step ? 'bg-gold' : 'bg-line-strong')} />
        ))}
      </div>

      {step === 1 && (
        <section className="space-y-6">
          <fieldset>
            <legend className="mb-3 font-wide text-[18px] font-semibold text-ink">{t('requestNew.whatHappened')}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {ISSUE_CATEGORIES.map((c) => {
                const active = draft.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ category: c as IssueCategory, urgency: undefined })}
                    className={cn(
                      'flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-center text-[13px] leading-tight transition-colors',
                      active ? 'border-gold bg-gold/12 text-gold-bright' : 'border-line bg-surface-1 text-ink-2 hover:border-line-strong hover:text-ink',
                      (c === 'smoke_fire' || c === 'accident') && !active && 'text-danger-soft',
                    )}
                  >
                    <CategoryIcon category={c as IssueCategory} className="size-6" />
                    {t(`categories.${c as IssueCategory}`)}
                  </button>
                );
              })}
            </div>
            {errors.category && <p className="mt-2 text-[13px] text-danger-soft">{errors.category}</p>}
          </fieldset>

          <Field label={t('requestNew.describe')} optional={t('common.optional')}>
            {(p) => (
              <Textarea
                {...p}
                value={draft.description ?? ''}
                onChange={(e) => update({ description: e.target.value })}
                placeholder={t('requestNew.describePlaceholder')}
                maxLength={1000}
              />
            )}
          </Field>

          {draft.aiSummary && (
            <p className="flex items-start gap-2.5 rounded-lg border border-violet/30 bg-violet/8 p-3.5 text-[14px] leading-snug text-ink-2">
              <Gem className="mt-0.5 size-4 shrink-0 text-violet-soft" aria-hidden="true" />
              {t('requestNew.aiAttached')}
            </p>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <h2 className="font-wide text-[18px] font-semibold text-ink">{t('requestNew.vehicleTitle')}</h2>
          <Segmented
            label={t('requestNew.vehicleType')}
            value={vehicle.type}
            onChange={(type) => update({ vehicle: { ...vehicle, type } })}
            options={(['car', 'motorcycle', 'truck', 'bus'] as const).map((v) => {
              const Icon = VEHICLE_ICONS[v];
              return { value: v, label: <span className="hidden min-[400px]:inline">{t(`vehicleTypes.${v}`)}</span>, icon: <Icon className="size-4" aria-label={t(`vehicleTypes.${v}`)} /> };
            })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('requestNew.make')} optional={t('common.optional')}>
              {(p) => <Input {...p} value={vehicle.make ?? ''} onChange={(e) => update({ vehicle: { ...vehicle, make: e.target.value } })} placeholder={t('requestNew.makePlaceholder')} maxLength={40} />}
            </Field>
            <Field label={t('requestNew.model')} optional={t('common.optional')}>
              {(p) => <Input {...p} value={vehicle.model ?? ''} onChange={(e) => update({ vehicle: { ...vehicle, model: e.target.value } })} placeholder={t('requestNew.modelPlaceholder')} maxLength={40} />}
            </Field>
            <Field label={t('requestNew.plate')} optional={t('common.optional')}>
              {(p) => (
                <Input
                  {...p}
                  value={vehicle.plate ?? ''}
                  onChange={(e) => update({ vehicle: { ...vehicle, plate: e.target.value.toUpperCase() } })}
                  placeholder={t('requestNew.platePlaceholder')}
                  maxLength={16}
                  autoCapitalize="characters"
                />
              )}
            </Field>
            <Field label={t('requestNew.color')} hint={t('requestNew.colorHelp')}>
              {(p) => <Input {...p} value={vehicle.color ?? ''} onChange={(e) => update({ vehicle: { ...vehicle, color: e.target.value } })} placeholder={t('requestNew.colorPlaceholder')} maxLength={30} />}
            </Field>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5">
          <h2 className="font-wide text-[18px] font-semibold text-ink">{t('requestNew.whereAreYou')}</h2>
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="h-48 bg-surface-1">
              {position ? (
                <OnyxMap center={position} zoom={15} markers={markers} label={t('requestNew.whereAreYou')} />
              ) : (
                <div className="grid h-full place-items-center px-6 text-center text-[14px] text-ink-3">{t('requestNew.locationNeeded')}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-1 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-ink">{loc.label}</p>
                {position && source && (
                  <p className="text-[13px] text-ink-3">
                    {t(`requestNew.positionFrom.${source}`)}
                    {position.accuracy ? `, ${t('requestNew.accuracy', { meters: position.accuracy })}` : ''}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" icon={<LocateFixed className="size-4 text-gold" />} loading={locStatus === 'locating'} onClick={locate}>
                  {t('location.useGps')}
                </Button>
                <Button size="sm" variant="ghost" icon={<MapPin className="size-4" />} onClick={openLocation}>
                  {t('location.chooseArea')}
                </Button>
              </div>
            </div>
          </div>
          {errors.location && <p className="text-[13px] text-danger-soft">{errors.location}</p>}

          <Field label={t('requestNew.landmark')} hint={t('requestNew.landmarkHelp')} error={errors.landmark}>
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                className="min-h-0"
                value={draft.landmark ?? ''}
                onChange={(e) => update({ landmark: e.target.value })}
                placeholder={t('requestNew.landmarkPlaceholder')}
                maxLength={200}
              />
            )}
          </Field>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-6">
          <fieldset>
            <legend className="mb-3 font-wide text-[18px] font-semibold text-ink">{t('requestNew.whoTitle')}</legend>
            <div className="space-y-2">
              {draft.technicianId && tech.data && (
                <ChoiceCard
                  active={draft.broadcast === false}
                  onClick={() => update({ broadcast: false })}
                  icon={<UserRound className="size-5" aria-hidden="true" />}
                  title={t('requestNew.direct', { name: tech.data.businessName })}
                  body={t('requestNew.directHelp', { name: tech.data.businessName })}
                />
              )}
              <ChoiceCard
                active={draft.broadcast !== false || !draft.technicianId}
                onClick={() => update({ broadcast: true })}
                icon={<Users className="size-5" aria-hidden="true" />}
                title={t('requestNew.broadcast')}
                body={t('requestNew.broadcastHelp')}
              />
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('requestNew.contactName')} error={errors.contactName}>
              {(p) => <Input {...p} autoComplete="name" value={contactName} onChange={(e) => update({ contactName: e.target.value })} maxLength={80} />}
            </Field>
            <Field label={t('requestNew.contactPhone')} hint={t('requestNew.phoneHelp')} error={errors.contactPhone}>
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={contactPhone}
                  onChange={(e) => update({ contactPhone: e.target.value })}
                  placeholder="6 99 12 34 56"
                />
              )}
            </Field>
          </div>

          <section className="rounded-xl border border-line bg-surface-1 p-4">
            <h3 className="mb-3 text-[14px] font-medium text-ink-3">{t('requestNew.summary')}</h3>
            <ul className="space-y-2 text-[15px] text-ink">
              {draft.category && (
                <li className="flex items-center gap-2.5">
                  <CategoryIcon category={draft.category} className="size-4 text-gold" />
                  {t(`categories.${draft.category}`)}
                </li>
              )}
              <li className="flex items-center gap-2.5">
                {(() => {
                  const Icon = VEHICLE_ICONS[vehicle.type];
                  return <Icon className="size-4 text-gold" aria-hidden="true" />;
                })()}
                {[t(`vehicleTypes.${vehicle.type}`), vehicle.make, vehicle.model, vehicle.color, vehicle.plate].filter(Boolean).join(', ')}
              </li>
              {position && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                  <span>
                    {placeLabelFor(position)}
                    {draft.landmark ? <span className="block text-ink-2">{draft.landmark}</span> : null}
                  </span>
                </li>
              )}
            </ul>
          </section>

          {!draft.technicianId && (
            <p className="text-[14px] text-ink-3">
              {t('requestNew.callInstead')}{' '}
              <Link href="/technicians" className="font-medium text-gold-bright underline-offset-4 hover:underline">
                {t('home.findCta')}
              </Link>
            </p>
          )}
        </section>
      )}

      {/* Navigation stays within thumb reach, above the tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(64px+var(--safe-bottom))] z-20 border-t border-line bg-onyx/95 backdrop-blur lg:static lg:mt-8 lg:border-0 lg:bg-transparent">
        <div className="mx-auto flex max-w-2xl gap-2.5 px-4 py-3 sm:px-6 lg:px-0">
          {step > 1 && (
            <Button variant="secondary" size="lg" onClick={() => update({ step: step - 1 })}>
              {t('common.back')}
            </Button>
          )}
          {step < 4 ? (
            <Button size="lg" className="flex-1" onClick={next}>
              {t('common.continue')}
            </Button>
          ) : (
            <Button size="lg" className="flex-1" loading={create.isPending} onClick={() => void submit()}>
              {create.isPending ? t('requestNew.submitting') : t('requestNew.submit')}
            </Button>
          )}
        </div>
      </div>

      <Sheet open={signInOpen} onClose={() => setSignInOpen(false)} title={t('requestNew.signInTitle')} description={t('requestNew.signInBody')}>
        <div className="flex flex-col gap-2.5">
          <ButtonLink href="/auth/sign-in?next=/request/new" size="lg">
            {t('requestNew.signInCta')}
          </ButtonLink>
          <ButtonLink href="/auth/sign-up?next=/request/new" size="lg" variant="secondary">
            {t('auth.signUp')}
          </ButtonLink>
          {isDemo && backend?.auth.demo && sessionStatus !== 'signed-in' && (
            <Button
              size="lg"
              variant="ghost"
              onClick={async () => {
                await backend.auth.demo!.signInAs('driver');
                setSignInOpen(false);
              }}
            >
              {t('auth.continueAs', { role: t('auth.demoRoles.driver') })}
            </Button>
          )}
        </div>
      </Sheet>
    </PageContainer>
  );
}

function ChoiceCard({ active, onClick, icon, title, body }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-colors',
        active ? 'border-gold bg-gold/8' : 'border-line bg-surface-1 hover:border-line-strong',
      )}
    >
      <span className={cn('mt-0.5 grid size-9 shrink-0 place-items-center rounded-full', active ? 'bg-gold text-onyx' : 'bg-surface-3 text-ink-2')}>{icon}</span>
      <span>
        <span className="block text-[16px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[14px] leading-snug text-ink-3">{body}</span>
      </span>
    </button>
  );
}
