/**
 * @onyx/core — everything about ONYX that isn't tied to a screen:
 * domain types and rules, validation, translations, offline triage and offline data.
 *
 * Backends live in subpath exports so apps only bundle what they use:
 *   @onyx/core/backend   the OnyxBackend contract + errors
 *   @onyx/core/supabase  production adapter
 *   @onyx/core/demo      on-device demo adapter
 */
export * from './constants';
export * from './types';
export * from './schemas';
export * from './offline';
export * from './notifications';
export * from './backend/storage';

export * from './domain/availability';
export * from './domain/codes';
export * from './domain/geo';
export * from './domain/money';
export * from './domain/phone';
export * from './domain/places';
export * from './domain/status';
export * from './domain/time';

export * from './i18n';

export * from './triage/types';
export * from './triage/engine';
export { TRIAGE_RULES } from './triage/rules';
