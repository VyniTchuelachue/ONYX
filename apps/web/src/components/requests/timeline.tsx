'use client';

import type { RequestEvent } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';

/** Everything that happened on a job, oldest first. */
export function Timeline({ events }: { events: RequestEvent[] }) {
  const { t, locale } = useI18n();
  const quote = (s: string) => (locale === 'fr' ? `« ${s} »` : `“${s}”`);
  const fmt = useFormat();
  return (
    <ol className="space-y-3">
      {events.map((e) => {
        const data = e.data ?? {};
        const text = t(`request.events.${e.type}`, {
          name: typeof data.technicianName === 'string' ? data.technicianName : '',
          amount: typeof data.total === 'number' ? fmt.money(data.total) : '',
        });
        const reason = typeof data.reason === 'string' && data.reason ? data.reason : null;
        return (
          <li key={e.id} className="flex gap-3 text-[14px]">
            <span className="tabular w-12 shrink-0 text-ink-3">{fmt.time(e.createdAt)}</span>
            <span className="min-w-0 text-ink-2">
              {text}
              {reason && <span className="block text-ink-3">{quote(reason)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
