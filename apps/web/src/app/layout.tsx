import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { createTranslator } from '@onyx/core';
import { getRequestLocale } from '@/lib/locale-server';
import { config } from '@/lib/config';
import { Providers } from './providers';
import './globals.css';

// One family, two voices: Archivo's width axis gives the wide display cut that echoes
// the ONYX wordmark, and the normal width stays highly legible for body text.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = createTranslator(await getRequestLocale());
  return {
    ...(config.siteUrl ? { metadataBase: new URL(config.siteUrl) } : {}),
    title: {
      default: t('common.metaTitle'),
      template: '%s — ONYX',
    },
    description: t('common.metaDescription'),
    applicationName: 'ONYX',
    appleWebApp: { capable: true, title: 'ONYX', statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
    openGraph: {
      title: 'ONYX',
      description: t('common.tagline'),
      type: 'website',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale} className={archivo.variable}>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
