'use client';

import { useState } from 'react';
import { ArrowRight, Car, Shield, Wrench } from 'lucide-react';
import type { UserRole } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useBackend } from '@/lib/backend';
import { cn } from '@/lib/utils';
import { Spinner } from './ui/spinner';

const ROLES = [
  { role: 'driver', icon: Car },
  { role: 'technician', icon: Wrench },
  { role: 'admin', icon: Shield },
] as const;

/** One tap into any of the three apps with fictional data. */
export function DemoRolePicker({ onDone, className }: { onDone: (role: UserRole) => void; className?: string }) {
  const { t } = useI18n();
  const backend = useBackend();
  const [busy, setBusy] = useState<UserRole | null>(null);
  return (
    <ul className={cn('space-y-2', className)}>
      {ROLES.map(({ role, icon: Icon }) => (
        <li key={role}>
          <button
            type="button"
            disabled={!backend?.auth.demo || busy !== null}
            onClick={async () => {
              if (!backend?.auth.demo) return;
              setBusy(role);
              await backend.auth.demo.signInAs(role);
              onDone(role);
            }}
            className="flex w-full items-center gap-4 rounded-xl border border-line bg-surface-1 p-4 text-left transition-colors hover:border-gold/45 disabled:opacity-60"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-gold">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-ink">{t(`auth.demoRoles.${role}`)}</span>
              <span className="block text-[14px] text-ink-3">{t(`auth.demoRoleHelp.${role}`)}</span>
            </span>
            {busy === role ? <Spinner className="size-5 text-gold" /> : <ArrowRight className="size-5 text-ink-3" aria-hidden="true" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
