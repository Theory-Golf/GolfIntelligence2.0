'use client';

import { useEffect } from 'react';
import { flushQueue } from '@/lib/golf/offlineQueue';
import { migrateLocalHistory } from '@/lib/playerpath/migrateLocal';

/**
 * Runs the practice sync housekeeping when PlayerPath opens: flush anything
 * the offline queue is holding, then upload local history the account has
 * never seen. Renders nothing.
 *
 * Both are safe to run repeatedly — every write is keyed on a stable
 * client_id, so a repeat updates the existing row instead of duplicating.
 */
export default function PracticeSync() {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await flushQueue();
        if (cancelled) return;
        await migrateLocalHistory();
      } catch (err) {
        // Never surface this: the player's results are already saved
        // locally, and the next load retries.
        console.error('[PracticeSync]', err);
      }
    }
    void run();

    // A range loses signal constantly — retry whenever it comes back.
    function onOnline() {
      void run();
    }
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return null;
}
