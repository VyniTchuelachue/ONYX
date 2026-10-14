'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';
import { MessageCircle, MessageSquareText, Phone, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { smsHref, telHref, whatsappHref, type Technician } from '@onyx/core';
import { isDemo } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import { useLocationLabel } from '@/lib/use-location-label';
import { buttonClass, type ButtonSize } from '../ui/button';
import { cn } from '@/lib/utils';

/** In demo mode the numbers are fictional: never dial them. */
function useDemoGuard() {
  const { t } = useI18n();
  return (e: MouseEvent) => {
    if (!isDemo) return;
    e.preventDefault();
    toast(t('technicians.demoCallBlocked'));
  };
}

export function useWhatsappText(technician: Pick<Technician, 'ownerName'>) {
  const { t } = useI18n();
  const loc = useLocationLabel();
  const place = loc.context?.label ?? 'Douala';
  return t('technicians.whatsappMessage', { name: technician.ownerName.split(' ')[0] ?? '', place });
}

export function ContactActions({
  technician,
  size = 'sm',
  showRequest = true,
  showSms = false,
  className,
}: {
  technician: Technician;
  size?: ButtonSize;
  showRequest?: boolean;
  showSms?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const guard = useDemoGuard();
  const message = useWhatsappText(technician);
  const phone = technician.phone;
  const whatsapp = technician.whatsapp ?? phone;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {phone && (
        <a href={telHref(phone)} onClick={guard} className={buttonClass('primary', size)}>
          <Phone className="size-4" aria-hidden="true" />
          {t('technicians.call')}
        </a>
      )}
      {whatsapp && (
        <a
          href={whatsappHref(whatsapp, message)}
          onClick={guard}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('secondary', size)}
        >
          <MessageCircle className="size-4 text-ok" aria-hidden="true" />
          {t('technicians.whatsapp')}
        </a>
      )}
      {showSms && phone && (
        <a href={smsHref(phone, message)} onClick={guard} className={buttonClass('secondary', size)}>
          <MessageSquareText className="size-4 text-blue-soft" aria-hidden="true" />
          {t('technicians.sms')}
        </a>
      )}
      {showRequest && (
        <Link href={`/request/new?technician=${technician.id}`} className={buttonClass('outline', size)}>
          <Wrench className="size-4 text-gold" aria-hidden="true" />
          {t('technicians.request')}
        </Link>
      )}
    </div>
  );
}

export function CallLink({ phone, label, className }: { phone: string; label: string; className?: string }) {
  const guard = useDemoGuard();
  return (
    <a href={telHref(phone)} onClick={guard} className={className}>
      {label}
    </a>
  );
}
