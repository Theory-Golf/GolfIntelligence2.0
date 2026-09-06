'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';

export default function EmptyState({
  onGetStarted,
  onImport,
}: {
  onGetStarted: () => void;
  onImport: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border border-border bg-card p-8 text-center">
      <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-foreground">
        Start your first session
      </h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Three steps: define your technical focus, scale the session to your shot budget, then run
        it. Everything you log is stored on this device.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onGetStarted}>Get Started</Button>
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          Import Historical Data
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.currentTarget.value = '';
          }}
        />
      </div>
      <p className="mt-6 font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
        Scored assessments from week three · History synced to your player profile
      </p>
    </div>
  );
}
