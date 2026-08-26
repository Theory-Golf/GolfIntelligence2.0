'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ResumeSessionBar from '@/components/playerpath/ResumeSessionBar';
import { segmentAnchor } from '@/data/practiceActivities';
import LineTest from '@/components/LineTest';

type Screen = 'home' | 'profile' | 'setup' | 'shot' | 'result' | 'history';

export default function LineTestShell() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <>
      {screen !== 'shot' && <ResumeSessionBar />}
      {screen !== 'shot' && (
        <section className="px-6 pt-16 pb-8">
          <div className="max-w-3xl mx-auto">
            <Link
              href={segmentAnchor('line-test')}
              className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3" /> Practice
            </Link>
            <p className="eyebrow mb-5">Assessment &middot; Approach</p>
            <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
              The Line<span className="text-primary">Test</span>
            </h1>
            <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
              A dispersion benchmark for directional control. Twenty shots, four
              clubs, one number — placed on a five-tier ladder anchored to
              college, amateur, and tour reference populations. Run it
              periodically to track how consistently you start and finish the
              ball on your line.
            </p>
          </div>
        </section>
      )}

      <LineTest onScreenChange={setScreen} />
    </>
  );
}
