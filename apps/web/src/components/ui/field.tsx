'use client';

import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-md border border-line bg-surface-2 px-3.5 text-[16px] text-ink placeholder:text-ink-3 transition-colors focus:border-gold/70 focus:bg-surface-1 focus:outline-none focus:ring-3 focus:ring-gold/15 aria-[invalid=true]:border-danger/60 disabled:opacity-60';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-12', className)} {...props} />;
}

/** Password with a show/hide toggle: typing blind on a phone keyboard is error-prone. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <input type={visible ? 'text' : 'password'} className={cn(control, 'h-12 pr-12', className)} {...props} />
      <button
        type="button"
        aria-label={t('auth.showPassword')}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-md text-ink-3 hover:text-ink focus-visible:text-ink"
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-24 resize-none py-3 leading-relaxed', className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select className={cn(control, 'h-12 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <svg className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-3" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: string;
  className?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}

/** Label, control, and one line of help or error — wired up for screen readers. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink-2">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-3">{optional}</span>}
      </label>
      {children({ id, 'aria-describedby': hint || error ? hintId : undefined, 'aria-invalid': error ? true : undefined })}
      {(error || hint) && (
        <p id={hintId} className={cn('text-[13px] leading-snug', error ? 'text-danger-soft' : 'text-ink-3')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
