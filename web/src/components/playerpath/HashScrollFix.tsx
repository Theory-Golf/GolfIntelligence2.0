'use client';

import { useEffect } from 'react';

/**
 * Keeps a hash landing on target while the page finishes growing.
 *
 * The browser resolves `#practice` against the layout as it exists at first
 * paint — but PracticePlanner renders a 128px placeholder until it hydrates
 * from localStorage, and PracticeStrip mounts only after its account query
 * returns. Both sit above `#practice`, so by the time the page settles the
 * target has been pushed well below where the browser stopped.
 *
 * So: re-scroll to the target whenever the document grows, for a short window
 * after load, and stand down the moment the player scrolls themselves. Nobody
 * gets the page yanked out from under them.
 */

/** How long to keep correcting. Long enough for a slow drill-history query. */
const SETTLE_MS = 2000;

/**
 * Intent events only. A plain `scroll` listener would catch our own
 * corrections and stand down on the first one.
 */
const INTENT_EVENTS = ['wheel', 'touchstart', 'keydown'] as const;

export default function HashScrollFix() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;

    let observer: ResizeObserver | null = null;
    let timer = 0;

    const finish = () => {
      observer?.disconnect();
      observer = null;
      window.clearTimeout(timer);
      INTENT_EVENTS.forEach((e) => window.removeEventListener(e, finish));
    };

    INTENT_EVENTS.forEach((e) => window.addEventListener(e, finish, { passive: true }));

    observer = new ResizeObserver(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
    observer.observe(document.body);

    timer = window.setTimeout(finish, SETTLE_MS);
    return finish;
  }, []);

  return null;
}
