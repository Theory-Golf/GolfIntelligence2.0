'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addSession, loadSessions, isStorageAvailable } from '@/lib/inside-ten/storage';
import { TIER_META, formatSG } from '@/lib/inside-ten/scoring';
import { bestScore, last5Average, formatDate } from '@/lib/inside-ten/stats';
import type { InsideTenSession } from '@/lib/inside-ten/types';

type View = 'entry' | 'result';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxDate(): string {
  return todayISO();
}

export default function InsideTenPlay() {
  const router = useRouter();
  const [view, setView] = useState<View>('entry');
  const [score, setScore] = useState(12);
  const [date, setDate] = useState(todayISO());
  const [savedSession, setSavedSession] = useState<InsideTenSession | null>(null);
  const [prevSessions, setPrevSessions] = useState<InsideTenSession[]>([]);
  const [storageAvail, setStorageAvail] = useState(true);

  useEffect(() => {
    setStorageAvail(isStorageAvailable());
    if (isStorageAvailable()) {
      setPrevSessions(loadSessions());
    }
  }, []);

  function increment() { setScore(s => Math.min(18, s + 1)); }
  function decrement() { setScore(s => Math.max(0, s - 1)); }

  function handleSave() {
    const session = addSession(score, date);
    setSavedSession(session);
    // Reload prev sessions excluding the one just saved for delta calcs
    if (isStorageAvailable()) {
      setPrevSessions(loadSessions().filter(s => s.id !== session.id));
    }
    setView('result');
  }

  if (view === 'result' && savedSession) {
    return <ResultView session={savedSession} prevSessions={prevSessions} onDone={() => router.push('/player-path/putting/inside-ten')} />;
  }

  return (
    <div className="min-h-[60vh] flex flex-col">
      {/* ── Score input ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase mb-10" style={{ color: 'var(--ash)' }}>
          Putts Made
        </p>

        {/* Large score stepper */}
        <div className="flex items-center gap-8 mb-12">
          <button
            onClick={decrement}
            disabled={score === 0}
            aria-label="Decrease score"
            className="w-14 h-14 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20"
            style={{ background: 'var(--shadow)', border: '1px solid var(--pitch)', color: 'var(--cement)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
            </svg>
          </button>

          <div className="text-center min-w-[120px]">
            <div
              className="font-display font-extrabold leading-none"
              style={{ fontSize: 'clamp(80px, 18vw, 120px)', color: 'var(--chalk)', letterSpacing: '-0.03em' }}
            >
              {score}
            </div>
            <div className="font-mono text-[11px] tracking-[0.2em] uppercase mt-1" style={{ color: 'var(--ash)' }}>
              out of 18
            </div>
          </div>

          <button
            onClick={increment}
            disabled={score === 18}
            aria-label="Increase score"
            className="w-14 h-14 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20"
            style={{ background: 'var(--shadow)', border: '1px solid var(--pitch)', color: 'var(--cement)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Date picker */}
        <div className="flex flex-col items-center gap-2 mb-12">
          <label className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--ash)' }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            max={maxDate()}
            onChange={e => setDate(e.target.value)}
            className="px-4 py-2 rounded font-mono text-sm text-center appearance-none"
            style={{
              background: 'var(--shadow)',
              border: '1px solid var(--pitch)',
              color: 'var(--chalk)',
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* Storage warning */}
        {!storageAvail && (
          <p className="font-mono text-[10px] tracking-wider text-center mb-6" style={{ color: 'var(--bogey)' }}>
            History won&apos;t be saved — private browsing detected.
          </p>
        )}

        {/* Save CTA */}
        <button
          onClick={handleSave}
          className="font-display font-bold text-sm uppercase tracking-[0.15em] px-10 py-4 rounded transition-opacity hover:opacity-90"
          style={{ background: 'var(--scarlet)', color: '#fff' }}
        >
          Save Session
        </button>
      </div>
    </div>
  );
}

// ── Result view ─────────────────────────────────────────────────────────────

interface ResultViewProps {
  session: InsideTenSession;
  prevSessions: InsideTenSession[];
  onDone: () => void;
}

function ResultView({ session, prevSessions, onDone }: ResultViewProps) {
  const meta = TIER_META[session.tier];
  const pb = bestScore(prevSessions);
  const last5avg = last5Average(prevSessions);
  const prev = prevSessions[0] ?? null;

  const deltaPrev = prev != null ? session.score - prev.score : null;
  const deltaAvg = last5avg != null ? session.score - last5avg : null;
  const deltaPB = pb != null ? session.score - pb : null;

  function fmtDelta(d: number | null): string {
    if (d === null) return '—';
    if (d === 0) return '±0';
    return d > 0 ? `+${d}` : `${d}`;
  }

  function deltaColor(d: number | null): string {
    if (d === null || d === 0) return 'var(--ash)';
    return d > 0 ? 'var(--sg-strong)' : 'var(--sg-weak)';
  }

  return (
    <div className="flex flex-col items-center px-6 py-16 min-h-[70vh]">
      {/* Score */}
      <div className="text-center mb-8">
        <div className="font-display font-extrabold leading-none mb-2" style={{ fontSize: 'clamp(72px, 16vw, 108px)', color: 'var(--scarlet)', letterSpacing: '-0.03em' }}>
          {session.score}
          <span className="font-body font-light" style={{ fontSize: 'clamp(28px, 6vw, 44px)', color: 'var(--ash)', letterSpacing: 0 }}>/18</span>
        </div>
        <div className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'var(--ash)' }}>
          {formatDate(session.date)}
        </div>
      </div>

      {/* Tier badge */}
      <div
        className="inline-flex flex-col items-center px-8 py-4 rounded mb-6"
        style={{ background: meta.bgColor, border: `1px solid ${meta.color}44` }}
      >
        <span className="font-display font-bold text-xl uppercase tracking-wider mb-1" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <span className="font-body text-[12px] text-center max-w-[260px] leading-relaxed" style={{ color: 'var(--cement)' }}>
          {meta.copy}
        </span>
      </div>

      {/* SG */}
      <div className="mb-10">
        <span className="font-mono text-base tracking-wider" style={{ color: meta.color }}>
          {formatSG(session.sg)} SG
        </span>
        <span className="font-mono text-[10px] tracking-wider ml-2" style={{ color: 'var(--ash)' }}>
          (est.)
        </span>
      </div>

      {/* Deltas */}
      {prevSessions.length > 0 && (
        <div
          className="w-full max-w-sm mb-10 rounded divide-y"
          style={{ background: 'var(--shadow)', border: '1px solid var(--pitch)', divideColor: 'var(--pitch)' }}
        >
          {[
            { label: 'vs Previous', value: deltaPrev },
            { label: 'vs Last 5 Avg', value: deltaAvg != null ? Math.round(deltaAvg * 10) / 10 : null },
            { label: 'vs Personal Best', value: deltaPB },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center px-5 py-3">
              <span className="font-mono text-[10px] tracking-wider uppercase" style={{ color: 'var(--ash)' }}>
                {label}
              </span>
              <span className="font-display font-bold text-base" style={{ color: deltaColor(value) }}>
                {fmtDelta(typeof value === 'number' ? Math.round(value) : value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Link
          href="/player-path/putting/inside-ten/history"
          className="w-full text-center font-display font-bold text-sm uppercase tracking-[0.15em] px-8 py-4 rounded transition-opacity hover:opacity-90"
          style={{ background: 'var(--scarlet)', color: '#fff' }}
        >
          View History
        </Link>
        <button
          onClick={onDone}
          className="w-full font-display font-bold text-sm uppercase tracking-[0.15em] px-8 py-4 rounded transition-colors"
          style={{ background: 'var(--shadow)', border: '1px solid var(--pitch)', color: 'var(--cement)' }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
