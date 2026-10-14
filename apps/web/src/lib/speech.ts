'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Locale } from '@onyx/core';

/* Web Speech API — free and on-device/browser-provided; feature-detected everywhere. */

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};
const speechLang = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'en-GB');

/** Dictation into a text field. `onText` receives the running transcript. */
export function useDictation(locale: Locale, onText: (text: string, final: boolean) => void) {
  const supported = useSyncExternalStore(noop, () => !!getRecognition(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<'denied' | 'failed' | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = speechLang(locale);
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onTextRef.current((finalText + interim).trim(), interim === '');
    };
    rec.onerror = (e) => setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : 'failed');
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setError('failed');
    }
  }, [locale]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, error, start, stop };
}

/** Read answers aloud — useful when the driver is standing by the road with the phone at arm's length. */
export function useSpeaker(locale: Locale) {
  const supported = useSyncExternalStore(noop, () => typeof window !== 'undefined' && 'speechSynthesis' in window, () => false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang(locale);
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(locale));
      if (voice) u.voice = voice;
      u.rate = 1;
      u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
      u.onerror = () => setSpeakingId(null);
      setSpeakingId(id);
      window.speechSynthesis.speak(u);
    },
    [supported, locale],
  );

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  return { supported, speakingId, speak, stop };
}
