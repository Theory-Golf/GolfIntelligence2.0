'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadSessions, isStorageAvailable } from '@/lib/inside-ten/storage';
import { TIER_META, formatSG } from '@/lib/inside-ten/scoring';
import { formatDate } from '@/lib/inside-ten/stats';
import type { InsideTenSession } from '@/lib/inside-ten/types';

const LADDER_GROUPS = [
  { group: 1, putts: [3, 4, 5] },
  { group: 2, putts: [4, 5, 6] },
  { group: 3, putts: [5, 6, 7] },
  { group: 4, putts: [6, 7, 8] },
  { group: 5, putts: [7, 8, 9] },
  { group: 6, putts: [8, 9, 10] },
];

export default function InsideTenLanding() {
  const [recentSessions, setRecentSessions] = useState<InsideTenSession[]>([]);
  const [storageWarning, setStorageWarning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isStorageAvailable()) {
      setStorageWarning(true);
      return;
    }
    setRecentSessions(loadSessions().slice(0, 5));
  }, []);

  return (
    <div>
      {/* ── Storage warning ──────────────────────────────────────── */}
      {mounted && storageWarning && (
        <div style={{
          background: 'rgba(232, 32, 42, 0.08)',
          borderTop: '1px solid rgba(232, 32, 42, 0.3)',
          borderBottom: '1px solid rgba(232, 32, 42, 0.3)',
        }} className="px-6 py-3">
          <div className="max-w-3xl mx-auto">
            <p className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'var(--double)' }}>
              History won&apos;t be saved in this browser session.
            </p>
          </div>
        </div>
      )}

      {/* ── The Drill ────────────────────────────────────────────── */}
      <section className="px-6 py-12 border-b" style={{ borderColor: 'var(--pitch)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="section-label mb-8">The Drill</p>

          {/* Setup */}
          <div className="mb-10">
            <h3 className="font-display font-bold text-base uppercase tracking-wider mb-3" style={{ color: 'var(--chalk)' }}>
              Setup
            </h3>
            <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--cement)' }}>
              A practice green with a reasonably consistent surface and a single hole.
              Multiple holes are better — they increase the variability of slope and putt types.
            </p>
          </div>

          {/* Distance ladder table */}
          <div className="mb-10">
            <h3 className="font-display font-bold text-base uppercase tracking-wider mb-4" style={{ color: 'var(--chalk)' }}>
              Structure — 18 putts · 6 ladders
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <th className="text-left pb-3 pr-6 font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--ash)' }}>Ladder</th>
                    <th className="text-center pb-3 px-3 font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--ash)' }}>Putt 1</th>
                    <th className="text-center pb-3 px-3 font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--ash)' }}>Putt 2</th>
                    <th className="text-center pb-3 px-3 font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--ash)' }}>Putt 3</th>
                  </tr>
                </thead>
                <tbody>
                  {LADDER_GROUPS.map(({ group, putts }) => (
                    <tr
                      key={group}
                      style={{ borderBottom: '1px solid var(--pitch)' }}
                    >
                      <td className="py-3 pr-6 font-mono text-[11px] tracking-wider" style={{ color: 'var(--ash)' }}>
                        {group}
                      </td>
                      {putts.map((ft, i) => (
                        <td key={i} className="py-3 px-3 text-center">
                          <span className="font-display font-bold text-sm" style={{ color: 'var(--chalk)' }}>
                            {ft} ft
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 font-body text-[11px] leading-relaxed" style={{ color: 'var(--ash)' }}>
              Weighted toward 5–8 ft — the range where par-saves and short birdie conversions are decided.
            </p>
          </div>

          {/* Rules */}
          <div>
            <h3 className="font-display font-bold text-base uppercase tracking-wider mb-4" style={{ color: 'var(--chalk)' }}>
              Rules
            </h3>
            <ul className="space-y-2">
              {[
                'Each putt is hit once. Misses are not retried.',
                'Track made / missed across all 18 putts in your head.',
                'No warm-up putts inside the drill — the first putt is the first putt.',
                'Any line from each distance is fine. Real greens have break.',
                'One session = one full 18-putt run.',
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="font-mono text-[10px] mt-1 shrink-0" style={{ color: 'var(--scarlet)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-body text-sm leading-relaxed" style={{ color: 'var(--cement)' }}>
                    {rule}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── How It's Scored ──────────────────────────────────────── */}
      <section className="px-6 py-12 border-b" style={{ borderColor: 'var(--pitch)', background: 'var(--obsidian)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="section-label mb-8">How It&apos;s Scored</p>

          <p className="font-body text-sm leading-relaxed mb-8" style={{ color: 'var(--cement)' }}>
            After your 18 putts, enter a single number — total makes. The app converts
            your score to a Strokes Gained estimate relative to PGA Tour baseline and
            classifies your session into a performance tier.
          </p>

          {/* Tier table */}
          <div className="space-y-2 mb-6">
            {([
              { tier: 'elite' as const,       range: '14–18' },
              { tier: 'tour' as const,         range: '12–13' },
              { tier: 'competitive' as const,  range: '10–11' },
              { tier: 'developing' as const,   range: '0–9'   },
            ] as const).map(({ tier, range }) => {
              const meta = TIER_META[tier];
              return (
                <div
                  key={tier}
                  className="flex items-start gap-4 p-4 rounded"
                  style={{ background: meta.bgColor, border: `1px solid ${meta.color}22` }}
                >
                  <div className="shrink-0 flex flex-col gap-1 min-w-[72px]">
                    <span className="font-display font-bold text-sm uppercase tracking-wide" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--ash)' }}>
                      {range} / 18
                    </span>
                  </div>
                  <span className="font-body text-[12px] leading-relaxed" style={{ color: 'var(--cement)' }}>
                    {meta.copy}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="font-mono text-[10px] tracking-wider leading-relaxed" style={{ color: 'var(--ash)' }}>
            SG estimate — true SG depends on which specific distances were made. This model
            distributes makes uniformly across distances for a given score, with missed putts
            assumed to leave a 2 ft tap-in remaining.
          </p>
        </div>
      </section>

      {/* ── Why It Matters ───────────────────────────────────────── */}
      <section className="px-6 py-12 border-b" style={{ borderColor: 'var(--pitch)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="section-label mb-8">Why It Matters</p>
          <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--cement)' }}>
            Par-saving putts and premium birdie conversions come from inside ten feet.
            The 5–8 ft range is where the difference between a good putter and an average
            putter shows up most clearly — it combines speed control with green reading
            under the pressure of a makeable putt. Inside Ten isolates that band and gives
            you a repeatable number to track it.
          </p>
        </div>
      </section>

      {/* ── Recent Performance ───────────────────────────────────── */}
      {mounted && recentSessions.length > 0 && (
        <section className="px-6 py-12 border-b" style={{ borderColor: 'var(--pitch)', background: 'var(--obsidian)' }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <p className="section-label" style={{ flex: 'none' }}>Recent Performance</p>
              <Link
                href="/player-path/putting/inside-ten/history"
                className="font-mono text-[10px] tracking-[0.2em] uppercase no-underline transition-colors"
                style={{ color: 'var(--ash)' }}
              >
                Full History →
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentSessions.map((session) => {
                const meta = TIER_META[session.tier];
                return (
                  <div
                    key={session.id}
                    className="shrink-0 p-4 rounded min-w-[110px]"
                    style={{
                      background: 'var(--shadow)',
                      border: `1px solid var(--pitch)`,
                      borderTop: `2px solid ${meta.color}`,
                    }}
                  >
                    <div className="font-display font-extrabold text-2xl leading-none mb-1" style={{ color: 'var(--chalk)' }}>
                      {session.score}
                      <span className="text-sm font-normal ml-0.5" style={{ color: 'var(--ash)' }}>/18</span>
                    </div>
                    <div className="font-mono text-[10px] tracking-wider mb-2" style={{ color: meta.color }}>
                      {meta.label}
                    </div>
                    <div className="font-mono text-[10px] tracking-wider" style={{ color: 'var(--ash)' }}>
                      {formatSG(session.sg)} SG
                    </div>
                    <div className="font-mono text-[9px] tracking-wider mt-1" style={{ color: 'var(--ash)' }}>
                      {formatDate(session.date)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom CTA ───────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-body text-sm mb-6" style={{ color: 'var(--ash)' }}>
            Ready to run your 18 putts?
          </p>
          <Link
            href="/player-path/putting/inside-ten/play"
            className="inline-block font-display font-bold text-sm uppercase tracking-[0.15em] px-8 py-4 rounded transition-opacity hover:opacity-90"
            style={{ background: 'var(--scarlet)', color: '#fff' }}
          >
            Start Session
          </Link>
        </div>
      </section>
    </div>
  );
}
