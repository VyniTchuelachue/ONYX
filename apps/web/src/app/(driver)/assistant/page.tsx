'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  STORAGE_KEYS,
  describeLocation,
  placeLabelFor,
  uuid,
  type AssistantRequest,
  type AssistantTurn,
  type ChatMessage,
} from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { useSession } from '@/lib/session';
import { useLocation } from '@/lib/location';
import { useSpeaker } from '@/lib/speech';
import { askAssistant } from '@/lib/assistant-client';
import { createPersistentStore } from '@/lib/external-store';
import { readSession, writeSession } from '@/lib/storage';
import { AskBox, ASSISTANT_PREFILL_KEY } from '@/components/assistant/ask-box';
import { AssistantAvatar, TriageCard } from '@/components/assistant/triage-card';
import { PageContainer } from '@/components/page';
import { Button } from '@/components/ui/button';

interface Conversation {
  messages: ChatMessage[];
  /** Fixed when the conversation starts, so every turn shares one cached prompt prefix. */
  context: AssistantRequest['context'] | null;
}

const chatStore = createPersistentStore<Conversation>(STORAGE_KEYS.assistantChat, { messages: [], context: null });

function spokenText(turn: AssistantTurn): string {
  return [turn.reply, ...turn.safety, ...turn.checks.map((c) => `${c.title}. ${c.detail}`), turn.followUpQuestion ?? '']
    .filter(Boolean)
    .join(' ');
}

export default function AssistantPage() {
  const { t, locale } = useI18n();
  const backend = useBackend();
  const { session } = useSession();
  const { position } = useLocation();
  const conversation = chatStore.useValue();
  const speaker = useSpeaker(locale);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const send = useCallback(
    async (text: string) => {
      const current = chatStore.get();
      const vehicle = session?.profile.defaultVehicle;
      const context =
        current.context ??
        ({
          placeLabel: position ? placeLabelFor(position) : null,
          corridor: position ? describeLocation(position).corridor : null,
          localTime: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }).format(new Date()),
          vehicle: vehicle ? [vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' ') || null : null,
        } satisfies AssistantRequest['context']);
      const messages: ChatMessage[] = [...current.messages, { id: uuid(), role: 'user', text, at: new Date().toISOString() }];
      chatStore.set({ messages, context });
      setBusy(true);
      setNotice(null);
      speaker.stop();
      const token = backend ? await backend.auth.getAccessToken().catch(() => null) : null;
      const outcome = await askAssistant(messages, locale, context, token);
      chatStore.set({
        messages: [
          ...chatStore.get().messages,
          { id: uuid(), role: 'assistant', turn: outcome.turn, source: outcome.source, at: new Date().toISOString() },
        ],
        context,
      });
      setNotice(
        outcome.fallbackReason === 'offline'
          ? t('assistant.offline')
          : outcome.fallbackReason === 'rate_limited'
            ? t('assistant.rateLimited')
            : outcome.fallbackReason === 'unavailable'
              ? t('assistant.aiUnavailable')
              : null,
      );
      setBusy(false);
    },
    [backend, locale, position, session, speaker, t],
  );

  // A question typed on the home screen arrives here and is sent straight away.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    const prefill = readSession<string>(ASSISTANT_PREFILL_KEY);
    if (prefill) {
      writeSession(ASSISTANT_PREFILL_KEY, null);
      void sendRef.current(prefill);
    }
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation.messages.length, busy]);

  const userTexts = conversation.messages.flatMap((m) => (m.role === 'user' ? [m.text] : []));
  const lastAssistantId = [...conversation.messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <PageContainer className="flex min-h-[calc(100dvh-56px-88px)] flex-col lg:min-h-[calc(100dvh-56px-48px)]">
      <header className="flex items-center justify-between gap-4 pt-5 pb-4 sm:pt-8">
        <h1 className="font-display text-[27px] leading-tight text-ink sm:text-[34px]">{t('assistant.title')}</h1>
        {conversation.messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="size-4" aria-hidden="true" />}
            onClick={() => {
              speaker.stop();
              setNotice(null);
              chatStore.set({ messages: [], context: null });
            }}
          >
            {t('assistant.newChat')}
          </Button>
        )}
      </header>

      <div className="flex-1 space-y-8 pb-6" aria-live="polite">
        <div className="flex gap-3">
          <AssistantAvatar className="mt-1" />
          <div>
            <p className="text-[17px] leading-relaxed text-ink">{t('assistant.welcome')}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{t('assistant.disclaimer')}</p>
          </div>
        </div>

        {conversation.messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-3 px-4 py-2.5 text-[16px] leading-relaxed whitespace-pre-wrap text-ink">
                {m.text}
              </p>
            </div>
          ) : (
            <TriageCard
              key={m.id}
              turn={m.turn}
              source={m.source}
              latest={m.id === lastAssistantId && !busy}
              userTexts={userTexts}
              speaking={speaker.speakingId === m.id}
              onSpeak={
                speaker.supported
                  ? () => (speaker.speakingId === m.id ? speaker.stop() : speaker.speak(m.id, spokenText(m.turn)))
                  : null
              }
              onQuickReply={(q) => void send(q)}
            />
          ),
        )}

        {busy && (
          <div className="flex items-center gap-3" role="status">
            <AssistantAvatar />
            <span className="gem-ring rounded-full bg-surface-1 px-4 py-2 text-sm text-ink-2 [&::before]:animate-gem-spin">
              {t('assistant.thinking')}…
            </span>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[calc(76px+var(--safe-bottom))] z-10 -mx-4 bg-gradient-to-t from-onyx from-60% to-transparent px-4 pt-6 pb-2 sm:-mx-6 sm:px-6 lg:bottom-0 lg:pb-6">
        {notice && <p className="mb-2 text-[13px] text-gold-bright">{notice}</p>}
        <AskBox onSubmit={(text) => void send(text)} busy={busy} />
      </div>
    </PageContainer>
  );
}
