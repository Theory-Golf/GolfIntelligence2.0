'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ResumeSessionBar from '@/components/playerpath/ResumeSessionBar';
import { segmentAnchor } from '@/data/practiceActivities';
import InsideTwenty from '@/components/InsideTwenty';

type Screen = 'home' | 'play' | 'result';

export default function InsideTwentyShell() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <>
      {screen !== 'play' && <ResumeSessionBar />}
      {screen !== 'play' && (
        <section className="px-6 pt-16 pb-8">
          <div className="max-w-3xl mx-auto">
            <Link
              href={segmentAnchor('inside-twenty')}
              className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3" /> Practice
            </Link>
            <p className="eyebrow mb-5">Drill · Mid-Range Putting</p>
            <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
              Inside<span className="text-primary">Twenty</span>
            </h1>
            <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
              The conversion zone. Eighteen putts from 5 to 19 feet — the range where
              rounds are won or lost.
            </p>
          </div>
        </section>
      )}

      <InsideTwenty onScreenChange={setScreen} />
    </>
  );
}
