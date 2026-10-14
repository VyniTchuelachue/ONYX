import type { RequestStatus, UserRole } from '../constants';

/**
 * Request lifecycle. This table is the single source of truth for the client and the
 * demo backend; `supabase/migrations/*_functions.sql` enforces the same rules in SQL.
 *
 *   pending ─► accepted ─► en_route ─► arrived ─► quoted ─► in_progress ─► completed
 *      ▲          │            │          │   └────────────────►┘
 *      └──────────┴────────────┘ (technician releases)    (quote declined → arrived)
 *   any state before work starts ─► cancelled
 */
export type Actor = UserRole;

type TransitionTable = Record<RequestStatus, Partial<Record<Actor, RequestStatus[]>>>;

const TRANSITIONS: TransitionTable = {
  pending: { technician: ['accepted'], driver: ['cancelled'], admin: ['cancelled'] },
  accepted: { technician: ['en_route', 'pending', 'cancelled'], driver: ['cancelled'], admin: ['cancelled'] },
  en_route: { technician: ['arrived', 'pending', 'cancelled'], driver: ['cancelled'], admin: ['cancelled'] },
  arrived: { technician: ['quoted', 'in_progress', 'cancelled'], driver: ['cancelled'], admin: ['cancelled'] },
  quoted: { technician: ['quoted', 'cancelled'], driver: ['in_progress', 'arrived', 'cancelled'], admin: ['cancelled'] },
  in_progress: { technician: ['completed'], admin: ['cancelled'] },
  completed: {},
  cancelled: {},
};

export function canTransition(from: RequestStatus, to: RequestStatus, actor: Actor): boolean {
  return TRANSITIONS[from][actor]?.includes(to) ?? false;
}

export const TERMINAL_STATUSES: readonly RequestStatus[] = ['completed', 'cancelled'];
export const ACTIVE_STATUSES: readonly RequestStatus[] = [
  'pending',
  'accepted',
  'en_route',
  'arrived',
  'quoted',
  'in_progress',
];

export const isActive = (s: RequestStatus) => ACTIVE_STATUSES.includes(s);
export const isTerminal = (s: RequestStatus) => TERMINAL_STATUSES.includes(s);

/** The milestones drawn on the request "road", in order. */
export const MILESTONES = ['pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed'] as const;
export type Milestone = (typeof MILESTONES)[number];

/** Index of the milestone a status sits on (quoted counts as "arrived": the technician is with you). */
export function milestoneIndex(status: RequestStatus): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'accepted':
      return 1;
    case 'en_route':
      return 2;
    case 'arrived':
    case 'quoted':
      return 3;
    case 'in_progress':
      return 4;
    case 'completed':
      return 5;
    case 'cancelled':
      return -1;
  }
}

export const canDriverCancel = (s: RequestStatus) => canTransition(s, 'cancelled', 'driver');
export const canTechnicianRelease = (s: RequestStatus) => s === 'accepted' || s === 'en_route';
export const canSendQuote = (s: RequestStatus) => s === 'arrived' || s === 'quoted';
export const canEditDiagnosis = (s: RequestStatus) => s === 'arrived' || s === 'quoted' || s === 'in_progress';
export const canShareLocation = (s: RequestStatus) => s === 'accepted' || s === 'en_route';

/** The next forward step a technician takes from a status, for the primary action button. */
export type TechnicianStep = 'accept' | 'en_route' | 'arrived' | 'quote' | 'complete' | 'await_driver' | null;

export function nextTechnicianStep(status: RequestStatus): TechnicianStep {
  switch (status) {
    case 'pending':
      return 'accept';
    case 'accepted':
      return 'en_route';
    case 'en_route':
      return 'arrived';
    case 'arrived':
      return 'quote';
    case 'quoted':
      return 'await_driver';
    case 'in_progress':
      return 'complete';
    default:
      return null;
  }
}
