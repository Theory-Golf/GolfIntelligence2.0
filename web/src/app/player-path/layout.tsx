'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/golf/db/client';
import { migrateLocalDrillHistory } from '@/lib/golf/drillHistoryMigration';
import { QueueFlusher } from '@/lib/golf/offlineQueue';

export default function PlayerPathLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createBrowserClient();

    void migrateLocalDrillHistory();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        void migrateLocalDrillHistory();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <QueueFlusher />
      {children}
    </>
  );
}
