'use client';

import { useParams } from 'next/navigation';
import { RoundSessionProvider } from '@/lib/golf/roundSession';
import { QueueFlusher } from '@/lib/golf/offlineQueue';

export default function RoundLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const roundId = params?.id ?? '';
  if (!roundId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <span className="font-mono text-xs text-ash tracking-[0.25em] uppercase">
          Missing round id
        </span>
      </div>
    );
  }
  return (
    <RoundSessionProvider roundId={roundId}>
      <QueueFlusher />
      {children}
    </RoundSessionProvider>
  );
}
