'use client';

import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { isDemo } from '@/lib/config';
import { homeFor } from '@/lib/redirects';
import { MinimalShell } from '@/components/shell/minimal-shell';
import { DemoRolePicker } from '@/components/demo-role-picker';
import { Button, ButtonLink } from '@/components/ui/button';

export default function DemoPage() {
  const { t } = useI18n();
  const router = useRouter();
  const backend = useBackend();

  return (
    <MinimalShell>
      <h1 className="font-display text-[30px] leading-tight text-ink">{t('auth.demoTitle')}</h1>
      {isDemo ? (
        <>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{t('auth.demoIntro')}</p>
          <DemoRolePicker className="mt-6" onDone={(role) => router.push(homeFor(role))} />
          <Button
            variant="ghost"
            className="mt-6"
            icon={<RotateCcw className="size-4" aria-hidden="true" />}
            onClick={async () => {
              await backend?.auth.demo?.reset();
              toast.success(t('auth.demoResetDone'));
            }}
          >
            {t('auth.demoReset')}
          </Button>
        </>
      ) : (
        <ButtonLink href="/" className="mt-6">
          {t('errors.goHome')}
        </ButtonLink>
      )}
    </MinimalShell>
  );
}
