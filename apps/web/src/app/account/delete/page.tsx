import type { Metadata } from 'next';
import { createTranslator } from '@onyx/core';
import { getRequestLocale } from '@/lib/locale-server';
import { DeleteAccountPage } from './view';

// Public page: Google Play asks for a web address where people can delete their account.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = createTranslator(await getRequestLocale());
  return { title: t('account.pageTitle') };
}

export default function Page() {
  return <DeleteAccountPage />;
}
