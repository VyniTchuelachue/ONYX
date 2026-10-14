import { isBackendError } from '@onyx/core/backend';
import type { MessageKey, Translator } from '@onyx/core';

/** A translated, actionable message for any error the backend can throw. */
export function errorMessage(t: Translator['t'], error: unknown): string {
  if (isBackendError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        return t('auth.invalidCredentials');
      case 'email_taken':
        return t('auth.emailTaken');
      case 'unknown':
        return t('errors.generic');
      default:
        return t(`errors.${error.code}` as MessageKey);
    }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return t('errors.network');
  return t('errors.generic');
}

/** Field-level messages from a BackendError('validation'), keyed by field path. */
export function fieldMessages(t: Translator['t'], error: unknown): Record<string, string> {
  if (!isBackendError(error) || !error.fields) return {};
  return Object.fromEntries(
    Object.entries(error.fields).map(([field, key]) => [field, t(`errors.${key}` as MessageKey)]),
  );
}
