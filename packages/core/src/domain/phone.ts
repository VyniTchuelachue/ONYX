/**
 * Phone helpers. Numbers are stored in E.164. Technicians must have a Cameroonian number;
 * drivers may have any valid international number (visitors, diaspora).
 */

const CM_NATIONAL = /^[26]\d{8}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/** Normalise user input to E.164, assuming Cameroon when no country code is given. Returns null if invalid. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+') || trimmed.startsWith('00');
  let digits = trimmed.replace(/[^\d]/g, '');
  if (trimmed.startsWith('00')) digits = digits.slice(2);
  if (!hasPlus) {
    if (CM_NATIONAL.test(digits)) return `+237${digits}`;
    if (digits.startsWith('237') && CM_NATIONAL.test(digits.slice(3))) return `+${digits}`;
    return null;
  }
  const e164 = `+${digits}`;
  if (digits.startsWith('237')) return CM_NATIONAL.test(digits.slice(3)) ? e164 : null;
  return E164.test(e164) ? e164 : null;
}

export const isCameroonPhone = (e164: string) => /^\+237[26]\d{8}$/.test(e164);

/** "+237 6 99 12 34 56" — the way numbers are written locally. */
export function formatPhone(e164: string): string {
  if (isCameroonPhone(e164)) {
    const n = e164.slice(4);
    return `+237 ${n[0]} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
  }
  return e164;
}

export const telHref = (e164: string) => `tel:${e164}`;

export function smsHref(e164: string, body?: string): string {
  return body ? `sms:${e164}?body=${encodeURIComponent(body)}` : `sms:${e164}`;
}

export function whatsappHref(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/^\+/, '')}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
