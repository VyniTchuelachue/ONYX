'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '../brand';
import { DemoBadge, LanguageToggle, SkipLink } from './common';

/** Brand bar and a narrow centred column: sign-in, sign-up, demo. */
export function MinimalShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="pt-safe">
        <div className="mx-auto flex h-16 max-w-md items-center gap-3 px-5">
          <Link href="/" aria-label="ONYX">
            <Wordmark height={26} priority />
          </Link>
          <DemoBadge />
          <LanguageToggle className="ml-auto" />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-5 pt-6 pb-16">
        {children}
      </main>
    </div>
  );
}
