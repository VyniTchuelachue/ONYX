import type { VerificationStatus } from '@onyx/core';
import type { Tone } from '../ui/bits';

export const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  pending: 'gold',
  verified: 'ok',
  rejected: 'danger',
  suspended: 'danger',
};
