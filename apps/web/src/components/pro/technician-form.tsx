'use client';

import { useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import {
  ALL_PLACES,
  CORRIDOR_IDS,
  CORRIDOR_TOWNS,
  DOUALA_QUARTERS,
  SPECIALTIES,
  VEHICLE_TYPES,
  describeLocation,
  fieldErrors,
  technicianInputSchema,
  type CorridorId,
  type GeoPoint,
  type MessageKey,
  type Specialty,
  type TechnicianInput,
  type TechnicianPrivate,
  type VehicleType,
} from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { Field, Input, Select, Textarea } from '../ui/field';
import { Chip, Switch } from '../ui/choice';
import { Button } from '../ui/button';

export interface TechnicianFormValues {
  businessName: string;
  ownerName: string;
  bio: string;
  phone: string;
  whatsapp: string;
  yearsExperience: string;
  specialties: Specialty[];
  vehicleTypes: VehicleType[];
  mobileService: boolean;
  hasTowTruck: boolean;
  openingHours: string;
  location: GeoPoint | null;
  area: string;
  city: string;
  address: string;
  serviceRadiusKm: number;
  corridors: CorridorId[];
}

export function useTechnicianForm(initial: TechnicianPrivate | null) {
  const { session } = useSession();
  const [values, setValues] = useState<TechnicianFormValues>(() => ({
    businessName: initial?.businessName ?? '',
    ownerName: initial?.ownerName ?? session?.profile.fullName ?? '',
    bio: initial?.bio ?? '',
    phone: initial?.phone ?? session?.profile.phone ?? '',
    whatsapp: initial?.whatsapp && initial.whatsapp !== initial.phone ? initial.whatsapp : '',
    yearsExperience: initial?.yearsExperience !== null && initial?.yearsExperience !== undefined ? String(initial.yearsExperience) : '',
    specialties: initial?.specialties ?? [],
    vehicleTypes: initial?.vehicleTypes ?? ['car'],
    mobileService: initial?.mobileService ?? true,
    hasTowTruck: initial?.hasTowTruck ?? false,
    openingHours: initial?.openingHours ?? '',
    location: initial?.location ?? null,
    area: initial?.area ?? '',
    city: initial?.city ?? 'Douala',
    address: initial?.address ?? '',
    serviceRadiusKm: initial?.serviceRadiusKm ?? 15,
    corridors: initial?.corridors ?? [],
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof TechnicianFormValues>(key: K, value: TechnicianFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const toInput = (): TechnicianInput => ({
    businessName: values.businessName,
    ownerName: values.ownerName,
    bio: values.bio,
    phone: values.phone,
    whatsapp: values.whatsapp,
    yearsExperience: values.yearsExperience.trim() ? Number(values.yearsExperience) : null,
    specialties: values.specialties,
    vehicleTypes: values.vehicleTypes,
    mobileService: values.mobileService,
    hasTowTruck: values.hasTowTruck,
    openingHours: values.openingHours,
    location: values.location ?? { lat: Number.NaN, lng: Number.NaN },
    area: values.area,
    city: values.city,
    address: values.address,
    serviceRadiusKm: values.serviceRadiusKm,
    corridors: values.corridors,
  });

  /** Validate some or all fields; returns true when they are valid. */
  const validate = (fields?: (keyof TechnicianFormValues)[]) => {
    const result = technicianInputSchema.safeParse(toInput());
    const all = result.success ? {} : fieldErrors(result.error);
    const relevant = Object.fromEntries(
      Object.entries(all).filter(([k]) => !fields || fields.some((f) => k === f || k.startsWith(`${f}.`))),
    );
    setErrors(relevant);
    return Object.keys(relevant).length === 0;
  };

  return { values, set, errors, validate, toInput };
}

type Form = ReturnType<typeof useTechnicianForm>;

function useErr(form: Form) {
  const { t } = useI18n();
  return (key: string) => {
    const code = form.errors[key] ?? Object.entries(form.errors).find(([k]) => k.startsWith(`${key}.`))?.[1];
    return code ? t(`errors.${code}` as MessageKey) : null;
  };
}

export const BUSINESS_FIELDS: (keyof TechnicianFormValues)[] = ['businessName', 'ownerName', 'phone', 'whatsapp', 'yearsExperience', 'bio'];
export const SERVICE_FIELDS: (keyof TechnicianFormValues)[] = ['specialties', 'vehicleTypes', 'openingHours'];
export const ZONE_FIELDS: (keyof TechnicianFormValues)[] = ['location', 'area', 'city', 'address', 'serviceRadiusKm', 'corridors'];

export function BusinessFields({ form }: { form: Form }) {
  const { t } = useI18n();
  const err = useErr(form);
  const { values, set } = form;
  return (
    <div className="space-y-4">
      <Field label={t('onboarding.businessName')} error={err('businessName')}>
        {(p) => <Input {...p} value={values.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder={t('onboarding.businessNamePlaceholder')} maxLength={80} />}
      </Field>
      <Field label={t('onboarding.ownerName')} error={err('ownerName')}>
        {(p) => <Input {...p} autoComplete="name" value={values.ownerName} onChange={(e) => set('ownerName', e.target.value)} maxLength={80} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('onboarding.phone')} error={err('phone')}>
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)} placeholder="6 99 12 34 56" />}
        </Field>
        <Field label={t('onboarding.whatsapp')} hint={t('onboarding.whatsappHelp')} error={err('whatsapp')}>
          {(p) => <Input {...p} type="tel" inputMode="tel" value={values.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />}
        </Field>
      </div>
      <Field label={t('onboarding.years')} optional={t('common.optional')} error={err('yearsExperience')}>
        {(p) => (
          <Input {...p} inputMode="numeric" className="tabular w-28" value={values.yearsExperience} onChange={(e) => set('yearsExperience', e.target.value.replace(/[^\d]/g, '').slice(0, 2))} />
        )}
      </Field>
      <Field label={t('onboarding.bio')} optional={t('common.optional')} error={err('bio')}>
        {(p) => <Textarea {...p} value={values.bio} onChange={(e) => set('bio', e.target.value)} placeholder={t('onboarding.bioPlaceholder')} maxLength={500} />}
      </Field>
    </div>
  );
}

export function ServicesFields({ form }: { form: Form }) {
  const { t } = useI18n();
  const err = useErr(form);
  const { values, set } = form;
  const toggle = <T extends string>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2.5 text-sm font-medium text-ink-2">{t('onboarding.specialties')}</legend>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => (
            <Chip key={s} pressed={values.specialties.includes(s)} onClick={() => set('specialties', toggle(values.specialties, s))}>
              {t(`specialties.${s}`)}
            </Chip>
          ))}
        </div>
        {err('specialties') && <p className="mt-2 text-[13px] text-danger-soft">{err('specialties')}</p>}
      </fieldset>
      <fieldset>
        <legend className="mb-2.5 text-sm font-medium text-ink-2">{t('onboarding.vehicleTypes')}</legend>
        <div className="flex flex-wrap gap-2">
          {VEHICLE_TYPES.map((v) => (
            <Chip key={v} pressed={values.vehicleTypes.includes(v)} onClick={() => set('vehicleTypes', toggle(values.vehicleTypes, v))}>
              {t(`vehicleTypes.${v}`)}
            </Chip>
          ))}
        </div>
        {err('vehicleTypes') && <p className="mt-2 text-[13px] text-danger-soft">{err('vehicleTypes')}</p>}
      </fieldset>
      <div className="divide-y divide-line rounded-lg border border-line px-4">
        <Switch checked={values.mobileService} onChange={(v) => set('mobileService', v)} label={t('onboarding.mobile')} />
        <Switch checked={values.hasTowTruck} onChange={(v) => set('hasTowTruck', v)} label={t('onboarding.towTruck')} />
      </div>
      <Field label={t('onboarding.hours')} optional={t('common.optional')} error={err('openingHours')}>
        {(p) => <Input {...p} value={values.openingHours} onChange={(e) => set('openingHours', e.target.value)} placeholder={t('onboarding.hoursPlaceholder')} maxLength={120} />}
      </Field>
    </div>
  );
}

export function ZoneFields({ form }: { form: Form }) {
  const { t } = useI18n();
  const err = useErr(form);
  const { values, set } = form;
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const applyPoint = (p: GeoPoint, name?: string, city?: string) => {
    const ctx = describeLocation(p);
    set('location', { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 });
    set('area', name ?? ctx.label);
    set('city', city ?? (ctx.inDouala ? 'Douala' : ctx.city || values.city));
    if (ctx.corridor && !values.corridors.includes(ctx.corridor)) set('corridors', [...values.corridors, ctx.corridor]);
  };

  const useGps = () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        applyPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setGpsError(t('location.deniedHelp'));
      },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-2">{t('onboarding.location')}</p>
        <div className="rounded-lg border border-line bg-surface-1 p-4">
          <p className="flex items-center gap-2 text-[15px] text-ink">
            <MapPin className="size-4 text-gold" aria-hidden="true" />
            {values.location ? `${values.area || '—'}, ${values.city}` : t('location.unavailable')}
          </p>
          {values.location && (
            <p className="tabular mt-0.5 text-xs text-ink-3">
              {values.location.lat.toFixed(5)}, {values.location.lng.toFixed(5)}
            </p>
          )}
          <p className="mt-2 text-[13px] text-ink-3">{t('onboarding.locationHelp')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={<LocateFixed className="size-4 text-gold" />} loading={locating} onClick={useGps}>
              {t('onboarding.useGps')}
            </Button>
            <div className="w-52">
              <Select
                aria-label={t('location.chooseArea')}
                value=""
                onChange={(e) => {
                  const place = ALL_PLACES.find((p) => p.name === e.target.value);
                  if (place) applyPoint(place, place.name, place.city);
                }}
                className="h-9 text-sm"
              >
                <option value="">{t('location.chooseArea')}</option>
                {[
                  { label: t('location.douala'), places: DOUALA_QUARTERS },
                  { label: t('location.roads'), places: CORRIDOR_TOWNS },
                ].map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.places.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
          </div>
          {(gpsError || err('location')) && <p className="mt-2 text-[13px] text-danger-soft">{gpsError ?? t('errors.required')}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('onboarding.area')} error={err('area')}>
          {(p) => <Input {...p} value={values.area} onChange={(e) => set('area', e.target.value)} maxLength={60} />}
        </Field>
        <Field label={t('onboarding.city')} error={err('city')}>
          {(p) => <Input {...p} value={values.city} onChange={(e) => set('city', e.target.value)} maxLength={60} />}
        </Field>
      </div>
      <Field label={t('onboarding.address')} optional={t('common.optional')} error={err('address')}>
        {(p) => <Input {...p} value={values.address} onChange={(e) => set('address', e.target.value)} placeholder={t('onboarding.addressPlaceholder')} maxLength={200} />}
      </Field>
      <div>
        <label htmlFor="radius" className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink-2">
          {t('onboarding.radius')}
          <span className="tabular text-[15px] text-ink">{values.serviceRadiusKm} km</span>
        </label>
        <input
          id="radius"
          type="range"
          min={1}
          max={150}
          step={1}
          value={values.serviceRadiusKm}
          onChange={(e) => set('serviceRadiusKm', Number(e.target.value))}
          className="w-full accent-[var(--color-gold)]"
        />
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink-2">{t('onboarding.corridors')}</legend>
        <p className="mb-2.5 text-[13px] text-ink-3">{t('onboarding.corridorsHelp')}</p>
        <div className="flex flex-wrap gap-2">
          {CORRIDOR_IDS.map((c) => (
            <Chip
              key={c}
              pressed={values.corridors.includes(c)}
              onClick={() => set('corridors', values.corridors.includes(c) ? values.corridors.filter((x) => x !== c) : [...values.corridors, c])}
            >
              {t(`corridors.${c}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
