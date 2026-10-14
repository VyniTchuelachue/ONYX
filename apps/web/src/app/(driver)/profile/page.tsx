'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowRight, Download, LogOut, RotateCcw, Shield, Wrench, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import type { Vehicle, VehicleType } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useBackend } from '@/lib/backend';
import { useFavorites, useOfflinePack } from '@/lib/offline-pack';
import { useInstallPrompt } from '@/lib/install-prompt';
import { useAction } from '@/lib/queries';
import { isDemo } from '@/lib/config';
import { forgetThisDevice } from '@/lib/alerts';
import { PageContainer, PageHeader, PageSkeleton } from '@/components/page';
import { LanguageToggle } from '@/components/shell/common';
import { AlertsCard } from '@/components/alerts/alerts-card';
import { DeleteAccount } from '@/components/account/delete-account';
import { Field, Input } from '@/components/ui/field';
import { Segmented } from '@/components/ui/choice';
import { Button, ButtonLink } from '@/components/ui/button';
import { Monogram, SectionTitle } from '@/components/ui/bits';

export default function ProfilePage() {
  const { t } = useI18n();
  const { status, session } = useSession();
  if (status === 'loading') return <PageSkeleton />;

  return (
    <PageContainer className="pb-10">
      <PageHeader title={t('profile.title')} />
      {session ? (
        <AccountSection />
      ) : (
        <section className="rounded-xl border border-line bg-surface-1 p-5">
          <p className="font-wide text-[17px] font-semibold text-ink">{t('profile.guestTitle')}</p>
          <p className="mt-1 text-[15px] text-ink-3">{t('profile.guestBody')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/auth/sign-in?next=/profile">{t('auth.signIn')}</ButtonLink>
            <ButtonLink href="/auth/sign-up?next=/profile" variant="secondary">
              {t('auth.signUp')}
            </ButtonLink>
          </div>
        </section>
      )}

      <section className="mt-8 flex items-center justify-between gap-4">
        <h2 className="font-wide text-[17px] font-semibold text-ink">{t('common.language')}</h2>
        <LanguageToggle />
      </section>

      {session && <AlertsCard className="mt-8" audience={session.profile.role === 'technician' ? 'technician' : 'driver'} />}
      {session && <VehicleSection />}
      <FavoritesSection />

      <section className="mt-8 space-y-2">
        <Link href="/offline" className="flex items-center gap-3.5 rounded-xl border border-line p-4 transition-colors hover:border-line-strong">
          <WifiOff className="size-5 text-gold" aria-hidden="true" />
          <span className="flex-1 text-[15px] text-ink">{t('offline.title')}</span>
          <ArrowRight className="size-4 text-ink-3" aria-hidden="true" />
        </Link>
        <InstallRow />
        <RoleLinks />
      </section>

      {isDemo && <DemoSection />}
      {session && <SignOut />}

      <footer className="mt-10 flex flex-col items-start gap-1 border-t border-line pt-6">
        <Link href="/privacy" className="px-1 py-2 text-[14px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          {t('account.privacy')}
        </Link>
        {session && <DeleteAccount className="-ml-3" />}
      </footer>
    </PageContainer>
  );
}

function AccountSection() {
  const { t } = useI18n();
  const { session, refresh } = useSession();
  const profile = session!.profile;
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const save = useAction((b, _: void) => b.auth.updateProfile({ fullName, phone: phone.trim() ? phone : null }), { success: t('profile.saved') });

  return (
    <section>
      <div className="mb-5 flex items-center gap-4">
        <Monogram name={profile.fullName || profile.email || '?'} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-wide text-[18px] font-semibold text-ink">{profile.fullName}</p>
          <p className="truncate text-[14px] text-ink-3">{session!.email}</p>
          <p className="text-[13px] text-gold">{t(`profile.role.${profile.role}`)}</p>
        </div>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: () => void refresh() });
        }}
      >
        <Field label={t('profile.fullName')}>{(p) => <Input {...p} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />}</Field>
        <Field label={t('profile.phone')}>
          {(p) => <Input {...p} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="6 99 12 34 56" />}
        </Field>
        <Button type="submit" loading={save.isPending} disabled={fullName === profile.fullName && phone === (profile.phone ?? '')}>
          {t('common.save')}
        </Button>
      </form>
    </section>
  );
}

function VehicleSection() {
  const { t } = useI18n();
  const { session, refresh } = useSession();
  const [vehicle, setVehicle] = useState<Vehicle>(session!.profile.defaultVehicle ?? { type: 'car' });
  const save = useAction((b, _: void) => b.auth.updateProfile({ defaultVehicle: vehicle }), { success: t('profile.saved') });
  return (
    <section className="mt-8">
      <SectionTitle>{t('profile.vehicleTitle')}</SectionTitle>
      <p className="-mt-1.5 mb-4 text-[14px] text-ink-3">{t('profile.vehicleHelp')}</p>
      <Segmented
        label={t('requestNew.vehicleType')}
        value={vehicle.type}
        onChange={(type: VehicleType) => setVehicle({ ...vehicle, type })}
        options={(['car', 'motorcycle', 'truck', 'bus'] as const).map((v) => ({ value: v, label: t(`vehicleTypes.${v}`) }))}
        size="sm"
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label={t('requestNew.make')}>{(p) => <Input {...p} value={vehicle.make ?? ''} onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })} placeholder={t('requestNew.makePlaceholder')} />}</Field>
        <Field label={t('requestNew.model')}>{(p) => <Input {...p} value={vehicle.model ?? ''} onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })} placeholder={t('requestNew.modelPlaceholder')} />}</Field>
        <Field label={t('requestNew.plate')}>
          {(p) => <Input {...p} value={vehicle.plate ?? ''} onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })} placeholder={t('requestNew.platePlaceholder')} />}
        </Field>
        <Field label={t('requestNew.color')}>{(p) => <Input {...p} value={vehicle.color ?? ''} onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })} placeholder={t('requestNew.colorPlaceholder')} />}</Field>
      </div>
      <Button className="mt-4" variant="secondary" loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => void refresh() })}>
        {t('common.save')}
      </Button>
    </section>
  );
}

function FavoritesSection() {
  const { t } = useI18n();
  const favorites = useFavorites();
  const pack = useOfflinePack();
  const backend = useBackend();
  const results = useQueries({
    queries: favorites.ids.slice(0, 12).map((id) => ({
      queryKey: ['directory', 'technician', id],
      queryFn: () => backend!.directory.get(id),
      enabled: !!backend,
      initialData: pack?.technicians.find((x) => x.id === id),
    })),
  });
  const list = results.map((r) => r.data).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <section className="mt-8">
      <SectionTitle>{t('profile.favorites')}</SectionTitle>
      {list.length === 0 ? (
        <p className="text-[14px] text-ink-3">{t('profile.favoritesEmpty')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((x) => (
            <li key={x.id}>
              <Link href={`/technicians/${x.id}`} className="flex items-center gap-3 py-3">
                <Monogram name={x.businessName} verified={x.verificationStatus === 'verified'} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{x.businessName}</span>
                  <span className="block text-[13px] text-ink-3">{x.area}</span>
                </span>
                <ArrowRight className="size-4 text-ink-3" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InstallRow() {
  const { t } = useI18n();
  const prompt = useInstallPrompt();
  if (prompt.installed) {
    return <p className="px-1 py-2 text-[14px] text-ink-3">{t('profile.installed')}</p>;
  }
  if (!prompt.canInstall) return null;
  return (
    <button
      type="button"
      onClick={() => void prompt.install()}
      className="flex w-full items-center gap-3.5 rounded-xl border border-gold/40 bg-gold/8 p-4 text-left transition-colors hover:bg-gold/12"
    >
      <Download className="size-5 text-gold" aria-hidden="true" />
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-ink">{t('profile.install')}</span>
        <span className="block text-[13px] text-ink-3">{t('profile.installHelp')}</span>
      </span>
    </button>
  );
}

function RoleLinks() {
  const { t } = useI18n();
  const { session } = useSession();
  const role = session?.profile.role;
  return (
    <>
      {role === 'technician' ? (
        <Link href="/pro" className="flex items-center gap-3.5 rounded-xl border border-line p-4 transition-colors hover:border-line-strong">
          <Wrench className="size-5 text-gold" aria-hidden="true" />
          <span className="flex-1 text-[15px] text-ink">{t('nav.proSpace')}</span>
          <ArrowRight className="size-4 text-ink-3" aria-hidden="true" />
        </Link>
      ) : role !== 'admin' ? (
        <Link
          href={session ? '/pro/onboarding' : '/auth/sign-up?intent=technician'}
          className="flex items-center gap-3.5 rounded-xl border border-line p-4 transition-colors hover:border-line-strong"
        >
          <Wrench className="size-5 text-gold" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-[15px] font-medium text-ink">{t('profile.becomePro')}</span>
            <span className="block text-[13px] text-ink-3">{t('profile.becomeProHelp')}</span>
          </span>
          <ArrowRight className="size-4 text-ink-3" aria-hidden="true" />
        </Link>
      ) : null}
      {role === 'admin' && (
        <Link href="/admin" className="flex items-center gap-3.5 rounded-xl border border-line p-4 transition-colors hover:border-line-strong">
          <Shield className="size-5 text-gold" aria-hidden="true" />
          <span className="flex-1 text-[15px] text-ink">{t('nav.adminSpace')}</span>
          <ArrowRight className="size-4 text-ink-3" aria-hidden="true" />
        </Link>
      )}
    </>
  );
}

function DemoSection() {
  const { t } = useI18n();
  const backend = useBackend();
  const { refresh } = useSession();
  return (
    <section className="mt-8 rounded-xl border border-violet/30 bg-violet/6 p-5">
      <p className="text-[14px] text-ink-2">{t('auth.demoNotice')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink href="/demo" variant="secondary" size="sm">
          {t('auth.demoTitle')}
        </ButtonLink>
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="size-4" aria-hidden="true" />}
          onClick={async () => {
            await backend?.auth.demo?.reset();
            await refresh();
            toast.success(t('auth.demoResetDone'));
          }}
        >
          {t('auth.demoReset')}
        </Button>
      </div>
    </section>
  );
}

function SignOut() {
  const { t } = useI18n();
  const backend = useBackend();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useEffect(() => () => setBusy(false), []);
  return (
    <Button
      className="mt-8"
      variant="ghost"
      icon={<LogOut className="size-4" aria-hidden="true" />}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        // Alerts belong to the account, not the phone: stop them before leaving.
        await forgetThisDevice(backend);
        await backend?.auth.signOut();
        toast(t('auth.signedOut'));
        router.push('/');
      }}
    >
      {t('profile.signOut')}
    </Button>
  );
}
