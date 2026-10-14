'use client';

import { useState } from 'react';
import { Plus, Trash } from 'lucide-react';
import { QUOTE_ITEM_KINDS, quoteTotal, type QuoteItem, type QuoteItemKind } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useFormat } from '@/lib/format';
import { useAction } from '@/lib/queries';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input, Select, Textarea } from '../ui/field';

interface Line {
  label: string;
  kind: QuoteItemKind;
  quantity: string;
  unitPrice: string;
}

const emptyLine = (kind: QuoteItemKind = 'part'): Line => ({ label: '', kind, quantity: '1', unitPrice: '' });

/** Line-by-line quote. The total shown here is a preview; the database computes the real one. */
export function QuoteBuilder({ requestId, open, onClose, initial }: { requestId: string; open: boolean; onClose: () => void; initial?: QuoteItem[] }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const [lines, setLines] = useState<Line[]>(() =>
    initial?.length
      ? initial.map((i) => ({ label: i.label, kind: i.kind, quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
      : [emptyLine('part'), emptyLine('labour')],
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const items: QuoteItem[] = lines
    .filter((l) => l.label.trim())
    .map((l) => ({
      label: l.label.trim(),
      kind: l.kind,
      quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
      unitPrice: Math.max(0, Math.round(Number(l.unitPrice.replace(/\s/g, '')) || 0)),
    }));

  const send = useAction((b, _: void) => b.pro.sendQuote(requestId, { items, note: note || null }), { success: t('pro.quoteSent') });

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('pro.newQuote')}
      footer={
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-3">{t('request.total')}</p>
            <p className="font-display tabular text-[22px] text-ink">{fmt.money(quoteTotal(items))}</p>
          </div>
          <Button
            size="lg"
            loading={send.isPending}
            onClick={() => {
              if (!items.length) {
                setError(t('errors.quote_empty'));
                return;
              }
              setError(null);
              send.mutate(undefined, { onSuccess: onClose });
            }}
          >
            {t('pro.sendQuote')}
          </Button>
        </div>
      }
    >
      <ul className="space-y-3">
        {lines.map((l, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface-2/40 p-3">
            <div className="flex gap-2">
              <Input
                aria-label={t('pro.itemLabel')}
                placeholder={t('pro.itemLabelPlaceholder')}
                value={l.label}
                onChange={(e) => update(i, { label: e.target.value })}
                maxLength={80}
              />
              <button
                type="button"
                onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                aria-label={t('pro.removeItem')}
                className="grid size-12 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-danger-soft"
              >
                <Trash className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-[minmax(0,1.7fr)_56px_minmax(0,1.3fr)] gap-2">
              <Select aria-label={t('pro.itemKind')} value={l.kind} onChange={(e) => update(i, { kind: e.target.value as QuoteItemKind })}>
                {QUOTE_ITEM_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`request.itemKinds.${k}`)}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={t('pro.quantity')}
                inputMode="numeric"
                value={l.quantity}
                onChange={(e) => update(i, { quantity: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })}
                className="tabular text-center"
              />
              <Input
                aria-label={t('pro.unitPrice')}
                inputMode="numeric"
                placeholder={t('pro.unitPrice')}
                value={l.unitPrice}
                onChange={(e) => update(i, { unitPrice: e.target.value.replace(/[^\d]/g, '').slice(0, 7) })}
                className="tabular"
              />
            </div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="mt-2" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setLines((ls) => [...ls, emptyLine()])} disabled={lines.length >= 20}>
        {t('pro.addItem')}
      </Button>
      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-ink-2" htmlFor="quote-note">
          {t('pro.note')}
        </label>
        <Textarea id="quote-note" rows={2} className="min-h-0" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pro.notePlaceholder')} maxLength={500} />
      </div>
      {error && <p className="mt-3 text-[14px] text-danger-soft">{error}</p>}
    </Sheet>
  );
}
