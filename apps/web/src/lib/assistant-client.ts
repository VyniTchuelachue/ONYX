import {
  triageOffline,
  type AssistantRequest,
  type AssistantResponse,
  type ChatMessage,
  type Locale,
} from '@onyx/core';

export type AssistantOutcome = AssistantResponse & {
  /** Why the offline guide answered instead of the AI, when it did. */
  fallbackReason?: 'offline' | 'unavailable' | 'rate_limited';
};

/**
 * Ask the assistant. Falls back to the on-device safety guide whenever the network or
 * the AI is unavailable, so a driver always gets safe first steps.
 */
export async function askAssistant(
  messages: ChatMessage[],
  locale: Locale,
  context: AssistantRequest['context'],
  accessToken: string | null,
): Promise<AssistantOutcome> {
  const userTexts = messages.filter((m) => m.role === 'user').map((m) => m.text);
  const offline = (reason: AssistantOutcome['fallbackReason']): AssistantOutcome => ({
    source: 'rules',
    turn: triageOffline(userTexts, locale),
    fallbackReason: reason,
  });

  if (typeof navigator !== 'undefined' && !navigator.onLine) return offline('offline');

  const body: AssistantRequest = {
    locale,
    context,
    // Keep the conversation short: the latest turns carry what matters.
    messages: messages.slice(-12).map((m) => (m.role === 'user' ? { role: 'user', text: m.text } : { role: 'assistant', turn: m.turn })),
  };
  // A conversation must start with the driver speaking.
  while (body.messages.length && body.messages[0]!.role !== 'user') body.messages.shift();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch('/api/v1/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 429) return offline('rate_limited');
    if (!res.ok) return offline('unavailable');
    // The server may answer from the guide on purpose (no AI key configured); that's not an outage.
    return (await res.json()) as AssistantResponse;
  } catch {
    return offline(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'unavailable');
  } finally {
    clearTimeout(timeout);
  }
}
