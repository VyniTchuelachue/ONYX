import type { IssueCategory, Locale, UserRole } from './constants';
import type { RequestEventType } from './types';
import { createTranslator } from './i18n';
import { formatDistance } from './domain/geo';
import { formatXAF } from './domain/money';

/**
 * Phone alerts. The database decides who hears about an event (push_targets()); this
 * decides what the alert says, so the web server, the on-device demo and the future
 * mobile app word them the same way.
 */
export interface PushTarget {
  locale: Locale;
  audience: 'driver' | 'technician';
  eventType: RequestEventType;
  actorRole: UserRole | null;
  requestId: string;
  requestCode: string;
  category: IssueCategory;
  placeLabel: string | null;
  distanceKm: number | null;
  isDirect: boolean;
  technicianName: string | null;
  amount: number | null;
  rating: number | null;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Page to open when the alert is tapped. */
  url: string;
  /** Alerts with the same tag replace each other, so a job never piles up on the lock screen. */
  tag: string;
  /** Seconds the push service keeps trying to deliver: an offer is stale after a few minutes. */
  ttl: number;
  urgency: 'high' | 'normal';
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/** The alert for one person and one event, or null when this event doesn't warrant one. */
export function pushMessage(target: PushTarget): PushMessage | null {
  const { t } = createTranslator(target.locale);
  const technician = target.technicianName ?? t('push.yourTechnician');
  const category = t(`categories.${target.category}`);
  const place = target.placeLabel ?? t('push.nearby');
  const code = target.requestCode;

  if (target.audience === 'technician') {
    const job = { url: `/pro/jobs/${target.requestId}`, tag: `job-${target.requestId}` };
    switch (target.eventType) {
      case 'created':
      case 'declined':
      case 'released':
        return {
          title: target.isDirect ? t('push.directOfferTitle') : t('push.offerTitle', { category }),
          body:
            target.distanceKm !== null
              ? t('push.offerBody', { category, place, distance: formatDistance(target.distanceKm, target.locale) })
              : t('push.offerBodyNoDistance', { category, place }),
          url: '/pro',
          tag: `offer-${target.requestId}`,
          ttl: 15 * MINUTE,
          urgency: 'high',
        };
      case 'quote_accepted':
        return { ...job, title: t('push.quoteAcceptedTitle'), body: t('push.quoteAcceptedBody', { code }), ttl: HOUR, urgency: 'high' };
      case 'quote_declined':
        return { ...job, title: t('push.quoteDeclinedTitle'), body: t('push.quoteDeclinedBody', { code }), ttl: HOUR, urgency: 'high' };
      case 'cancelled':
        return {
          ...job,
          title: t('push.cancelledTitle', { code }),
          body: target.actorRole === 'admin' ? t('push.cancelledByTeam') : t('push.cancelledByDriver'),
          ttl: HOUR,
          urgency: 'high',
        };
      case 'reviewed':
        return {
          title: t('push.reviewedTitle', { rating: target.rating ?? '—' }),
          body: t('push.reviewedBody', { code }),
          url: '/pro',
          tag: `review-${target.requestId}`,
          ttl: 24 * HOUR,
          urgency: 'normal',
        };
      default:
        return null;
    }
  }

  const request = { url: `/requests/${target.requestId}`, tag: `request-${target.requestId}`, ttl: HOUR, urgency: 'high' as const };
  switch (target.eventType) {
    case 'accepted':
      return { ...request, title: t('push.acceptedTitle', { technician }), body: t('push.acceptedBody') };
    case 'en_route':
      return { ...request, title: t('push.enRouteTitle', { technician }), body: t('push.enRouteBody') };
    case 'arrived':
      return { ...request, title: t('push.arrivedTitle', { technician }), body: t('push.arrivedBody') };
    case 'quote_sent':
      return {
        ...request,
        title: target.amount !== null ? t('push.quoteTitle', { amount: formatXAF(target.amount, target.locale) }) : t('push.quoteTitleNoAmount'),
        body: t('push.quoteBody', { technician }),
      };
    case 'declined':
      return { ...request, title: t('push.declinedTitle', { technician }), body: t('push.reofferedBody') };
    case 'released':
      return { ...request, title: t('push.releasedTitle', { technician }), body: t('push.reofferedBody') };
    case 'completed':
      return { ...request, title: t('push.completedTitle'), body: t('push.completedBody', { technician }), ttl: 24 * HOUR, urgency: 'normal' };
    case 'cancelled':
      return {
        ...request,
        title: t('push.cancelledTitle', { code }),
        body: target.actorRole === 'admin' ? t('push.cancelledByTeam') : t('push.cancelledByTechnician'),
      };
    default:
      return null;
  }
}
