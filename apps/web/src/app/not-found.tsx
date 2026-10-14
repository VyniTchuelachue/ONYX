import Link from 'next/link';
import { createTranslator } from '@onyx/core';
import { getRequestLocale } from '@/lib/locale-server';
import { Emblem } from '@/components/brand';
import { buttonClass } from '@/components/ui/button';

export default async function NotFound() {
  const { t } = createTranslator(await getRequestLocale());
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Emblem size={64} className="mx-auto" />
        <h1 className="mt-6 font-display text-[30px] text-ink">{t('errors.pageNotFound')}</h1>
        <p className="mx-auto mt-3 max-w-sm text-[16px] text-ink-2">{t('errors.pageNotFoundBody')}</p>
        <Link href="/" className={buttonClass('primary', 'lg', 'mt-8')}>
          {t('errors.goHome')}
        </Link>
      </div>
    </main>
  );
}
