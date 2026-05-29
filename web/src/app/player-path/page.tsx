'use client';

import { useState } from 'react';
import PracticeLibrary from '@/components/PracticeLibrary';
import PracticePlanner from '@/components/PracticePlanner';

type View = 'library' | 'planner';

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'library', label: 'Practice Library' },
  { value: 'planner', label: 'Practice Planner' },
];

export default function PlayerPathPage() {
  const [view, setView] = useState<View>('library');

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-12">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-5">Development</p>
          <h1 className="font-display font-extrabold text-[clamp(40px,7vw,80px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Player<span className="text-primary">Path</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            Every player has a highest-leverage area. PlayerPath surfaces it —
            quantifying exactly which part of the game is costing the most strokes
            and mapping a clear development priority.
          </p>

          {/* ── Tool Selector ─────────────────────────────────── */}
          <div className="mt-8 flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground shrink-0">
              Tool
            </span>
            <div className="relative">
              <select
                value={view}
                onChange={(e) => setView(e.target.value as View)}
                className="font-mono text-[11px] tracking-[0.12em] uppercase bg-card border border-border text-foreground pl-4 pr-10 py-2.5 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-colors hover:border-muted-foreground"
              >
                {VIEW_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">
                ▾
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Active Tool ──────────────────────────────────────── */}
      {view === 'library' ? <PracticeLibrary /> : <PracticePlanner />}
    </>
  );
}
