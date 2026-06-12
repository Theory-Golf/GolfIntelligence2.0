'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useRoundSession,
  holeIsComplete,
  holeStrokes,
  type HoleEntry,
} from '@/lib/golf/roundSession';

const COLOR_UNDER = '#00B870';
const COLOR_PAR = '#F2F0EE';
const COLOR_BOGEY = '#F09020';
const COLOR_DOUBLE = '#E8202A';

function scoreColor(rel: number): string {
  if (rel < 0) return COLOR_UNDER;
  if (rel === 0) return COLOR_PAR;
  if (rel === 1) return COLOR_BOGEY;
  return COLOR_DOUBLE;
}

function fmtRel(rel: number): string {
  if (rel > 0) return `+${rel}`;
  if (rel < 0) return String(rel);
  return 'E';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  // Treat the date string as a calendar date, not a moment in time —
  // appending T00:00:00 anchors it so toLocaleDateString doesn't shift
  // it by the local timezone offset.
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
}

type RowState =
  | { kind: 'completed'; entry: HoleEntry }
  | { kind: 'in-progress'; entry: HoleEntry }
  | { kind: 'unplayed'; entry: HoleEntry | undefined };

export default function RoundReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = useRoundSession();
  const [mode, setMode] = useState<'review' | 'editing'>('review');
  const [submitting, setSubmitting] = useState(false);
  const [submitNote, setSubmitNote] = useState<string | null>(null);

  const roundId = params?.id ?? '';

  if (session.loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <span className="font-mono text-xs text-ash tracking-[0.25em] uppercase">
          Loading…
        </span>
      </div>
    );
  }

  if (session.error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <span className="font-mono text-xs text-scarlet tracking-[0.25em] uppercase">
          {session.error}
        </span>
      </div>
    );
  }

  const { state } = session;
  const score = session.getRunningScore();
  const totalYardage = session.getTotalYardage();
  const roundComplete = session.isRoundComplete();

  function rowStateFor(holeNumber: number): RowState {
    const entry = session.getHole(holeNumber);
    if (!entry || entry.shots.length === 0) {
      return { kind: 'unplayed', entry };
    }
    if (holeIsComplete(entry)) {
      return { kind: 'completed', entry };
    }
    return { kind: 'in-progress', entry };
  }

  function lowestIncompleteHole(): number {
    for (let n = 1; n <= 18; n++) {
      const entry = session.getHole(n);
      if (!entry || !holeIsComplete(entry)) return n;
    }
    return 18;
  }

  function handleBack() {
    if (roundComplete) {
      router.push('/golf-intelligence');
    } else {
      router.push(
        `/golf-intelligence/round/${roundId}/hole/${lowestIncompleteHole()}`,
      );
    }
  }

  async function handleSubmitRound() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitNote(null);
    try {
      const result = await session.submitRound();
      if (result.ok) {
        router.push('/golf-intelligence');
      } else {
        setSubmitNote(result.message ?? 'Submit failed — try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const frontStarted = [1, 2, 3, 4, 5, 6, 7, 8, 9].some((n) => {
    const e = session.getHole(n);
    return e !== undefined && e.shots.length > 0;
  });
  const backStarted = [10, 11, 12, 13, 14, 15, 16, 17, 18].some((n) => {
    const e = session.getHole(n);
    return e !== undefined && e.shots.length > 0;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto p-4 flex flex-col gap-5">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border pb-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="w-8 h-8 flex items-center justify-center text-ash hover:text-chalk font-mono text-xl leading-none"
          >
            □
          </button>
          <span className="font-display font-extrabold text-sm tracking-[0.25em] uppercase text-chalk">
            Round review
          </span>
          <button
            type="button"
            onClick={() => setMode(mode === 'editing' ? 'review' : 'editing')}
            className={`w-12 font-mono text-[11px] tracking-[0.2em] uppercase ${
              mode === 'editing' ? 'text-scarlet' : 'text-ash hover:text-chalk'
            }`}
          >
            {mode === 'editing' ? 'Done' : 'Edit'}
          </button>
        </header>

        {/* Context block */}
        <div className="flex flex-col gap-1 pb-3 border-b border-border">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash">
            {state.courseName || '—'}
            {state.roundType ? ` · ${state.roundType.toUpperCase()}` : ''}
          </p>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash">
            {formatDate(state.roundDate)}
            {' · '}
            {totalYardage !== null ? `${totalYardage}y` : '—'}
          </p>
        </div>

        {/* Score bar */}
        <div className="grid grid-cols-3 divide-x divide-border border-y border-border py-3">
          <ScoreColumn
            label="Front"
            raw={
              score.front !== null
                ? sumStrokes(session, 1, 9)
                : null
            }
            rel={score.front}
          />
          <ScoreColumn
            label="Back"
            raw={
              score.back !== null
                ? sumStrokes(session, 10, 18)
                : null
            }
            rel={score.back}
          />
          <ScoreColumn
            label="Total"
            raw={sumStrokes(session, 1, 18) || null}
            rel={score.total === 0 && !hasAnyComplete(session) ? null : score.vsPar}
          />
        </div>

        {/* Front nine */}
        <section className="flex flex-col">
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-2">
            Front nine
          </p>
          <div className="flex flex-col divide-y divide-border">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <HoleRow
                key={n}
                holeNumber={n}
                state={rowStateFor(n)}
                par={state.holePars[n] ?? null}
                lastActive={state.lastActiveHole === n}
                mode={mode}
                roundId={roundId}
              />
            ))}
          </div>
          {!frontStarted && (
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash opacity-60 mt-2">
              1—9 · remaining holes
            </p>
          )}
        </section>

        {/* Back nine */}
        <section className="flex flex-col">
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-2">
            Back nine
          </p>
          {backStarted ? (
            <div className="flex flex-col divide-y divide-border">
              {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((n) => (
                <HoleRow
                  key={n}
                  holeNumber={n}
                  state={rowStateFor(n)}
                  par={state.holePars[n] ?? null}
                  lastActive={state.lastActiveHole === n}
                  mode={mode}
                  roundId={roundId}
                />
              ))}
            </div>
          ) : (
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash opacity-60">
              10—18 · remaining holes
            </p>
          )}
        </section>

        {/* Submit round — the round only reaches the database here */}
        {session.isDraft && (
          <section className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              disabled={!roundComplete || submitting}
              onClick={handleSubmitRound}
              className="w-full rounded-md py-3 bg-chalk text-pitch border border-chalk font-display font-extrabold text-sm tracking-[0.25em] uppercase disabled:opacity-40"
            >
              {submitting ? 'Saving…' : 'Submit round'}
            </button>
            {!roundComplete && (
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-ash text-center">
                Complete all 18 holes to submit
              </p>
            )}
            {submitNote && (
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-scarlet text-center">
                {submitNote}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function hasAnyComplete(
  session: ReturnType<typeof useRoundSession>,
): boolean {
  return session.state.holes.some((h) => holeIsComplete(h));
}

function sumStrokes(
  session: ReturnType<typeof useRoundSession>,
  fromHole: number,
  toHole: number,
): number {
  let total = 0;
  for (let n = fromHole; n <= toHole; n++) {
    const h = session.getHole(n);
    if (h && holeIsComplete(h)) total += holeStrokes(h);
  }
  return total;
}

function ScoreColumn({
  label,
  raw,
  rel,
}: {
  label: string;
  raw: number | null;
  rel: number | null;
}) {
  return (
    <div className="flex flex-col items-center px-2">
      <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-1">
        {label}
      </span>
      <span
        className="font-display font-extrabold text-2xl leading-none"
        style={{ color: raw !== null && rel !== null ? scoreColor(rel) : COLOR_PAR }}
      >
        {raw ?? '—'}
      </span>
      <span
        className="font-mono text-[11px] tracking-[0.15em] mt-1"
        style={{ color: rel !== null ? scoreColor(rel) : COLOR_PAR }}
      >
        {rel !== null ? fmtRel(rel) : '—'}
      </span>
    </div>
  );
}

function HoleRow({
  holeNumber,
  state,
  par,
  lastActive,
  mode,
  roundId,
}: {
  holeNumber: number;
  state: RowState;
  par: number | null;
  lastActive: boolean;
  mode: 'review' | 'editing';
  roundId: string;
}) {
  const router = useRouter();

  function navigate() {
    if (state.kind === 'completed') {
      const qs = mode === 'editing' ? '?mode=editing' : '';
      router.push(
        `/golf-intelligence/round/${roundId}/hole/${holeNumber}/summary${qs}`,
      );
    } else {
      router.push(`/golf-intelligence/round/${roundId}/hole/${holeNumber}`);
    }
  }

  const startDist =
    state.entry && state.entry.shots.length > 0
      ? state.entry.shots[0].starting_distance
      : null;
  const effectivePar = state.entry?.par ?? par ?? null;

  const baseRow =
    'w-full flex items-center justify-between gap-3 py-3 px-2 text-left';
  const tint = lastActive ? 'bg-[rgba(232,32,42,0.08)]' : '';

  if (state.kind === 'unplayed') {
    return (
      <button
        type="button"
        onClick={navigate}
        className={`${baseRow} ${tint} opacity-40`}
      >
        <span className="font-display font-extrabold text-xl text-ash w-8">
          {holeNumber}
        </span>
        <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-ash flex-1">
          {effectivePar !== null ? `Par ${effectivePar}` : '—'}
        </span>
        <span className="w-12" />
      </button>
    );
  }

  if (state.kind === 'in-progress') {
    const shotsSoFar = holeStrokes(state.entry);
    return (
      <button type="button" onClick={navigate} className={`${baseRow} ${tint}`}>
        <span className="font-display font-extrabold text-xl text-chalk w-8">
          {holeNumber}
        </span>
        <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-ash flex-1">
          {effectivePar !== null ? `Par ${effectivePar}` : '—'}
          {startDist !== null ? ` · ${startDist}y` : ''}
        </span>
        <span className="font-mono text-[13px] text-ash">{shotsSoFar}·</span>
        <span className="font-mono text-ash w-4 text-right">›</span>
      </button>
    );
  }

  // Completed
  const entry = state.entry;
  const score = holeStrokes(entry);
  const rel = score - entry.par;
  const trailingIcon = mode === 'editing' ? '□' : '›';
  return (
    <button type="button" onClick={navigate} className={`${baseRow} ${tint}`}>
      <span className="font-display font-extrabold text-xl text-chalk w-8">
        {holeNumber}
      </span>
      <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-ash flex-1">
        Par {entry.par}
        {startDist !== null ? ` · ${startDist}y` : ''}
      </span>
      <span
        className="font-display font-extrabold text-lg"
        style={{ color: scoreColor(rel) }}
      >
        {score}
      </span>
      <span
        className="font-mono text-[11px] tracking-[0.1em] w-8 text-right"
        style={{ color: scoreColor(rel) }}
      >
        {fmtRel(rel)}
      </span>
      <span className="font-mono text-ash w-4 text-right">{trailingIcon}</span>
    </button>
  );
}

