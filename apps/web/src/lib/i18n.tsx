'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createTranslator, STORAGE_KEYS, type Locale, type Translator } from '@onyx/core';
import { LOCALE_COOKIE } from './config';
import { safeStorage } from './storage';

interface I18nValue extends Translator {
  setLocale(locale: Locale): void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    // Pages share the root title; later navigations get it from the server in the new language.
    document.title = createTranslator(next).t('common.metaTitle');
    void safeStorage.setItem(STORAGE_KEYS.locale, next);
  }, []);

  const value = useMemo<I18nValue>(() => ({ ...createTranslator(locale), setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
