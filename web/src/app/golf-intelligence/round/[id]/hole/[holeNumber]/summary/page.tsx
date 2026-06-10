'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  useRoundSession,
  holeStrokes,
  isHoled,
  strokeNumberForShot,
  type HoleEntry,
} from '@/lib/golf/roundSession';
import { ScoreHeader } from '@/components/golf/ScoreHeader';
import { LIE_ABBREVIATIONS, LIE_COLORS } from '@/lib/golf/utils/lieColors';
import type { ShotRow } from '@/lib/golf/db/types';

const COLOR_UNDER = '#00B870';
const COLOR_EVEN = '#B8B2AA';
const COLOR_BOGEY = '#F09020';
const COLOR_DOUBLE = '#E8202A';

function scoreWord(rel: number): string {
  if (rel <= -2) return 'EAGLE';
  if (rel === -1) return 'BIRDIE';
  if (rel === 0) return 'PAR';
  if (rel === 1) return 'BOGEY';
  if (rel === 2) return 'DOUBLE BOGEY';
  return 'OTHER';
}

function scoreColor(rel: number): string {
  if (rel < 0) return COLOR_UNDER;
  if (rel === 0) return COLOR_EVEN;
  if (rel === 1) return COLOR_BOGEY;
  return COLOR_DOUBLE;
}

function fmtRel(rel: number): string {
  if (rel > 0) return `+${rel}`;
  if (rel < 0) return String(rel);
  return 'E';
}

function conditionalLabel(s: ShotRow): string | null {
  if (s.club_category) return s.club_category.toUpperCase();
  if (s.miss_direction) return s.miss_direction.toUpperCase();
  if (s.putt_long_short) return s.putt_long_short.toUpperCase();
  return null;
}

export default function HoleSummaryPage() {
  const params = useParams<{ id: string; holeNumber: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useRoundSession();
  const [mode, setMode] = useState<'review' | 'editing'>(
    searchParams.get('mode') === 'editing' ? 'editing' : 'review',
  );

  const roundId = params?.id ?? '';
  const holeNumber = Number(params?.holeNumber ?? '1');
  const score = session.getRunningScore();

  if (session.loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <span className="font-mono text-xs text-ash tracking-[0.25em] uppercase">
          Loading…
        </span>
      </div>
    );
  }

  const hole = session.getHole(holeNumber);
  if (!hole || hole.shots.length === 0) {
    // No hole or no shots — fall back to the hole entry page.
    router.replace(`/golf-intelligence/round/${roundId}/hole/${holeNumber}`);
    return null;
  }

  return mode === 'review' ? (
    <ReviewMode
      hole={hole}
      roundId={roundId}
      score={score}
      onEdit={() => setMode('editing')}
    />
  ) : (
    <EditMode
      hole={hole}
      roundId={roundId}
      score={score}
      onDone={() => setMode('review')}
    />
  );
}

// ─── Review ─────────────────────────────────────────────────────────────────

function ReviewMode({
  hole,
  roundId,
  score,
  onEdit,
}: {
  hole: HoleEntry;
  roundId: string;
  score: ReturnType<ReturnType<typeof useRoundSession>['getRunningScore']>;
  onEdit: () => void;
}) {
  const router = useRouter();
  const session = useRoundSession();
  const holeScore = holeStrokes(hole);
  const rel = holeScore - hole.par;
  const startDist = hole.shots[0]?.starting_distance ?? null;
  const startUnit = hole.shots[0]?.starting_lie === 'Green' ? 'FT' : 'YDS';

  const isLastHole = hole.holeNumber === 18;

  function goNext() {
    session.setLastActiveHole(hole.holeNumber);
    session.completeHole(hole.holeNumber);
    if (isLastHole) {
      router.push(`/golf-intelligence/round/${roundId}/review`);
    } else {
      router.push(
        `/golf-intelligence/round/${roundId}/hole/${hole.holeNumber + 1}`,
      );
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto p-4 flex flex-col gap-5">
        <header className="flex items-start justify-between border-b border-border pb-3">
          <div className="flex items-baseline gap-3">
            <span className="font-display font-extrabold text-3xl text-chalk uppercase tracking-tight">
              {hole.holeNumber}
            </span>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash">
              Hole · Complete
            </span>
          </div>
          <ScoreHeader front={score.front} back={score.back} total={score.total} />
        </header>

        {/* Score hero */}
        <div className="flex flex-col items-center gap-1 py-4 border-b border-border">
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
            Score
          </p>
          <p className="font-display font-extrabold text-chalk leading-none" style={{ fontSize: 96 }}>
            {holeScore}
          </p>
          <p
            className="font-display font-bold text-base tracking-[0.2em] uppercase mt-1"
            style={{ color: scoreColor(rel) }}
          >
            {fmtRel(rel)} · {scoreWord(rel)}
          </p>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash mt-1">
            Par {hole.par}
            {startDist !== null && ` · ${startDist} ${startUnit}`}
          </p>
        </div>

        {/* Shot path */}
        <div>
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-3">
            Shot path
          </p>
          <div className="flex flex-col">
            {hole.shots.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-3 border-b border-border last:border-b-0"
              >
                <ShotPathRow
                  shot={s}
                  index={strokeNumberForShot(hole.shots, s.shot_number)}
                  lastHoled={isHoled(s) && i === hole.shots.length - 1}
                />
                {conditionalLabel(s) && (
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-ash">
                    {conditionalLabel(s)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Edit + Next */}
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase text-ash hover:text-chalk self-start"
        >
          <span className="inline-block w-3 h-3 border border-ash rounded-sm" />
          Edit shots
        </button>

        <button
          type="button"
          onClick={goNext}
          className="w-full rounded-md bg-chalk text-court py-4 font-display font-bold text-sm tracking-[0.2em] uppercase"
        >
          {isLastHole ? 'Review round →' : 'Next hole →'}
        </button>
      </div>
    </div>
  );
}

function ShotPathRow({
  shot,
  index,
  lastHoled,
}: {
  shot: ShotRow;
  index: number;
  lastHoled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 font-mono text-[13px]">
      <span className="text-ash w-4">{index}</span>
      <span style={{ color: LIE_COLORS[shot.starting_lie] }}>
        {shot.starting_distance}
        <span className="ml-0.5">{LIE_ABBREVIATIONS[shot.starting_lie]}</span>
      </span>
      <span className="text-ash">→</span>
      {lastHoled ? (
        <span className="text-chalk font-bold">HOLED</span>
      ) : (
        <span style={{ color: LIE_COLORS[shot.ending_lie] }}>
          {shot.ending_distance}
          <span className="ml-0.5">{LIE_ABBREVIATIONS[shot.ending_lie]}</span>
        </span>
      )}
      {shot.has_penalty && (
        <span className="text-scarlet text-[10px] tracking-[0.15em]">+PEN</span>
      )}
    </div>
  );
}

// ─── Edit ───────────────────────────────────────────────────────────────────

function EditMode({
  hole,
  roundId,
  score,
  onDone,
}: {
  hole: HoleEntry;
  roundId: string;
  score: ReturnType<ReturnType<typeof useRoundSession>['getRunningScore']>;
  onDone: () => void;
}) {
  const router = useRouter();
  const session = useRoundSession();
  const [busyId, setBusyId] = useState<string | null>(null);

  function goEdit(order: number) {
    router.push(
      `/golf-intelligence/round/${roundId}/hole/${hole.holeNumber}?edit=${order}`,
    );
  }
  function goInsert(order: number) {
    router.push(
      `/golf-intelligence/round/${roundId}/hole/${hole.holeNumber}?insertAfter=${order}`,
    );
  }
  async function del(shotId: string) {
    if (busyId) return;
    setBusyId(shotId);
    try {
      await session.deleteShot(hole.holeId, shotId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto p-4 flex flex-col gap-5">
        <header className="flex items-start justify-between border-b border-border pb-3">
          <div className="flex items-baseline gap-3">
            <span className="font-display font-extrabold text-3xl text-chalk uppercase tracking-tight">
              Hole {hole.holeNumber}
            </span>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-scarlet">
              Editing
            </span>
          </div>
          <ScoreHeader front={score.front} back={score.back} total={score.total} />
        </header>

        <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
          Shots · Pencil to edit · + to insert · × to delete
        </p>

        <div className="flex flex-col gap-2">
          {hole.shots.map((s, i) => {
            const last = i === hole.shots.length - 1;
            const holed = last && isHoled(s);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between border border-border rounded-md px-3 py-3 bg-shadow"
              >
                <div className="flex items-center gap-3 font-mono text-[13px]">
                  <span className="text-ash w-4">
                    {strokeNumberForShot(hole.shots, s.shot_number)}
                  </span>
                  <span style={{ color: LIE_COLORS[s.starting_lie] }}>
                    {s.starting_distance}
                    <span className="ml-0.5">{LIE_ABBREVIATIONS[s.starting_lie]}</span>
                  </span>
                  <span className="text-ash">→</span>
                  {holed ? (
                    <span className="text-chalk font-bold">HOLED</span>
                  ) : (
                    <span style={{ color: LIE_COLORS[s.ending_lie] }}>
                      {s.ending_distance}
                      <span className="ml-0.5">{LIE_ABBREVIATIONS[s.ending_lie]}</span>
                    </span>
                  )}
                  {s.has_penalty && (
                    <span className="text-scarlet text-[10px] tracking-[0.15em]">
                      +PEN
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <IconButton
                    label="Edit shot"
                    onClick={() => goEdit(s.shot_number)}
                    disabled={busyId !== null}
                  >
                    ✎
                  </IconButton>
                  <IconButton
                    label="Insert after"
                    onClick={() => goInsert(s.shot_number)}
                    disabled={busyId !== null}
                  >
                    +
                  </IconButton>
                  <IconButton
                    label="Delete shot"
                    onClick={() => del(s.id)}
                    disabled={busyId !== null}
                  >
                    ×
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-md bg-chalk text-court py-4 font-display font-bold text-sm tracking-[0.2em] uppercase"
        >
          Done editing
        </button>
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-8 h-8 rounded-sm border border-border bg-shadow text-ash hover:text-chalk hover:border-chalk disabled:opacity-40 font-mono text-sm flex items-center justify-center"
    >
      {children}
    </button>
  );
}
