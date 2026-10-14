import { COMMISSION_RATE, type Locale } from '../constants';
import type { QuoteItem } from '../types';

/** "15 000 FCFA" in French, "15,000 FCFA" in English. Amounts are whole francs. */
export function formatXAF(amount: number, locale: Locale): string {
  const n = Math.round(amount);
  const formatted = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    maximumFractionDigits: 0,
  })
    .format(n)
    // Intl uses narrow no-break spaces in fr; keep them non-breaking but plain for fonts that lack U+202F.
    .replace(/ /g, ' ');
  return `${formatted} FCFA`;
}

export function quoteItemTotal(item: QuoteItem): number {
  return Math.round(item.quantity) * Math.round(item.unitPrice);
}

export function quoteTotal(items: QuoteItem[]): number {
  return items.reduce((sum, item) => sum + quoteItemTotal(item), 0);
}

export function commissionFor(amount: number, rate = COMMISSION_RATE): number {
  return Math.round(amount * rate);
}
