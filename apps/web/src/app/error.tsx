'use client';

import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { Emblem } from '@/components/brand';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div>
        <Emblem size={56} className="mx-auto" />
        <h1 className="mt-6 font-display text-[28px] text-ink">{t('errors.crashed')}</h1>
        <p className="mx-auto mt-3 max-w-sm text-[16px] text-ink-2">{t('errors.crashedBody')}</p>
        <Button size="lg" className="mt-8" onClick={reset}>
          {t('common.retry')}
        </Button>
      </div>
    </main>
  );
}
