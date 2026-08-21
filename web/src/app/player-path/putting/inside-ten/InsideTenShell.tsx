'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import InsideTen from '@/components/InsideTen';

type Screen = 'home' | 'play' | 'result';

export default function InsideTenShell() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <>
      {screen !== 'play' && (
        <section className="px-6 pt-16 pb-8">
          <div className="max-w-3xl mx-auto">
            <Link
              href="/player-path#library"
              className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3" /> Library
            </Link>
            <p className="eyebrow mb-5">Drill · Putting</p>
            <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
              Inside<span className="text-primary">Ten</span>
            </h1>
            <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
              Speed control and green reading from 3 to 10 feet — the par-save and
              birdie-conversion range.
            </p>
          </div>
        </section>
      )}

      <InsideTen onScreenChange={setScreen} />
    </>
  );
}
