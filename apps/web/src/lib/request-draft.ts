import { STORAGE_KEYS, type IssueCategory, type UrgencyLevel, type Vehicle } from '@onyx/core';
import { readSession, writeSession } from './storage';

/** A request being prepared — survives navigation and the sign-in detour (tab-scoped). */
export interface RequestDraft {
  category?: IssueCategory;
  description?: string;
  urgency?: UrgencyLevel;
  aiSummary?: string | null;
  technicianId?: string | null;
  broadcast?: boolean;
  vehicle?: Vehicle;
  landmark?: string;
  contactName?: string;
  contactPhone?: string;
  step?: number;
}

export const readDraft = () => readSession<RequestDraft>(STORAGE_KEYS.requestDraft) ?? {};
export const writeDraft = (draft: RequestDraft) => writeSession(STORAGE_KEYS.requestDraft, draft);
export const clearDraft = () => writeSession(STORAGE_KEYS.requestDraft, null);
