'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LS_PRACTICE_CURRENT_SESSION } from '@/lib/constants';

/**
 * Shown on a game page while a plan session is in progress.
 *
 * Assessment blocks send the player off to a game on its own route, so
 * without this the way back is the browser's back button — which on a phone,
 * mid-session, with a scorecard open, is not good enough.
 *
 * Renders nothing when no session is active.
 */
export default function ResumeSessionBar() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    try {
      setActive(!!window.localStorage.getItem(LS_PRACTICE_CURRENT_SESSION));
    } catch {
      /* storage unavailable — just don't show the bar */
    }
  }, []);

  if (!active) return null;

  return (
    <div className="border-b border-primary/40 bg-accent/40">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
        <span className="font-mono text-label uppercase tracking-[0.2em] text-primary">
          Session in progress
        </span>
        <Link
          href="/player-path#plan"
          className="inline-flex min-h-[44px] items-center font-mono text-label uppercase tracking-[0.15em] text-foreground no-underline transition-colors hover:text-primary"
        >
          ← Back to the plan
        </Link>
      </div>
    </div>
  );
}
