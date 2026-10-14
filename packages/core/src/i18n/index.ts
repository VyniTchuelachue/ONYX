import type { Locale } from '../constants';
import { en } from './en';
import { fr } from './fr';
import type { Dictionary, ListKey, MessageKey, PluralKey, Vars } from './types';

export type { Dictionary, ListKey, MessageKey, PluralKey, Vars } from './types';

export const dictionaries: Record<Locale, Dictionary> = { fr, en };

export interface Translator {
  locale: Locale;
  /** Translate a key, replacing `{placeholders}`. */
  t(key: MessageKey, vars?: Vars): string;
  /** Pick the plural form for `count` (exposed to the template as `{count}`). */
  tp(key: PluralKey, count: number, vars?: Vars): string;
  /** A list of strings (checklists, reasons). */
  ta(key: ListKey): string[];
}

function lookup(dict: unknown, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return node;
}

/**
 * Typographic polish applied to dictionary text (never to user data): curly apostrophes,
 * and in French a non-breaking space before tall punctuation and inside guillemets.
 */
function typography(s: string, locale: Locale): string {
  const curly = s.replace(/'/g, '’');
  return locale === 'fr' ? curly.replace(/ ([?!;:»])/g, ' $1').replace(/« /g, '« ') : curly;
}

const STARTS_WITH_VOWEL = /^[aeiouyhàâäéèêëîïôöùûü]/i;

function format(template: string, vars: Vars | undefined, locale: Locale): string {
  const base = typography(template, locale);
  if (!vars) return base;
  const nf = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US');
  // In French, "de" before a vowel elides: "Près de {place}" + "Akwa" → "Près d’Akwa".
  return base.replace(/(\b[dD]e )?\{(\w+)\}/g, (match, de: string | undefined, name: string) => {
    const raw = vars[name];
    if (raw === undefined || raw === null) return match;
    const value = typeof raw === 'number' ? nf.format(raw).replace(/ /g, ' ') : raw;
    if (de && locale === 'fr' && STARTS_WITH_VOWEL.test(value)) return `${de[0]}’${value}`;
    return `${de ?? ''}${value}`;
  });
}

/** The same typographic polish for long-form text kept outside the dictionaries (legal pages). */
export function polishText(text: string, locale: Locale): string {
  return typography(text, locale);
}

export function createTranslator(locale: Locale): Translator {
  const dict = dictionaries[locale];
  const plural = new Intl.PluralRules(locale === 'fr' ? 'fr-FR' : 'en-US');

  const resolve = (key: string): unknown => lookup(dict, key) ?? lookup(fr, key);

  return {
    locale,
    t(key, vars) {
      const value = resolve(key);
      return typeof value === 'string' ? format(value, vars, locale) : key;
    },
    tp(key, count, vars) {
      const node = resolve(key) as Record<string, string> | undefined;
      const form = node?.[plural.select(count)] ?? node?.other;
      return typeof form === 'string' ? format(form, { count, ...vars }, locale) : key;
    },
    ta(key) {
      const value = resolve(key);
      return Array.isArray(value) ? value.map((v) => typography(String(v), locale)) : [];
    },
  };
}
