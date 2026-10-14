import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

const variants = {
  primary: 'bg-gold text-onyx hover:bg-gold-bright active:bg-gold-deep active:text-ink disabled:bg-gold/40',
  secondary: 'bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong',
  outline: 'border border-line-strong text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/12 text-danger-soft border border-danger/30 hover:bg-danger/20',
  ok: 'bg-ok/12 text-ok border border-ok/30 hover:bg-ok/20',
} as const;

const sizes = {
  sm: 'h-9 gap-1.5 rounded-sm px-3 text-sm',
  md: 'h-11 gap-2 rounded-md px-4 text-[15px]',
  lg: 'h-14 gap-2.5 rounded-lg px-5 text-base',
  icon: 'size-11 rounded-full',
  'icon-sm': 'size-9 rounded-full',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

const base =
  'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60';

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant, size, loading, icon, className, children, disabled, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function ButtonLink({ variant, size, icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

/** For tel:, sms:, https://wa.me… — real anchors, not client navigation. */
export function ButtonAnchor({
  variant,
  size,
  icon,
  className,
  children,
  ...props
}: ComponentProps<'a'> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  return (
    <a className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </a>
  );
}
