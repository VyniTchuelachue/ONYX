'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** One choice out of a few, shown side by side. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-1 rounded-lg border border-line bg-surface-1 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              // Equal widths when they fit; a longer label ("Bus ou car") takes the room it needs.
              'flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-10 px-2 text-sm sm:px-3',
              active ? 'bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A toggleable pill, used for filters and multi-select options. */
export function Chip({
  pressed,
  onClick,
  children,
  icon,
  className,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        pressed ? 'border-gold/60 bg-gold/12 text-gold-bright' : 'border-line bg-surface-1 text-ink-2 hover:border-line-strong hover:text-ink',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-md py-2 text-left disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block text-[15px] text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-3">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-gold bg-gold' : 'border-line-strong bg-surface-3',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-[22px] rounded-full transition-transform duration-200 ease-[var(--ease-spring)]',
            checked ? 'translate-x-5 bg-onyx' : 'bg-ink-2',
          )}
        />
      </span>
    </button>
  );
}
