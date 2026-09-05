'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ResumeSessionBar from '@/components/playerpath/ResumeSessionBar';
import { segmentAnchor } from '@/data/practiceActivities';
import WedgeStandard from '@/components/WedgeStandard';

type Screen = 'home' | 'setup' | 'practice' | 'creative' | 'history' | 'results';

const PLAY_SCREENS: Screen[] = ['practice', 'creative'];

export default function WedgeStandardShell() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <>
      {!PLAY_SCREENS.includes(screen) && <ResumeSessionBar />}
      {!PLAY_SCREENS.includes(screen) && (
        <section className="px-6 pt-16 pb-8">
          <div className="max-w-3xl mx-auto">
            <Link href={segmentAnchor('wedge-standard')} className="inline-flex items-center gap-2 font-mono text-label tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors">
              <ArrowLeft className="size-3" /> Practice
            </Link>
            <p className="eyebrow mb-5">Assessment &middot; Wedge</p>
            <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
              Wedge<span className="text-primary">Standard</span>
            </h1>
            <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
              An adaptive assessment that adjusts difficulty as your performance
              improves. Scored on proximity, carry accuracy, and dispersion.
              The standard rises with you.
            </p>
          </div>
        </section>
      )}

      <WedgeStandard onScreenChange={setScreen} />
    </>
  );
}
