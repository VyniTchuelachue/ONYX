import type { UserRole } from '@onyx/core';

/** Only same-site paths, never `//evil.com` or absolute URLs (open-redirect guard). */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

export function homeFor(role: UserRole): string {
  return role === 'technician' ? '/pro' : role === 'admin' ? '/admin' : '/';
}
