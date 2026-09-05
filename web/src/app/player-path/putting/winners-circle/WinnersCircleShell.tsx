'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ResumeSessionBar from '@/components/playerpath/ResumeSessionBar';
import { segmentAnchor } from '@/data/practiceActivities';
import WinnersCircle from '@/components/WinnersCircle';

type Screen = 'home' | 'play' | 'result';

export default function WinnersCircleShell() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <>
      {screen !== 'play' && <ResumeSessionBar />}
      {screen !== 'play' && (
        <section className="px-6 pt-16 pb-8">
          <div className="max-w-3xl mx-auto">
            <Link
              href={segmentAnchor('winners-circle')}
              className="inline-flex items-center gap-2 font-mono text-label tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3" /> Practice
            </Link>
            <p className="eyebrow mb-5">Assessment · Putting</p>
            <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
              Winners<span className="text-primary">Circle</span>
            </h1>
            <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
              A survival putting test. Five tees, one hole, no second chances —
              every miss raises the cost of the next one.
            </p>
          </div>
        </section>
      )}

      <WinnersCircle onScreenChange={setScreen} />
    </>
  );
}
