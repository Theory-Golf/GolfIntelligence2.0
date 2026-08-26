'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ResumeSessionBar from '@/components/playerpath/ResumeSessionBar';
import { segmentAnchor } from '@/data/practiceActivities';
import RoundSimulation from '@/components/RoundSimulation';

type Screen = 'welcome' | 'setup' | 'putt-setup' | 'second-putt' | 'summary' | 'history';

const PLAY_SCREENS: Screen[] = ['putt-setup', 'second-putt'];

export default function RoundSimulationShell() {
  const [screen, setScreen] = useState<Screen>('welcome');

  return (
    <>
      {!PLAY_SCREENS.includes(screen) && <ResumeSessionBar />}
      {!PLAY_SCREENS.includes(screen) && (
        <section className="px-6 pt-16 pb-8">
          <div className="max-w-3xl mx-auto">
            <Link href={segmentAnchor('round-simulation')} className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors">
              <ArrowLeft className="size-3" /> Practice
            </Link>
            <p className="eyebrow mb-5">Assessment &middot; Putting</p>
            <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
              Round<span className="text-primary">Sim</span>
            </h1>
            <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
              18 putts across a realistic tour distribution. Track make rate,
              strokes gained vs PGA Tour benchmarks, and your miss tendencies —
              then log results over time to see where you&apos;re improving.
            </p>
          </div>
        </section>
      )}

      <RoundSimulation onScreenChange={setScreen} />
    </>
  );
}
