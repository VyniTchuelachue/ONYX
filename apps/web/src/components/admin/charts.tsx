'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Charts follow one rule set: thin marks with 4px rounded data-ends (square at the
 * baseline), a 2px surface gap between stacked fills, hairline solid grid, text in ink
 * tokens (never the series colour), a tooltip on hover/focus, and a table twin for
 * screen readers. The emphasis colour is a deeper gold that clears the lightness and
 * chroma checks on the dark surface; everything else is recessive grey.
 */
export const CHART = {
  accent: '#b8862a',
  muted: '#4a4743',
  grid: 'rgb(255 255 255 / 0.07)',
} as const;

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => value / s <= 4) ?? pow * 10;
  return Math.ceil(value / step) * step;
}

export interface ColumnDatum {
  key: string;
  label: string;
  /** Long label for the tooltip and table. */
  title: string;
  segments: { value: number; color: string }[];
  /** Tooltip lines. */
  details: { label: string; value: string; color?: string }[];
}

export function StackedColumns({
  data,
  legend,
  caption,
  tableHeaders,
}: {
  data: ColumnDatum[];
  legend: { label: string; color: string }[];
  caption: string;
  tableHeaders: string[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const totals = data.map((d) => d.segments.reduce((s, x) => s + x.value, 0));
  const max = niceMax(Math.max(1, ...totals));
  const ticks = [0, max / 2, max];
  const plotH = 168;

  return (
    <figure className="relative">
      {legend.length > 1 && (
        <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: l.color }} aria-hidden="true" />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <div className="relative flex gap-3">
        {/* y axis */}
        <div aria-hidden="true" className="tabular relative w-6 shrink-0 text-right text-[11px] text-ink-3" style={{ height: plotH }}>
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: plotH - (tick / max) * plotH }}>
              {tick}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height: plotH }}>
            {ticks.map((tick) => (
              <span key={tick} className="absolute inset-x-0 h-px" style={{ top: plotH - (tick / max) * plotH, background: CHART.grid }} />
            ))}
            <div className="absolute inset-0 flex items-end justify-between gap-1">
              {data.map((d, i) => {
                const total = totals[i]!;
                return (
                  <button
                    key={d.key}
                    type="button"
                    tabIndex={0}
                    aria-label={`${d.title}: ${d.details.map((x) => `${x.label} ${x.value}`).join(', ')}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="group relative flex h-full flex-1 cursor-default items-end justify-center focus-visible:outline-none"
                  >
                    {active === i && <span className="absolute inset-y-0 w-full rounded-sm bg-white/[0.04]" />}
                    <span className="relative flex w-full max-w-6 flex-col-reverse gap-[2px]" style={{ height: `${(total / max) * 100}%` }}>
                      {d.segments
                        .filter((s) => s.value > 0)
                        .map((s, j, arr) => (
                          <span
                            key={j}
                            className={cn('w-full', j === arr.length - 1 && 'rounded-t-[4px]')}
                            style={{ flexGrow: s.value, flexBasis: 0, background: s.color, minHeight: 2 }}
                          />
                        ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div aria-hidden="true" className="mt-2 flex justify-between gap-1 text-[11px] text-ink-3">
            {data.map((d, i) => (
              <span key={d.key} className={cn('flex-1 text-center', (data.length - 1 - i) % 2 === 1 && 'max-sm:invisible')}>
                {d.label}
              </span>
            ))}
          </div>
          {active !== null && data[active] && (
            <div
              role="presentation"
              className="pointer-events-none absolute top-0 z-10 w-max min-w-36 -translate-x-1/2 rounded-md border border-line-strong bg-surface-2 px-3 py-2 shadow-2xl"
              style={{ left: `clamp(72px, ${((active + 0.5) / data.length) * 100}%, calc(100% - 72px))` }}
            >
              <p className="text-[12px] font-medium text-ink">{data[active]!.title}</p>
              <ul className="mt-1 space-y-0.5">
                {data[active]!.details.map((x) => (
                  <li key={x.label} className="flex items-center justify-between gap-4 text-[12px] text-ink-2">
                    <span className="flex items-center gap-1.5">
                      {x.color && <span className="size-2 rounded-[2px]" style={{ background: x.color }} />}
                      {x.label}
                    </span>
                    <span className="tabular text-ink">{x.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {tableHeaders.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.title}</th>
              {d.details.map((x) => (
                <td key={x.label}>{x.value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** One series, nominal categories: every bar in the same colour, value at the tip. */
export function HorizontalBars({
  rows,
  caption,
  color = CHART.accent,
  format = (n: number) => String(n),
}: {
  rows: { key: string; label: ReactNode; value: number }[];
  caption: string;
  color?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure>
      <ul className="space-y-2.5" aria-label={caption}>
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
            <span className="truncate text-[13px] text-ink-2">{r.label}</span>
            <span className="flex items-center gap-2">
              <span
                className="h-3.5 rounded-r-[4px]"
                style={{ width: `${Math.max(1.5, (r.value / max) * 85)}%`, background: color }}
                aria-hidden="true"
              />
              <span className="tabular text-[13px] text-ink">{format(r.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Stat tile: label, value (proportional figures), optional context line. */
export function StatTile({ label, value, context, tone }: { label: string; value: ReactNode; context?: ReactNode; tone?: 'warn' }) {
  return (
    <div className={cn('rounded-xl border bg-surface-1 p-4', tone === 'warn' ? 'border-gold/40' : 'border-line')}>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-1.5 text-[24px] leading-none font-semibold text-ink">{value}</dd>
      {context && <dd className="mt-1.5 text-[12px] text-ink-3">{context}</dd>}
    </div>
  );
}
