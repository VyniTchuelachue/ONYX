'use client';

import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia('(display-mode: standalone)');
  media.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', listener);
  };
}

/** "Add to home screen" where the browser supports it (Android Chrome, desktop Chrome/Edge). */
export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const installed = useSyncExternalStore(subscribe, () => window.matchMedia('(display-mode: standalone)').matches, () => false);
  return {
    canInstall,
    installed,
    async install() {
      if (!deferred) return false;
      const prompt = deferred;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      deferred = null;
      emit();
      return choice.outcome === 'accepted';
    },
  };
}
