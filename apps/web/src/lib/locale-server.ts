import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@onyx/core';
import { LOCALE_COOKIE } from './config';

/** The visitor's language: saved choice first, then the browser's preference, then French. */
export async function getRequestLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  const accept = (await headers()).get('accept-language') ?? '';
  for (const part of accept.split(',')) {
    const lang = part.trim().slice(0, 2).toLowerCase();
    if ((LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  }
  return DEFAULT_LOCALE;
}
