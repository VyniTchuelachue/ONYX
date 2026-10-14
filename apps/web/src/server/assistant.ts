import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  assistantTurnSchema,
  triageOffline,
  type AssistantRequest,
  type AssistantResponse,
  type AssistantTurn,
} from '@onyx/core';
import { ASSISTANT_SYSTEM_PROMPT } from './assistant-prompt';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const EFFORT = (['low', 'medium', 'high'] as const).find((e) => e === process.env.ANTHROPIC_EFFORT) ?? 'low';

/** Server-side refusal fallback is offered on these models (not on Haiku). */
const SUPPORTS_FALLBACKS = /^claude-(opus-5|sonnet-5-5|fable-5)/.test(MODEL);

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ maxRetries: 1, timeout: 25_000 });
  return client;
}

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

function contextNote(req: AssistantRequest): string {
  const c = req.context;
  if (!c) return '';
  const parts = [
    c.placeLabel ? `location: ${c.placeLabel}` : null,
    c.corridor ? `road: ${c.corridor}` : null,
    c.localTime ? `local time: ${c.localTime}` : null,
    c.vehicle ? `vehicle: ${c.vehicle}` : null,
  ].filter(Boolean);
  return parts.length ? `[${parts.join('; ')}]\n` : '';
}

/**
 * Prior assistant turns are replayed as the JSON they were, without thinking blocks:
 * the history stays append-only and byte-stable, which keeps the prompt cache warm.
 */
function toMessages(req: AssistantRequest): Anthropic.Beta.BetaMessageParam[] {
  const note = contextNote(req);
  let first = true;
  return req.messages.map((m): Anthropic.Beta.BetaMessageParam => {
    if (m.role === 'assistant') return { role: 'assistant', content: JSON.stringify(m.turn) };
    const text = first ? `${note}${m.text}` : m.text;
    first = false;
    return { role: 'user', content: text };
  });
}

function offline(req: AssistantRequest): AssistantResponse {
  const texts = req.messages.flatMap((m) => (m.role === 'user' ? [m.text] : []));
  return { source: 'rules', turn: triageOffline(texts, req.locale) };
}

/** Light clean-up so a model answer always renders well. */
function tidy(turn: AssistantTurn): AssistantTurn {
  return {
    ...turn,
    safety: turn.safety.slice(0, 4),
    checks: turn.checks.slice(0, 4),
    likelyCauses: turn.likelyCauses.slice(0, 3),
    quickReplies: turn.quickReplies.filter((q) => q.length <= 60).slice(0, 4),
    followUpQuestion: turn.followUpQuestion?.trim() || null,
  };
}

export async function answer(req: AssistantRequest): Promise<AssistantResponse> {
  const anthropic = getClient();
  if (!anthropic) return offline(req);

  try {
    const response = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: ASSISTANT_SYSTEM_PROMPT,
      messages: toMessages(req),
      // Caches the stable system prompt and the conversation so far.
      cache_control: { type: 'ephemeral' },
      output_config: { effort: EFFORT, format: betaZodOutputFormat(assistantTurnSchema) },
      ...(SUPPORTS_FALLBACKS ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });

    if (response.stop_reason === 'refusal') {
      console.warn('[assistant] refused', response.stop_details?.category ?? 'unknown');
      return offline(req);
    }
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      console.warn('[assistant] unusable response', response.stop_reason);
      return offline(req);
    }
    const checked = assistantTurnSchema.safeParse(response.parsed_output);
    if (!checked.success) return offline(req);
    return { source: 'ai', turn: tidy(checked.data) };
  } catch (error) {
    // Most specific first; whatever happens, the driver still gets the safety guide.
    if (error instanceof Anthropic.RateLimitError) console.warn('[assistant] rate limited by API');
    else if (error instanceof Anthropic.AuthenticationError) console.error('[assistant] invalid ANTHROPIC_API_KEY');
    else if (error instanceof Anthropic.BadRequestError) console.error('[assistant] bad request', error.message);
    else if (error instanceof Anthropic.APIConnectionError) console.warn('[assistant] connection error');
    else if (error instanceof Anthropic.APIError) console.error('[assistant] API error', error.status);
    else console.error('[assistant] unexpected error', error);
    return offline(req);
  }
}
