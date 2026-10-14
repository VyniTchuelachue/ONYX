import { z } from 'zod';
import {
  AVAILABILITY_STATUSES,
  CORRIDOR_IDS,
  DOCUMENT_KINDS,
  ISSUE_CATEGORIES,
  LOCALES,
  PAYMENT_METHODS,
  QUOTE_ITEM_KINDS,
  REVIEW_TAGS,
  SPECIALTIES,
  URGENCY_LEVELS,
  VEHICLE_TYPES,
  VERIFICATION_STATUSES,
} from './constants';
import { isCameroonPhone, normalizePhone } from './domain/phone';

/**
 * Input validation shared by every client. The database re-validates everything
 * (CHECK constraints and RPC guards); these schemas exist to give users fast, precise feedback.
 * Error messages are i18n keys under `errors.*`.
 */

const trimmed = (min: number, max: number) =>
  z
    .string()
    .trim()
    // An empty field is "required", not "too short".
    .min(min, { error: (issue) => (min <= 1 || issue.input === '' ? 'required' : 'too_short') })
    .max(max, { message: 'too_long' });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: 'too_long' })
    .transform((v) => (v.length ? v : null))
    .nullable()
    .optional();

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'invalid_phone' });
      return z.NEVER;
    }
    return n;
  });

export const cameroonPhoneSchema = phoneSchema.refine(isCameroonPhone, { message: 'invalid_cm_phone' });

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const vehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  make: optionalText(40),
  model: optionalText(40),
  year: z.number().int().min(1950).max(2100).nullable().optional(),
  plate: optionalText(16),
  color: optionalText(30),
});

export const createRequestSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  description: z.string().trim().max(1000, { message: 'too_long' }),
  urgency: z.enum(URGENCY_LEVELS),
  aiSummary: z.string().trim().max(2000).nullable().optional(),
  vehicle: vehicleSchema,
  location: geoPointSchema,
  landmark: trimmed(3, 200),
  contactName: trimmed(2, 80),
  contactPhone: phoneSchema,
  requestedTechnicianId: z.uuid().nullable().optional(),
});
export type CreateRequestInput = z.input<typeof createRequestSchema>;
export type CreateRequestData = z.output<typeof createRequestSchema>;

export const quoteItemSchema = z.object({
  label: trimmed(1, 80),
  kind: z.enum(QUOTE_ITEM_KINDS),
  quantity: z.number().int().min(1).max(100),
  unitPrice: z.number().int().min(0).max(5_000_000),
});

export const quoteInputSchema = z.object({
  items: z.array(quoteItemSchema).min(1, { message: 'quote_empty' }).max(20),
  note: optionalText(500),
});
export type QuoteInput = z.input<typeof quoteInputSchema>;

export const completeInputSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().int().min(0).max(10_000_000),
});
export type CompleteInput = z.input<typeof completeInputSchema>;

export const reviewInputSchema = z.object({
  requestId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: optionalText(1000),
  tags: z.array(z.enum(REVIEW_TAGS)).max(REVIEW_TAGS.length).default([]),
});
export type ReviewInput = z.input<typeof reviewInputSchema>;

export const technicianInputSchema = z.object({
  businessName: trimmed(2, 80),
  ownerName: trimmed(2, 80),
  bio: optionalText(500),
  phone: cameroonPhoneSchema,
  whatsapp: z
    .union([cameroonPhoneSchema, z.literal('').transform(() => null)])
    .nullable()
    .optional(),
  specialties: z.array(z.enum(SPECIALTIES)).min(1, { message: 'pick_one' }).max(SPECIALTIES.length),
  vehicleTypes: z.array(z.enum(VEHICLE_TYPES)).min(1, { message: 'pick_one' }).max(VEHICLE_TYPES.length),
  location: geoPointSchema,
  address: optionalText(200),
  area: trimmed(2, 60),
  city: trimmed(2, 60),
  corridors: z.array(z.enum(CORRIDOR_IDS)).max(CORRIDOR_IDS.length).default([]),
  serviceRadiusKm: z.number().int().min(1).max(300),
  mobileService: z.boolean(),
  hasTowTruck: z.boolean(),
  openingHours: optionalText(120),
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
});
export type TechnicianInput = z.input<typeof technicianInputSchema>;
export type TechnicianData = z.output<typeof technicianInputSchema>;

export const profilePatchSchema = z.object({
  fullName: trimmed(2, 80).optional(),
  phone: phoneSchema.nullable().optional(),
  locale: z.enum(LOCALES).optional(),
  defaultVehicle: vehicleSchema.nullable().optional(),
});
export type ProfilePatch = z.input<typeof profilePatchSchema>;

// Phone keyboards often add a space after an address: trim before checking it.
const emailSchema = z.string().trim().pipe(z.email({ message: 'invalid_email' }));

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'required' }),
});
export type SignInInput = z.input<typeof signInSchema>;

export const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, { message: 'password_too_short' }).max(72),
  fullName: trimmed(2, 80),
  phone: phoneSchema.nullable().optional(),
  intent: z.enum(['driver', 'technician']),
  locale: z.enum(LOCALES),
});
export type SignUpInput = z.input<typeof signUpSchema>;

/** A Web Push subscription as the browser reports it (PushSubscription.toJSON()). */
export const pushDeviceSchema = z.object({
  endpoint: z.url({ protocol: /^https$/, message: 'invalid' }).max(1000),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
});
export type PushDevice = z.input<typeof pushDeviceSchema>;

export const signUpCodeSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^[0-9]{6,10}$/, { message: 'invalid_code' }),
});

export const passwordResetSchema = z.object({
  email: emailSchema,
});

export const newPasswordSchema = z.object({
  password: z.string().min(8, { message: 'password_too_short' }).max(72, { message: 'too_long' }),
});

export const verificationInputSchema = z.object({
  status: z.enum(VERIFICATION_STATUSES),
  note: optionalText(500),
});

export const availabilitySchema = z.enum(AVAILABILITY_STATUSES);
export const documentKindSchema = z.enum(DOCUMENT_KINDS);

/** First validation error as an i18n key, for forms that show one message per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = typeof issue.message === 'string' && /^[a-z_]+$/.test(issue.message) ? issue.message : 'invalid';
  }
  return out;
}
