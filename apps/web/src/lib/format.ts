'use client';

import { useMemo } from 'react';
import {
  estimateEtaMinutes,
  formatDate,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatPhone,
  formatTime,
  formatXAF,
  relativeTime,
} from '@onyx/core';
import { useI18n } from './i18n';

/** Locale-bound formatters, so components never pass the locale around. */
export function useFormat() {
  const { locale } = useI18n();
  return useMemo(
    () => ({
      distance: (km: number) => formatDistance(km, locale),
      duration: (minutes: number) => formatDuration(minutes, locale),
      eta: (km: number) => formatDuration(estimateEtaMinutes(km), locale),
      money: (amount: number) => formatXAF(amount, locale),
      ago: (iso: string) => relativeTime(iso, locale),
      time: (iso: string) => formatTime(iso, locale),
      date: (iso: string) => formatDate(iso, locale),
      dateTime: (iso: string) => formatDateTime(iso, locale),
      phone: formatPhone,
      percent: (ratio: number) =>
        new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'percent', maximumFractionDigits: 0 }).format(ratio),
      number: (n: number, digits = 0) =>
        new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: digits }).format(n),
    }),
    [locale],
  );
}
