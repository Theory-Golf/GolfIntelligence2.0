'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import DriverStandard from '@/components/DriverStandard';

type Screen =
  | 'welcome'
  | 'tier-select'
  | 'tier-select-confirm'
  | 'setup'
  | 'shot'
  | 'summary'
  | 'ci-prompt'
  | 'promotion'
  | 'history';

export default function DriverStandardShell() {
  const [screen, setScreen] = useState<Screen>('welcome');

  return (
    <>
      {screen !== 'shot' && (
        <section className="px-6 pt-16 pb-8">
          <div className="max-w-3xl mx-auto">
            <Link
              href="/player-path#library"
              className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3" /> Library
            </Link>
            <p className="eyebrow mb-5">Assessment &middot; Driving</p>
            <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
              Driver<span className="text-primary">Standard</span>
            </h1>
            <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
              A periodized practice protocol for off-the-tee accuracy. Five tiers
              anchored to PGA Tour and USGA fairway standards. Binary scoring —
              every shot is Hit or Miss. Optional shape mode adds the
              contextual interference that produces transfer to the course.
            </p>
          </div>
        </section>
      )}

      <DriverStandard onScreenChange={setScreen} />
    </>
  );
}
