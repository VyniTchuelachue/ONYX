import type { Metadata } from 'next';
import { createTranslator } from '@onyx/core';
import { getRequestLocale } from '@/lib/locale-server';
import { PrivacyPolicy } from '@/components/legal/privacy-policy';

// Public page: the app stores link to it from ONYX's listing.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = createTranslator(await getRequestLocale());
  return { title: t('account.privacy') };
}

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}
