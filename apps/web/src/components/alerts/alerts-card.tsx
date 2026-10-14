'use client';

import { Bell, BellOff, BellRing } from 'lucide-react';
import type { MessageKey } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { isDemo } from '@/lib/config';
import { useAlerts, type AlertsStatus } from '@/lib/alerts';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

const BLOCKED: Partial<Record<AlertsStatus, MessageKey>> = {
  denied: 'alerts.denied',
  'install-first': 'alerts.installFirst',
  unsupported: 'alerts.unsupported',
};

/** Turn phone alerts on or off for this device, or explain why they can't be. */
export function AlertsCard({ audience, className }: { audience: 'driver' | 'technician'; className?: string }) {
  const { t } = useI18n();
  const { status, busy, failed, enable, disable } = useAlerts();
  // Nothing to offer on a deployment without push keys, and nothing to show before the browser answers.
  if (status === 'pending' || status === 'not-configured') return null;

  const on = status === 'on';
  const blocked = BLOCKED[status];
  const Icon = on ? BellRing : blocked ? BellOff : Bell;

  return (
    <section className={cn('rounded-xl border bg-surface-1 p-4', on ? 'border-line' : 'border-gold/35', className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 size-5 shrink-0', blocked ? 'text-ink-3' : 'text-gold')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">{on ? t('alerts.enabled') : t('alerts.title')}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-3">
            {blocked ? t(blocked) : audience === 'technician' ? t('alerts.proHelp') : t('alerts.driverHelp')}
          </p>
          {isDemo && !blocked && <p className="mt-1 text-[13px] text-ink-3">{t('alerts.demoNote')}</p>}
          {status === 'off' && (
            <Button size="sm" className="mt-3" loading={busy} onClick={() => void enable()}>
              {t('alerts.enable')}
            </Button>
          )}
          {on && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void disable()}
              className="mt-2 text-[14px] font-medium text-gold-bright hover:underline disabled:opacity-60"
            >
              {t('alerts.disable')}
            </button>
          )}
          {failed && (
            <p role="alert" className="mt-2 text-[13px] text-danger-soft">
              {t('alerts.failed')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** One line on the tracking page while waiting for a technician, until alerts are on. */
export function TrackAlertsPrompt({ className }: { className?: string }) {
  const { t } = useI18n();
  const { status, busy, enable } = useAlerts();
  if (status !== 'off') return null;
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border border-line bg-surface-1 px-3.5 py-2.5', className)}>
      <Bell className="size-4 shrink-0 text-gold" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[14px] text-ink-2">{t('alerts.trackPrompt')}</p>
      <Button size="sm" variant="secondary" loading={busy} onClick={() => void enable()}>
        {t('alerts.enable')}
      </Button>
    </div>
  );
}
