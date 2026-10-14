'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useDictation } from '@/lib/speech';
import { cn } from '@/lib/utils';
import { Spinner } from '../ui/spinner';

/**
 * Where a driver describes the problem, by typing or speaking. The gem-coloured ring is
 * the one flourish in the interface; it turns while the assistant listens or thinks.
 */
export function AskBox({
  onSubmit,
  busy = false,
  variant = 'composer',
  autoFocus = false,
  className,
}: {
  onSubmit: (text: string) => void;
  busy?: boolean;
  variant?: 'hero' | 'composer';
  autoFocus?: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const dictation = useDictation(locale, (spoken) => setText(spoken));

  useEffect(() => {
    if (dictation.error === 'denied') toast.error(t('assistant.micDenied'));
  }, [dictation.error, t]);

  // Grow with the text, up to a few lines.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, variant === 'hero' ? 168 : 132)}px`;
  }, [text, variant]);

  const submit = () => {
    const value = text.trim();
    if (!value || busy) return;
    if (dictation.listening) dictation.stop();
    onSubmit(value);
    setText('');
  };

  const active = dictation.listening || busy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        'gem-ring flex flex-col bg-surface-1 transition-shadow',
        variant === 'hero' ? 'rounded-xl p-2 shadow-[0_30px_80px_-40px_rgb(154_13_253/0.45)]' : 'rounded-lg p-1.5',
        active && '[&::before]:animate-gem-spin',
        className,
      )}
    >
      <label htmlFor={id} className="sr-only">
        {t('home.inputLabel')}
      </label>
      <textarea
        id={id}
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        rows={variant === 'hero' ? 2 : 1}
        maxLength={2000}
        autoFocus={autoFocus}
        enterKeyHint="send"
        placeholder={dictation.listening ? t('assistant.listening') : variant === 'hero' ? t('home.inputPlaceholder') : t('assistant.placeholder')}
        className={cn(
          'w-full resize-none bg-transparent text-ink placeholder:text-ink-3 focus:outline-none',
          variant === 'hero' ? 'px-3 pt-2.5 text-[17px] leading-relaxed' : 'px-3 py-2 text-[16px] leading-relaxed',
        )}
      />
      <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
        {dictation.supported ? (
          <button
            type="button"
            onClick={dictation.listening ? dictation.stop : dictation.start}
            aria-pressed={dictation.listening}
            aria-label={dictation.listening ? t('assistant.stopDictation') : t('assistant.dictate')}
            className={cn(
              'flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors',
              dictation.listening ? 'bg-violet/20 text-violet-soft' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            {dictation.listening ? <Square className="size-4 fill-current" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
            <span className={variant === 'hero' ? '' : 'sr-only sm:not-sr-only'}>
              {dictation.listening ? t('assistant.listening') : t('assistant.dictate')}
            </span>
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label={t('common.send')}
          className="grid size-10 place-items-center rounded-full bg-gold text-onyx transition-[background-color,opacity,transform] hover:bg-gold-bright active:scale-95 disabled:bg-surface-3 disabled:text-ink-3"
        >
          {busy ? <Spinner className="size-4" /> : <ArrowUp className="size-5" strokeWidth={2.4} aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}

export const ASSISTANT_PREFILL_KEY = 'onyx.assistant-prefill';
