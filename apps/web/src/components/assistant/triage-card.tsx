'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { m } from 'motion/react';
import { CircleAlert, Phone, Search, Volume2, VolumeX, Wrench } from 'lucide-react';
import type { AssistantSource, AssistantTurn, UrgencyLevel } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { writeDraft } from '@/lib/request-draft';
import { cn } from '@/lib/utils';
import { Pill, type Tone } from '../ui/bits';
import { Emblem } from '../brand';
import { buttonClass } from '../ui/button';
import { useShellActions } from '../shell/shell-actions';

const URGENCY_TONE: Record<UrgencyLevel, Tone> = { low: 'neutral', medium: 'gold', high: 'danger', critical: 'danger' };

export function AssistantAvatar({ className }: { className?: string }) {
  return <Emblem size={30} className={className} />;
}

/** One assistant answer: what to do first, what to check, and who can fix it. */
export function TriageCard({
  turn,
  source,
  latest,
  userTexts,
  speaking,
  onSpeak,
  onQuickReply,
}: {
  turn: AssistantTurn;
  source: AssistantSource;
  latest: boolean;
  userTexts: string[];
  speaking: boolean;
  onSpeak: (() => void) | null;
  onQuickReply: (text: string) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { openEmergency } = useShellActions();
  const isTriage = turn.category !== 'other' || turn.checks.length > 0;

  const requestHelp = () => {
    writeDraft({
      category: turn.category,
      urgency: turn.urgency,
      description: userTexts.join('. ').slice(0, 1000),
      aiSummary: turn.technicianSummary.slice(0, 2000),
      broadcast: true,
      step: 1,
    });
    router.push('/request/new');
  };

  return (
    <m.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3"
    >
      <AssistantAvatar className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {isTriage && <Pill tone={URGENCY_TONE[turn.urgency]}>{t(`assistant.urgency.${turn.urgency}`)}</Pill>}
          {isTriage && turn.canDrive !== 'yes' && (
            <Pill tone={turn.canDrive === 'no' ? 'danger' : 'neutral'}>{t(`assistant.canDrive.${turn.canDrive}`)}</Pill>
          )}
          <span className="text-xs text-ink-3" title={source === 'rules' ? t('assistant.sourceRulesHelp') : undefined}>
            {source === 'ai' ? t('assistant.sourceAi') : t('assistant.sourceRules')}
          </span>
          {onSpeak && (
            <button
              type="button"
              onClick={onSpeak}
              aria-pressed={speaking}
              aria-label={speaking ? t('assistant.stopReading') : t('assistant.readAloud')}
              className="ml-auto grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              {speaking ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          )}
        </div>

        <p className="text-[17px] leading-relaxed text-ink">{turn.reply}</p>

        {turn.callEmergency && (
          <button
            type="button"
            onClick={openEmergency}
            className="mt-4 flex w-full items-center gap-3 rounded-lg border border-danger/40 bg-danger/12 px-4 py-3 text-left text-[15px] font-semibold text-danger-soft hover:bg-danger/18"
          >
            <Phone className="size-5 shrink-0" aria-hidden="true" />
            {t('assistant.callEmergency')}
            <span className="tabular ml-auto font-display text-lg">118 / 119</span>
          </button>
        )}

        {turn.safety.length > 0 && (
          <section className="mt-4 flex gap-3.5 rounded-lg bg-danger/6 p-4">
            <span className="w-[3px] shrink-0 rounded-full bg-[repeating-linear-gradient(to_bottom,var(--color-danger)_0_9px,transparent_9px_18px)]" aria-hidden="true" />
            <div>
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-danger-soft">
                <CircleAlert className="size-4" aria-hidden="true" />
                {t('assistant.safetyTitle')}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {turn.safety.map((s, i) => (
                  <li key={i} className="text-[15px] leading-snug text-ink">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {turn.checks.length > 0 && (
          <section className="mt-5">
            <h3 className="font-wide text-[15px] font-semibold text-ink">{t('assistant.checksTitle')}</h3>
            <ol className="mt-3 space-y-3">
              {turn.checks.map((c, i) => (
                <li key={i} className="flex gap-3">
                  <span className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-semibold text-gold">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[15px] font-medium text-ink">{c.title}</p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {turn.likelyCauses.length > 0 && (
          <section className="mt-5">
            <h3 className="text-[14px] font-medium text-ink-3">{t('assistant.causesTitle')}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{turn.likelyCauses.join(', ')}</p>
          </section>
        )}

        {turn.followUpQuestion && <p className="mt-4 text-[16px] leading-relaxed font-medium text-gold-bright">{turn.followUpQuestion}</p>}

        {latest && isTriage && turn.needsProfessional && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={requestHelp} className={buttonClass('primary', 'md')}>
              <Wrench className="size-4" aria-hidden="true" />
              {t('assistant.requestHelp')}
            </button>
            <Link href={`/technicians?specialty=${turn.specialty}`} className={buttonClass('secondary', 'md')}>
              <Search className="size-4 text-gold" aria-hidden="true" />
              {t('assistant.findSpecialist', { specialty: t(`specialtyShort.${turn.specialty}`) })}
            </Link>
          </div>
        )}

        {latest && turn.quickReplies.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {turn.quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onQuickReply(q)}
                className={cn('h-9 rounded-full border border-line bg-surface-1 px-3.5 text-sm text-ink-2 transition-colors hover:border-gold/50 hover:text-ink')}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </m.article>
  );
}
