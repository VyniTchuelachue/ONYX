import { z } from 'zod';
import { CAN_DRIVE, ISSUE_CATEGORIES, SPECIALTIES, URGENCY_LEVELS } from '../constants';

/**
 * One assistant turn. Produced either by the AI (structured output) or by the offline
 * rule engine — the UI renders both the same way.
 */
export const assistantTurnSchema = z.object({
  /** Short conversational answer, 1–3 sentences, in the driver's language. */
  reply: z.string(),
  urgency: z.enum(URGENCY_LEVELS),
  category: z.enum(ISSUE_CATEGORIES),
  /** Technician specialty to look for. */
  specialty: z.enum(SPECIALTIES),
  canDrive: z.enum(CAN_DRIVE),
  /** True when someone should call fire/ambulance/police now. */
  callEmergency: z.boolean(),
  /** Immediate safety actions, most important first. */
  safety: z.array(z.string()),
  /** Checks a non-mechanic can do safely, in order. */
  checks: z.array(z.object({ title: z.string(), detail: z.string() })),
  likelyCauses: z.array(z.string()),
  needsProfessional: z.boolean(),
  /** One clarifying question when the description is too vague, otherwise null. */
  followUpQuestion: z.string().nullable(),
  /** Short replies the driver can tap. */
  quickReplies: z.array(z.string()),
  /** Two or three factual sentences for the technician who takes the job. */
  technicianSummary: z.string(),
});
export type AssistantTurn = z.infer<typeof assistantTurnSchema>;

export type AssistantSource = 'ai' | 'rules';

export type ChatMessage =
  | { id: string; role: 'user'; text: string; at: string }
  | { id: string; role: 'assistant'; turn: AssistantTurn; source: AssistantSource; at: string };

/** Body of `POST /api/v1/assistant`. */
export const assistantRequestSchema = z.object({
  locale: z.enum(['fr', 'en']),
  messages: z
    .array(
      z.union([
        z.object({ role: z.literal('user'), text: z.string().trim().min(1).max(2000) }),
        z.object({ role: z.literal('assistant'), turn: assistantTurnSchema }),
      ]),
    )
    .min(1)
    .max(24),
  context: z
    .object({
      placeLabel: z.string().max(120).nullable().optional(),
      corridor: z.string().max(40).nullable().optional(),
      localTime: z.string().max(40).nullable().optional(),
      vehicle: z.string().max(120).nullable().optional(),
    })
    .optional(),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export interface AssistantResponse {
  source: AssistantSource;
  turn: AssistantTurn;
}
