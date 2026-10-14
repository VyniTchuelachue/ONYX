import type { ReactNode } from 'react';
import { Star } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-md', className)} />;
}

const tones = {
  neutral: 'border-line-strong bg-surface-2 text-ink-2',
  gold: 'border-gold/40 bg-gold/10 text-gold-bright',
  ok: 'border-ok/35 bg-ok/10 text-ok',
  danger: 'border-danger/40 bg-danger/10 text-danger-soft',
  blue: 'border-blue/40 bg-blue/10 text-blue-soft',
  violet: 'border-violet/40 bg-violet/10 text-violet-soft',
} as const;
export type Tone = keyof typeof tones;

export function Pill({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Read-only rating: star + number. */
export function Rating({ value, count, className }: { value: number; count?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Star className="size-3.5 fill-gold-bright text-gold-bright" aria-hidden="true" />
      <span className="tabular font-medium text-ink">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-ink-3">{count}</span>}
    </span>
  );
}

export function StarRow({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(size === 'sm' ? 'size-3.5' : 'size-5', i <= Math.round(value) ? 'fill-gold-bright text-gold-bright' : 'text-ink-3/50')}
        />
      ))}
    </span>
  );
}

/**
 * Technician initials on a dark tile. The gem-coloured ring marks verified listings,
 * echoing the ONYX emblem.
 */
export function Monogram({ name, verified, size = 'md', className }: { name: string; verified?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = { sm: 'size-10 text-[13px]', md: 'size-12 text-[15px]', lg: 'size-20 text-2xl' }[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full bg-surface-3 font-wide font-semibold tracking-wide text-gold-bright',
        verified && 'gem-ring',
        dims,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-full border border-line bg-surface-1 text-gold">{icon}</div>}
      <p className="max-w-xs text-[17px] font-medium text-ink">{title}</p>
      {body && <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-3">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Section heading inside a page. Sentence case, no eyebrow. */
export function SectionTitle({ children, action, className, id }: { children: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <h2 id={id} className="font-wide text-[17px] font-semibold text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}
