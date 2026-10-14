import type { Locale } from '../constants';

const tag = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'en-GB');
const DOUALA_TZ = 'Africa/Douala';

/** "il y a 5 min", "5 min ago", "à l'instant". */
export function relativeTime(iso: string, locale: Locale, now: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return locale === 'fr' ? "à l'instant" : 'just now';
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: 'auto', style: 'short' });
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  return formatDate(iso, locale);
}

export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { hour: '2-digit', minute: '2-digit', timeZone: DOUALA_TZ }).format(
    new Date(iso),
  );
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'short', timeZone: DOUALA_TZ }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DOUALA_TZ,
  }).format(new Date(iso));
}

/** YYYY-MM-DD for a timestamp, in Douala time (UTC+1, no DST). */
export function doualaDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}
