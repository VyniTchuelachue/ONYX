'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Bottom sheet on phones, centred dialog on larger screens. Built on <dialog> for
 * focus trapping, Escape and screen-reader semantics without extra libraries.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="onyx-sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={cn('sheet-panel flex max-h-[90dvh] flex-col rounded-t-2xl border border-line bg-surface-1 sm:rounded-2xl', className)}>
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl leading-tight text-ink">
              {title}
            </h2>
            {description && <p className="mt-1.5 text-[15px] leading-snug text-ink-2">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <footer className="border-t border-line px-5 pt-3 pb-[calc(12px+var(--safe-bottom))]">{footer}</footer>}
      </div>
    </dialog>
  );
}
