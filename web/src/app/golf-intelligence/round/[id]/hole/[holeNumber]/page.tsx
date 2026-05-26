'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useRoundSession, type HoleEntry } from '@/lib/golf/roundSession';
import { ScoreHeader } from '@/components/golf/ScoreHeader';
import { ShotPath, type ShotPathShot } from '@/components/golf/ShotPath';
import { NumericKeypad } from '@/components/golf/NumericKeypad';
import { LieGrid } from '@/components/golf/LieGrid';
import { LIE_COLORS } from '@/lib/golf/utils/lieColors';
import { createId } from '@/lib/golf/utils/uuid';
import type {
  ClubCategory,
  Lie,
  MissDirection,
  PuttDirection,
  ShotInsert,
  ShotRow,
} from '@/lib/golf/db/types';

const PAR_CHOICES = [3, 4, 5] as const;
const COLOR_AMBER = '#F09020';

function unitFor(lie: Lie): 'YDS' | 'FT' {
  return lie === 'Green' ? 'FT' : 'YDS';
}

function mismatchWarning(
  par: number,
  distance: number,
): { title: string; body: string } | null {
  if (par === 3 && distance > 250)
    return {
      title: `THAT'S A LONG PAR 3`,
      body: `${distance} yards is unusual for a par 3. Confirm or change par above.`,
    };
  if (par === 4 && distance > 525)
    return {
      title: `THAT'S A LONG PAR 4`,
      body: `${distance} yards is unusual for a par 4. Confirm or change par above.`,
    };
  if (par === 4 && distance < 250)
    return {
      title: `THAT'S A SHORT PAR 4`,
      body: `${distance} yards is unusual for a par 4. Confirm or change par above.`,
    };
  if (par === 5 && distance < 450)
    return {
      title: `THAT'S A SHORT PAR 5`,
      body: `${distance} yards is unusual for a par 5. Confirm or change par above.`,
    };
  return null;
}

export default function HolePage() {
  const params = useParams<{ id: string; holeNumber: string }>();
  const session = useRoundSession();
  const searchParams = useSearchParams();

  const roundId = params?.id ?? '';
  const holeNumber = Number(params?.holeNumber ?? '1');

  if (session.loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <span className="font-mono text-xs text-ash tracking-[0.25em] uppercase">
          Loading round…
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

  const hole = session.getHole(holeNumber);

  return (
    <ShotEntry
      key={`hole-${holeNumber}|${searchParams.toString()}`}
      roundId={roundId}
      holeNumber={holeNumber}
      hole={hole}
    />
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function Header({
  holeNumber,
  roundId,
  score,
}: {
  holeNumber: number;
  roundId: string;
  score: ReturnType<ReturnType<typeof useRoundSession>['getRunningScore']>;
}) {
  return (
    <header className="flex items-start justify-between border-b border-border pb-3">
      <div className="flex items-baseline gap-3">
        <span className="font-display font-extrabold text-3xl text-chalk uppercase tracking-tight">
          Hole {holeNumber}
        </span>
        <Link
          href={`/golf-intelligence/round/${roundId}/review`}
          className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash hover:text-chalk"
        >
          Review
        </Link>
      </div>
      <ScoreHeader front={score.front} back={score.back} total={score.total} />
    </header>
  );
}

// ─── Shot Entry ─────────────────────────────────────────────────────────────

interface FormState {
  teeDistanceInput: string;
  endingDistance: string;
  endingLie: Lie | null;
  clubCategory: ClubCategory | null;
  missDirection: MissDirection | null;
  puttLongShort: PuttDirection | null;
  penalty: boolean;
  warningDismissed: boolean;
}

function ShotEntry({
  roundId,
  holeNumber,
  hole,
}: {
  roundId: string;
  holeNumber: number;
  hole: HoleEntry | undefined;
}) {
  const session = useRoundSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const score = session.getRunningScore();

  const editStr = searchParams.get('edit');
  const insertStr = searchParams.get('insertAfter');
  const editOrder = editStr !== null ? Number(editStr) : null;
  const afterOrder = insertStr !== null ? Number(insertStr) : null;

  const editingShot: ShotRow | null = useMemo(() => {
    if (editOrder === null || !hole) return null;
    return hole.shots.find((s) => s.shot_order === editOrder) ?? null;
  }, [editOrder, hole]);

  const afterShot: ShotRow | null = useMemo(() => {
    if (afterOrder === null || !hole) return null;
    return hole.shots.find((s) => s.shot_order === afterOrder) ?? null;
  }, [afterOrder, hole]);

  const mode: 'append' | 'edit' | 'insert' = editingShot
    ? 'edit'
    : afterShot
      ? 'insert'
      : 'append';

  const par = hole?.par ?? null;
  const parSet = par !== null;

  // Derive starting context
  let shotOrder: number;
  let startingLie: Lie;
  let inheritedDist: number | null;

  if (mode === 'edit' && editingShot) {
    shotOrder = editingShot.shot_order;
    startingLie = editingShot.starting_lie;
    inheritedDist = editingShot.starting_distance;
  } else if (mode === 'insert' && afterShot) {
    shotOrder = afterShot.shot_order + 1;
    startingLie = afterShot.ending_lie;
    inheritedDist = afterShot.ending_distance;
  } else {
    // append
    shotOrder = (hole?.shots.length ?? 0) + 1;
    if (!hole || hole.shots.length === 0) {
      startingLie = 'Tee';
      inheritedDist = null;
    } else {
      const prev = hole.shots[hole.shots.length - 1];
      startingLie = prev.ending_lie;
      inheritedDist = prev.ending_distance;
    }
  }

  const isFreshShot1 = mode === 'append' && shotOrder === 1;

  const [form, setForm] = useState<FormState>(() => {
    if (mode === 'edit' && editingShot) {
      return {
        teeDistanceInput: String(editingShot.starting_distance),
        endingDistance: String(editingShot.ending_distance),
        endingLie: editingShot.ending_lie,
        clubCategory: editingShot.club_category,
        missDirection: editingShot.miss_direction,
        puttLongShort: editingShot.putt_long_short,
        penalty: editingShot.penalty,
        warningDismissed: false,
      };
    }
    return {
      teeDistanceInput: '',
      endingDistance: '',
      endingLie: null,
      clubCategory: null,
      missDirection: null,
      puttLongShort: null,
      penalty: false,
      warningDismissed: false,
    };
  });

  const [saving, setSaving] = useState(false);
  const [parBusy, setParBusy] = useState(false);

  // After a successful append save, hole.shots grows; if we just transitioned
  // from shot 1 to shot 2 we should clear the tee-distance input so the
  // standard layout doesn't carry stale state.
  useEffect(() => {
    if (
      mode === 'append' &&
      hole &&
      hole.shots.length >= 1 &&
      form.teeDistanceInput !== ''
    ) {
      setForm((f) => ({ ...f, teeDistanceInput: '' }));
    }
  }, [mode, hole, form.teeDistanceInput]);

  const startingDistanceNum = isFreshShot1
    ? form.teeDistanceInput === ''
      ? null
      : Number(form.teeDistanceInput)
    : inheritedDist;

  const startingUnit = unitFor(startingLie);
  const endingUnit = startingUnit;

  // Conditional triggers
  const showClubCategory =
    shotOrder === 1 && startingDistanceNum !== null && startingDistanceNum >= 250;
  const showMissDirection =
    startingLie === 'Tee' &&
    form.endingLie !== null &&
    form.endingLie !== 'Fairway';
  const showPuttLongShort =
    startingLie === 'Green' &&
    startingDistanceNum !== null &&
    startingDistanceNum >= 8;

  const warning =
    isFreshShot1 &&
    parSet &&
    startingDistanceNum !== null &&
    !form.warningDismissed
      ? mismatchWarning(par as number, startingDistanceNum)
      : null;

  const canSave =
    !saving &&
    parSet &&
    form.endingDistance !== '' &&
    form.endingLie !== null &&
    (!isFreshShot1 || form.teeDistanceInput !== '') &&
    (!showClubCategory || form.clubCategory !== null);

  async function handlePickPar(p: number) {
    if (parBusy) return;
    setParBusy(true);
    try {
      await session.setPar(holeNumber, p);
    } finally {
      setParBusy(false);
    }
  }

  async function persistAppend(endingLie: Lie, endingDistance: number) {
    if (!hole) return;
    if (startingDistanceNum === null) return;
    const insert: ShotInsert = {
      id: createId(),
      hole_id: hole.holeId,
      shot_order: shotOrder,
      starting_lie: startingLie,
      starting_distance: startingDistanceNum,
      ending_lie: endingLie,
      ending_distance: endingDistance,
      penalty: form.penalty,
      club_category: showClubCategory ? form.clubCategory : null,
      miss_direction: showMissDirection ? form.missDirection : null,
      putt_long_short: showPuttLongShort ? form.puttLongShort : null,
    };
    await session.saveShot(insert);
  }

  async function persistEdit(
    shot: ShotRow,
    endingLie: Lie,
    endingDistance: number,
  ) {
    if (!hole) return;
    await session.updateShot(hole.holeId, {
      id: shot.id,
      starting_lie: startingLie,
      starting_distance: startingDistanceNum ?? shot.starting_distance,
      ending_lie: endingLie,
      ending_distance: endingDistance,
      penalty: form.penalty,
      club_category: showClubCategory ? form.clubCategory : null,
      miss_direction: showMissDirection ? form.missDirection : null,
      putt_long_short: showPuttLongShort ? form.puttLongShort : null,
    });
    await session.cascadeFromShot(hole.holeId, shot.shot_order);
  }

  async function persistInsert(
    afterShotRow: ShotRow,
    endingLie: Lie,
    endingDistance: number,
  ) {
    if (!hole) return;
    await session.insertShotAfter(hole.holeId, afterShotRow.shot_order, {
      id: createId(),
      hole_id: hole.holeId,
      starting_lie: startingLie,
      starting_distance: startingDistanceNum ?? afterShotRow.ending_distance,
      ending_lie: endingLie,
      ending_distance: endingDistance,
      penalty: form.penalty,
      club_category: showClubCategory ? form.clubCategory : null,
      miss_direction: showMissDirection ? form.missDirection : null,
      putt_long_short: showPuttLongShort ? form.puttLongShort : null,
    });
  }

  function summaryUrl() {
    return `/golf-intelligence/round/${roundId}/hole/${holeNumber}/summary`;
  }

  function resetForNextShot() {
    setForm((f) => ({
      ...f,
      endingDistance: '',
      endingLie: null,
      clubCategory: null,
      missDirection: null,
      puttLongShort: null,
      penalty: false,
    }));
  }

  async function handleSave() {
    if (!canSave) return;
    const endingLie = form.endingLie as Lie;
    const endingDistance = Number(form.endingDistance);
    setSaving(true);
    try {
      if (mode === 'edit' && editingShot) {
        await persistEdit(editingShot, endingLie, endingDistance);
        router.push(summaryUrl());
        return;
      }
      if (mode === 'insert' && afterShot) {
        await persistInsert(afterShot, endingLie, endingDistance);
        router.push(summaryUrl());
        return;
      }
      await persistAppend(endingLie, endingDistance);
      const holed = endingLie === 'Green' && endingDistance === 0;
      if (holed) {
        router.push(summaryUrl());
      } else {
        resetForNextShot();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleHoled() {
    if (saving || !parSet) return;
    setSaving(true);
    try {
      if (mode === 'edit' && editingShot) {
        await persistEdit(editingShot, 'Green', 0);
      } else if (mode === 'insert' && afterShot) {
        await persistInsert(afterShot, 'Green', 0);
      } else {
        if (startingDistanceNum === null) {
          setSaving(false);
          return;
        }
        await persistAppend('Green', 0);
      }
      router.push(summaryUrl());
    } finally {
      setSaving(false);
    }
  }

  const completedShots: ShotPathShot[] = (hole?.shots ?? [])
    .filter((s) =>
      mode === 'edit' && editingShot ? s.shot_order < editingShot.shot_order : true,
    )
    .map((s) => ({
      startingDistance: s.starting_distance,
      startingLie: s.starting_lie,
      endingDistance: s.ending_distance,
      endingLie: s.ending_lie,
      holed: s.ending_lie === 'Green' && s.ending_distance === 0,
    }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto p-4 flex flex-col gap-5">
        <Header holeNumber={holeNumber} roundId={roundId} score={score} />

        {/* HOLE PAR — only on fresh shot 1 */}
        {isFreshShot1 && (
          <div className="border-b border-border pb-5">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash mb-3">
              Hole par
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAR_CHOICES.map((p) => {
                const selected = par === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePickPar(p)}
                    disabled={parBusy}
                    className={
                      'rounded-md py-5 disabled:opacity-50 ' +
                      (selected
                        ? 'border border-scarlet bg-scarlet-tint'
                        : 'border border-border bg-shadow active:bg-pitch')
                    }
                  >
                    <div
                      className={
                        'font-display font-extrabold text-3xl leading-none ' +
                        (selected ? 'text-scarlet' : 'text-chalk')
                      }
                    >
                      {p}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sections below are gated by parSet on fresh shot 1 */}
        <div
          className={
            isFreshShot1 && !parSet
              ? 'opacity-30 pointer-events-none flex flex-col gap-5'
              : 'flex flex-col gap-5'
          }
        >
          {/* THIS HOLE shot path — hidden on fresh shot 1 (nothing to show yet) */}
          {!isFreshShot1 && hole && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-2">
                This hole
              </p>
              <ShotPath shots={completedShots} activeShotNumber={shotOrder} />
            </div>
          )}

          {/* Starting from */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
                Starting from
              </p>
              {isFreshShot1 ? (
                <div className="mt-1 flex items-baseline gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={9999}
                    placeholder="—"
                    value={form.teeDistanceInput}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        teeDistanceInput: e.target.value.replace(/[^0-9]/g, ''),
                        warningDismissed: false,
                      }))
                    }
                    className="font-display font-extrabold text-3xl text-chalk bg-transparent border-0 outline-none w-24 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash">
                    {startingUnit}
                  </span>
                </div>
              ) : (
                <p className="mt-1">
                  <span className="font-display font-extrabold text-3xl text-chalk">
                    {inheritedDist ?? '—'}
                  </span>{' '}
                  <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash">
                    {startingUnit}
                  </span>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end">
              <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
                Shot {shotOrder}
              </p>
              <div
                className="mt-1 font-display font-bold text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded-sm"
                style={{ background: LIE_COLORS[startingLie], color: '#0C0C0C' }}
              >
                {startingLie}
              </div>
            </div>
          </div>

          {/* Soft warning card */}
          {warning && (
            <div
              className="rounded-md px-4 py-3 flex items-start gap-3"
              style={{ border: `1px solid ${COLOR_AMBER}` }}
            >
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, warningDismissed: true }))
                }
                aria-label="Dismiss warning"
                className="mt-0.5 w-4 h-4 rounded-sm shrink-0"
                style={{ border: `1px solid ${COLOR_AMBER}` }}
              />
              <div className="flex-1">
                <p
                  className="font-display font-bold text-sm tracking-[0.1em] uppercase"
                  style={{ color: COLOR_AMBER }}
                >
                  {warning.title}
                </p>
                <p className="font-mono text-[11px] text-cement mt-1 leading-snug">
                  {warning.body}
                </p>
              </div>
            </div>
          )}

          {/* Ending distance + keypad */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
                Ending distance
              </span>
              <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash">
                {endingUnit}
              </span>
            </div>
            <NumericKeypad
              value={form.endingDistance}
              onChange={(v) => setForm((f) => ({ ...f, endingDistance: v }))}
            />
          </div>

          {/* Ending lie */}
          <div>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-2">
              Ending lie
            </p>
            <LieGrid
              selected={form.endingLie}
              onChange={(lie) => setForm((f) => ({ ...f, endingLie: lie }))}
              showHoled
              onHoled={handleHoled}
            />
          </div>

          <ConditionalBlock show={showClubCategory}>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-2">
              Club category
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['Driver', 'Non-driver'] as ClubCategory[]).map((c) => {
                const active = form.clubCategory === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, clubCategory: c }))}
                    className={
                      active
                        ? 'rounded-md border border-scarlet bg-scarlet-tint py-3 font-display font-bold text-sm tracking-[0.15em] uppercase text-chalk'
                        : 'rounded-md border border-border bg-shadow py-3 font-display font-bold text-sm tracking-[0.15em] uppercase text-ash'
                    }
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </ConditionalBlock>

          <ConditionalBlock show={showMissDirection}>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-2">
              Miss direction
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['Left', 'Right'] as MissDirection[]).map((m) => {
                const active = form.missDirection === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, missDirection: m }))}
                    className={
                      active
                        ? 'rounded-md border border-scarlet bg-scarlet-tint py-3 font-display font-bold text-sm tracking-[0.15em] uppercase text-chalk'
                        : 'rounded-md border border-border bg-shadow py-3 font-display font-bold text-sm tracking-[0.15em] uppercase text-ash'
                    }
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </ConditionalBlock>

          <ConditionalBlock show={showPuttLongShort}>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-2">
              Putt long / short
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['Long', 'Short'] as PuttDirection[]).map((p) => {
                const active = form.puttLongShort === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, puttLongShort: p }))}
                    className={
                      active
                        ? 'rounded-md border border-scarlet bg-scarlet-tint py-3 font-display font-bold text-sm tracking-[0.15em] uppercase text-chalk'
                        : 'rounded-md border border-border bg-shadow py-3 font-display font-bold text-sm tracking-[0.15em] uppercase text-ash'
                    }
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </ConditionalBlock>

          <PenaltyToggle
            on={form.penalty}
            onChange={(v) => setForm((f) => ({ ...f, penalty: v }))}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full rounded-md bg-chalk text-court py-4 font-display font-bold text-sm tracking-[0.2em] uppercase disabled:opacity-40"
          >
            {mode === 'edit'
              ? 'Save edit · Back'
              : mode === 'insert'
                ? 'Insert shot · Back'
                : 'Save shot · Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConditionalBlock({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        'overflow-hidden transition-[max-height,opacity] duration-200 ' +
        (show ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0')
      }
    >
      {children}
    </div>
  );
}

function PenaltyToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="w-full flex items-center justify-between border border-border bg-shadow rounded-md px-3 py-3"
    >
      <span className="flex items-center gap-2">
        <span
          className={
            'inline-block w-3 h-3 rounded-sm border ' +
            (on ? 'bg-scarlet border-scarlet' : 'border-ash')
          }
        />
        <span className="font-display font-bold text-[12px] tracking-[0.2em] uppercase text-ash">
          Penalty on this shot
        </span>
      </span>
      <span
        className={
          'relative inline-block w-10 h-5 rounded-full transition-colors ' +
          (on ? 'bg-scarlet' : 'bg-pitch')
        }
      >
        <span
          className={
            'absolute top-0.5 w-4 h-4 rounded-full bg-chalk transition-all ' +
            (on ? 'left-[22px]' : 'left-0.5')
          }
        />
      </span>
    </button>
  );
}
