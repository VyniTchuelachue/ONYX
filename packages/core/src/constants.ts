/**
 * Enumerations and platform constants.
 *
 * Every list here is mirrored by a Postgres enum or CHECK constraint in
 * `supabase/migrations`. Change both together.
 */

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export const USER_ROLES = ['driver', 'technician', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SPECIALTIES = [
  'mechanic',
  'electrical',
  'tires',
  'towing',
  'battery',
  'diagnostics',
  'ac',
  'bodywork',
] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export const VEHICLE_TYPES = ['car', 'motorcycle', 'truck', 'bus'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** What the driver experiences. Ordered by how often drivers report them. */
export const ISSUE_CATEGORIES = [
  'wont_start',
  'flat_tire',
  'battery',
  'overheating',
  'engine',
  'brakes',
  'electrical',
  'fuel',
  'clutch_gearbox',
  'warning_light',
  'smoke_fire',
  'accident',
  'other',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/** The kind of technician best placed to handle each issue. */
export const CATEGORY_SPECIALTY: Record<IssueCategory, Specialty> = {
  wont_start: 'mechanic',
  flat_tire: 'tires',
  battery: 'battery',
  overheating: 'mechanic',
  engine: 'mechanic',
  brakes: 'mechanic',
  electrical: 'electrical',
  fuel: 'mechanic',
  clutch_gearbox: 'mechanic',
  warning_light: 'diagnostics',
  smoke_fire: 'towing',
  accident: 'towing',
  other: 'mechanic',
};

export const URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const CAN_DRIVE = ['yes', 'caution', 'no', 'unknown'] as const;
export type CanDrive = (typeof CAN_DRIVE)[number];

export const REQUEST_STATUSES = [
  'pending',
  'accepted',
  'en_route',
  'arrived',
  'quoted',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const AVAILABILITY_STATUSES = ['available', 'busy', 'offline'] as const;
export type Availability = (typeof AVAILABILITY_STATUSES)[number];

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'suspended'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const QUOTE_STATUSES = ['pending', 'accepted', 'declined', 'superseded'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_ITEM_KINDS = ['part', 'labour', 'travel'] as const;
export type QuoteItemKind = (typeof QUOTE_ITEM_KINDS)[number];

export const PAYMENT_METHODS = ['cash', 'mtn_momo', 'orange_money'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REVIEW_TAGS = [
  'punctual',
  'fair_price',
  'professional',
  'clear_explanation',
  'quality_work',
] as const;
export type ReviewTag = (typeof REVIEW_TAGS)[number];

export const DOCUMENT_KINDS = ['id_card', 'business_license', 'garage_photo', 'certificate'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const CORRIDOR_IDS = ['douala-yaounde', 'douala-bafoussam', 'douala-limbe', 'douala-kribi'] as const;
export type CorridorId = (typeof CORRIDOR_IDS)[number];

/** Cameroon emergency services (verified numbers). */
export const EMERGENCY_NUMBERS = [
  { id: 'fire', number: '118' },
  { id: 'ambulance', number: '119' },
  { id: 'police', number: '117' },
] as const;
export type EmergencyServiceId = (typeof EMERGENCY_NUMBERS)[number]['id'];

/** Share of each paid job kept by ONYX. Mirrors `public.platform_commission_rate()`. */
export const COMMISSION_RATE = 0.1;
export const CURRENCY = 'XAF';

/** A technician marked "available" who hasn't opened the app for this long is shown as unconfirmed. */
export const AVAILABILITY_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export const SEARCH_RADII_KM = [5, 15, 30, 60, 150] as const;
export const DEFAULT_SEARCH_RADIUS_KM = 15;
/** Radius of the technician snapshot kept on the device for offline use. Covers the four corridors. */
export const OFFLINE_PACK_RADIUS_KM = 320;

/** A driver may keep this many requests open at once (anti-abuse). Mirrors SQL. */
export const MAX_ACTIVE_REQUESTS_PER_DRIVER = 2;

export const DOUALA_CENTER = { lat: 4.04294, lng: 9.7062 } as const;
