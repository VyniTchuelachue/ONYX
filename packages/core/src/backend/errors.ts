export const BACKEND_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'not_found',
  'invalid_transition',
  'conflict',
  'validation',
  'limit_reached',
  'rate_limited',
  'invalid_credentials',
  'email_taken',
  'email_not_confirmed',
  'network',
  'unknown',
] as const;
export type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[number];

/** Every backend failure surfaces as this, so the UI can map `code` to a translated message. */
export class BackendError extends Error {
  readonly code: BackendErrorCode;
  readonly fields?: Record<string, string>;

  constructor(code: BackendErrorCode, message?: string, fields?: Record<string, string>) {
    super(message ?? code);
    this.name = 'BackendError';
    this.code = code;
    this.fields = fields;
  }
}

export function isBackendError(e: unknown): e is BackendError {
  return e instanceof BackendError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'BackendError');
}

/** SQL functions raise `ONYX:<code>`; turn that (or any other failure) into a BackendError. */
export function toBackendError(e: unknown): BackendError {
  if (isBackendError(e)) return e;
  const message =
    typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const tagged = /ONYX:([a-z_]+)/.exec(message);
  if (tagged && (BACKEND_ERROR_CODES as readonly string[]).includes(tagged[1]!)) {
    return new BackendError(tagged[1] as BackendErrorCode, message);
  }
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code === '23514' || code === '22P02' || code === '23502') return new BackendError('validation', message);
  if (code === '42501' || /permission denied|row-level security/i.test(message)) return new BackendError('forbidden', message);
  if (code === 'PGRST301' || /JWT/i.test(message)) return new BackendError('unauthenticated', message);
  if (/Failed to fetch|NetworkError|network|fetch failed|ECONNREFUSED/i.test(message)) return new BackendError('network', message);
  return new BackendError('unknown', message);
}
