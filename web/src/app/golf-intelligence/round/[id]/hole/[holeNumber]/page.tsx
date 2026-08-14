'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  strokeNumberForShot,
  useRoundSession,
  type HoleEntry,
} from '@/lib/golf/roundSession';
import { useOnlineStatus } from '@/lib/golf/offlineQueue';
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
const CLUB_CATEGORIES: ClubCategory[] = ['Driver', 'Non-driver'];
const MISS_DIRECTIONS: MissDirection[] = ['Left', 'Right'];
const PUTT_DIRECTIONS: PuttDirection[] = ['Long', 'Short'];
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
      <div className="min-h-svh bg-background text-foreground flex items-center justify-center">
        <span className="font-mono text-xs text-ash tracking-[0.25em] uppercase">
          Loading round…
        </span>
      </div>
    );
  }

  if (session.error) {
    return (
      <div className="min-h-svh bg-background text-foreground flex items-center justify-center">
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

function HeaderImpl({
  holeNumber,
  roundId,
  score,
}: {
  holeNumber: number;
  roundId: string;
  score: ReturnType<ReturnType<typeof useRoundSession>['getRunningScore']>;
}) {
  const online = useOnlineStatus();
  return (
    // The offline pill must never wrap this row to a second line: the par grid
    // and the keypad sit directly beneath it, and signal flapping on a course
    // would otherwise shift both mid-entry, under the player's finger.
    <header className="flex items-start justify-between gap-2 border-b border-border pb-2">
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="font-display font-extrabold text-3xl text-chalk uppercase tracking-tight whitespace-nowrap">
          Hole {holeNumber}
        </span>
        <Link
          href={`/golf-intelligence/round/${roundId}/review`}
          className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash hover:text-chalk whitespace-nowrap"
        >
          Review
        </Link>
        {!online && (
          <span
            className="font-mono text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-sm bg-shadow whitespace-nowrap shrink-0"
            style={{ color: COLOR_AMBER }}
            title="Offline · saving locally"
          >
            Offline
          </span>
        )}
      </div>
      <ScoreHeader front={score.front} back={score.back} total={score.total} />
    </header>
  );
}

const Header = memo(HeaderImpl);

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
  // Stable identity across form-only re-renders so the memoized header and
  // score row don't re-render on every keypad tap.
  const score = useMemo(() => session.getRunningScore(), [session]);

  const editStr = searchParams.get('edit');
  const insertStr = searchParams.get('insertAfter');
  const fromReview = searchParams.get('from') === 'review';
  const editOrder = editStr !== null ? Number(editStr) : null;
  const afterOrder = insertStr !== null ? Number(insertStr) : null;

  const editingShot: ShotRow | null = useMemo(() => {
    if (editOrder === null || !hole) return null;
    return hole.shots.find((s) => s.shot_number === editOrder) ?? null;
  }, [editOrder, hole]);

  const afterShot: ShotRow | null = useMemo(() => {
    if (afterOrder === null || !hole) return null;
    return hole.shots.find((s) => s.shot_number === afterOrder) ?? null;
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
    shotOrder = editingShot.shot_number;
    startingLie = editingShot.starting_lie;
    inheritedDist = editingShot.starting_distance;
  } else if (mode === 'insert' && afterShot) {
    shotOrder = afterShot.shot_number + 1;
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
        penalty: editingShot.has_penalty,
        warningDismissed: false,
      };
    }
    return {
      teeDistanceInput: '',
      endingDistance: '',
      // Once the ball is on the green it stays there; pre-select it.
      endingLie: startingLie === 'Green' ? 'Green' : null,
      clubCategory: null,
      missDirection: null,
      puttLongShort: null,
      penalty: false,
      warningDismissed: false,
    };
  });

  const [saving, setSaving] = useState(false);
  const [holedSaving, setHoledSaving] = useState(false);
  const [setupDone, setSetupDone] = useState(false);

  // When the course is in the database its par is known ahead of time;
  // pre-select it on the setup screen so the player only confirms.
  const coursePar = session.state.holePars[holeNumber];
  const autoParApplied = useRef(false);
  useEffect(() => {
    if (autoParApplied.current) return;
    if (isFreshShot1 && !parSet && coursePar) {
      autoParApplied.current = true;
      void session.setPar(holeNumber, coursePar);
    }
  }, [isFreshShot1, parSet, coursePar, session, holeNumber]);

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
  // Miss direction only applies to par 4 / par 5 tee shots. A penalty still
  // means the tee shot missed left or right even if the ending lie reads
  // Fairway — that lie reflects where the player dropped after the penalty,
  // not where the original ball ended up.
  const showMissDirection =
    startingLie === 'Tee' &&
    par !== null &&
    par >= 4 &&
    form.endingLie !== null &&
    (form.endingLie !== 'Fairway' || form.penalty);
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

  const setTeeDistance = useCallback((v: string) => {
    setForm((f) => ({ ...f, teeDistanceInput: v, warningDismissed: false }));
  }, []);
  const setEndingDistance = useCallback((v: string) => {
    setForm((f) => ({ ...f, endingDistance: v }));
  }, []);
  const setEndingLie = useCallback((lie: Lie) => {
    setForm((f) => ({ ...f, endingLie: lie }));
  }, []);
  const setClubCategory = useCallback((c: ClubCategory) => {
    setForm((f) => ({ ...f, clubCategory: c }));
  }, []);
  const setMissDirection = useCallback((m: MissDirection) => {
    setForm((f) => ({ ...f, missDirection: m }));
  }, []);
  const setPuttLongShort = useCallback((p: PuttDirection) => {
    setForm((f) => ({ ...f, puttLongShort: p }));
  }, []);
  const setPenalty = useCallback((v: boolean) => {
    setForm((f) => ({ ...f, penalty: v }));
  }, []);
  const dismissWarning = useCallback(() => {
    setForm((f) => ({ ...f, warningDismissed: true }));
  }, []);

  const canSave =
    !saving &&
    parSet &&
    form.endingDistance !== '' &&
    form.endingLie !== null &&
    (!isFreshShot1 || form.teeDistanceInput !== '') &&
    (!showClubCategory || form.clubCategory !== null);

  // setPar updates local state (and flushes the draft) synchronously; there is
  // nothing to wait on, so the tap must not be gated behind the promise.
  function handlePickPar(p: number) {
    void session.setPar(holeNumber, p);
  }

  async function persistAppend(endingLie: Lie, endingDistance: number) {
    if (!hole) return;
    if (startingDistanceNum === null) return;
    const insert: ShotInsert = {
      id: createId(),
      hole_id: hole.holeId,
      shot_number: shotOrder,
      starting_lie: startingLie,
      starting_distance: startingDistanceNum,
      ending_lie: endingLie,
      ending_distance: endingDistance,
      has_penalty: form.penalty,
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
      has_penalty: form.penalty,
      club_category: showClubCategory ? form.clubCategory : null,
      miss_direction: showMissDirection ? form.missDirection : null,
      putt_long_short: showPuttLongShort ? form.puttLongShort : null,
    });
    await session.cascadeFromShot(hole.holeId, shot.shot_number);
  }

  async function persistInsert(
    afterShotRow: ShotRow,
    endingLie: Lie,
    endingDistance: number,
  ) {
    if (!hole) return;
    await session.insertShotAfter(hole.holeId, afterShotRow.shot_number, {
      id: createId(),
      hole_id: hole.holeId,
      starting_lie: startingLie,
      starting_distance: startingDistanceNum ?? afterShotRow.ending_distance,
      ending_lie: endingLie,
      ending_distance: endingDistance,
      has_penalty: form.penalty,
      club_category: showClubCategory ? form.clubCategory : null,
      miss_direction: showMissDirection ? form.missDirection : null,
      putt_long_short: showPuttLongShort ? form.puttLongShort : null,
    });
  }

  // `from=review` means the player reached this hole from the round review
  // screen (a post-round correction), not from the hole-by-hole loop. It rides
  // along so the summary knows to send them back to the review instead of
  // walking them forward through the remaining holes.
  function summaryUrl() {
    const base = `/golf-intelligence/round/${roundId}/hole/${holeNumber}/summary`;
    // Edits and inserts are launched from the summary's shot list, so return
    // the player to that list — otherwise fixing a second shot on the same
    // hole means tapping "Edit shots" again every time.
    const params = [
      fromReview ? 'from=review' : null,
      mode === 'edit' || mode === 'insert' ? 'mode=editing' : null,
    ].filter(Boolean);
    return params.length > 0 ? `${base}?${params.join('&')}` : base;
  }

  function resetForNextShot() {
    setForm((f) => ({
      ...f,
      endingDistance: '',
      // The just-saved shot's ending lie is the next shot's starting lie;
      // a ball on the green stays on the green.
      endingLie: f.endingLie === 'Green' ? 'Green' : null,
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
    setHoledSaving(true);
    let navigated = false;
    try {
      if (mode === 'edit' && editingShot) {
        await persistEdit(editingShot, 'Green', 0);
      } else if (mode === 'insert' && afterShot) {
        await persistInsert(afterShot, 'Green', 0);
      } else {
        if (startingDistanceNum === null) {
          return;
        }
        await persistAppend('Green', 0);
      }
      router.push(summaryUrl());
      navigated = true;
    } finally {
      setSaving(false);
      // Keep the confirm style on through the navigation to the summary.
      if (!navigated) setHoledSaving(false);
    }
  }

  // Hole → summary → next hole are dynamic routes, so each push is a network
  // round-trip. Warm the two the player is about to take while they're still
  // entering shots; on a course with thin signal that's the difference between
  // an instant transition and a visible stall.
  useEffect(() => {
    router.prefetch(
      `/golf-intelligence/round/${roundId}/hole/${holeNumber}/summary`,
    );
    if (holeNumber < 18) {
      router.prefetch(
        `/golf-intelligence/round/${roundId}/hole/${holeNumber + 1}`,
      );
    }
    router.prefetch(`/golf-intelligence/round/${roundId}/review`);
  }, [router, roundId, holeNumber]);

  // LieGrid fires Holed from pointerdown; route it through a ref so the grid
  // keeps a stable prop and stays memoized across form-only re-renders.
  const holedRef = useRef(handleHoled);
  useEffect(() => {
    holedRef.current = handleHoled;
  });
  const onHoled = useCallback(() => {
    void holedRef.current();
  }, []);

  const completedShots: ShotPathShot[] = useMemo(
    () =>
      (hole?.shots ?? [])
        // Show only the path leading up to the shot being worked on: shots
        // after an edit point (or after an insertion point) haven't happened
        // yet from this screen's perspective.
        .filter((s) => {
          if (mode === 'edit' && editingShot) {
            return s.shot_number < editingShot.shot_number;
          }
          if (mode === 'insert' && afterShot) {
            return s.shot_number <= afterShot.shot_number;
          }
          return true;
        })
        .map((s) => ({
          startingDistance: s.starting_distance,
          startingLie: s.starting_lie,
          endingDistance: s.ending_distance,
          endingLie: s.ending_lie,
          holed: s.ending_lie === 'Green' && s.ending_distance === 0,
        })),
    [hole, mode, editingShot, afterShot],
  );

  const displayShotNumber = strokeNumberForShot(hole?.shots ?? [], shotOrder);

  // ── Hole setup: par + hole distance get their own screen ──────────────────
  if (isFreshShot1 && !setupDone) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <div className="max-w-md mx-auto px-4 pt-3 pb-4 flex flex-col gap-3">
          <Header holeNumber={holeNumber} roundId={roundId} score={score} />

          {/* Hole par */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash mb-1">
              Hole par
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAR_CHOICES.map((p) => {
                const selected = par === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handlePickPar(p);
                    }}
                    className={
                      'rounded-md py-3 select-none touch-manipulation ' +
                      (selected
                        ? 'border border-scarlet bg-scarlet-tint'
                        : 'border border-border bg-shadow active:bg-pitch')
                    }
                  >
                    <div
                      className={
                        'font-display font-extrabold text-2xl leading-none ' +
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

          {/* Hole distance */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
                Hole distance
              </span>
              <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash">
                {startingUnit}
              </span>
            </div>
            <NumericKeypad
              value={form.teeDistanceInput}
              onChange={setTeeDistance}
            />
          </div>

          {warning && (
            <WarningCard warning={warning} onDismiss={dismissWarning} />
          )}

          {/* Starting location */}
          <div className="flex items-center justify-between border border-border bg-shadow rounded-md px-3 py-2">
            <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
              Starting from
            </span>
            <span
              className="font-display font-bold text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded-sm"
              style={{ background: LIE_COLORS.Tee, color: '#0C0C0C' }}
            >
              Tee
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSetupDone(true)}
            disabled={!parSet || form.teeDistanceInput === ''}
            className="w-full rounded-md bg-chalk text-court py-3 font-display font-bold text-sm tracking-[0.2em] uppercase disabled:opacity-40"
          >
            Start hole →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="max-w-md mx-auto px-4 pt-3 pb-4 flex flex-col gap-3">
        <Header holeNumber={holeNumber} roundId={roundId} score={score} />

        <div className="flex flex-col gap-3">
          {/* Shot path + starting context on one compact block */}
          <div>
            {!isFreshShot1 && hole && (
              <div className="mb-2">
                <ShotPath shots={completedShots} activeShotNumber={shotOrder} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
                  From
                </span>
                <span className="font-display font-extrabold text-2xl text-chalk">
                  {startingDistanceNum ?? '—'}
                </span>
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash">
                  {startingUnit}
                </span>
                <span
                  className="font-display font-bold text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded-sm"
                  style={{ background: LIE_COLORS[startingLie], color: '#0C0C0C' }}
                >
                  {startingLie}
                </span>
              </div>
              <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
                Shot {displayShotNumber}
              </span>
            </div>
          </div>

          {/* Ending distance + keypad */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
                Ending distance
              </span>
              <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash">
                {endingUnit}
              </span>
            </div>
            <NumericKeypad
              value={form.endingDistance}
              onChange={setEndingDistance}
            />
          </div>

          {/* Ending lie */}
          <div>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-1">
              Ending lie
            </p>
            <LieGrid
              selected={form.endingLie}
              onChange={setEndingLie}
              showHoled
              onHoled={onHoled}
              holedActive={holedSaving}
            />
          </div>

          <ConditionalBlock show={showClubCategory}>
            <ChoiceRow
              label="Club category"
              options={CLUB_CATEGORIES}
              selected={form.clubCategory}
              onSelect={setClubCategory}
            />
          </ConditionalBlock>

          <ConditionalBlock show={showMissDirection}>
            <ChoiceRow
              label="Miss direction"
              options={MISS_DIRECTIONS}
              selected={form.missDirection}
              onSelect={setMissDirection}
            />
          </ConditionalBlock>

          <ConditionalBlock show={showPuttLongShort}>
            <ChoiceRow
              label="Putt long / short"
              options={PUTT_DIRECTIONS}
              selected={form.puttLongShort}
              onSelect={setPuttLongShort}
            />
          </ConditionalBlock>

          <PenaltyToggle on={form.penalty} onChange={setPenalty} />

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full rounded-md bg-chalk text-court py-3 font-display font-bold text-sm tracking-[0.2em] uppercase disabled:opacity-40"
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

// The three conditional follow-ups (club / miss / putt) are the same control;
// like the lie grid they commit on pointerdown so a touch lands immediately.
function ChoiceRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <>
      <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-1">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (typeof navigator !== 'undefined') navigator.vibrate?.(10);
              onSelect(o);
            }}
            className={
              'rounded-md border py-2 font-display font-bold text-sm tracking-[0.15em] uppercase select-none touch-manipulation ' +
              (selected === o
                ? 'border-scarlet bg-scarlet-tint text-chalk'
                : 'border-border bg-shadow text-ash')
            }
          >
            {o}
          </button>
        ))}
      </div>
    </>
  );
}

// Renders nothing at all when hidden, rather than animating max-height.
// The animated version sat directly above the Save button and, because lies
// commit on pointerdown, collapsed in the same frame as the touch — moving the
// button while the player was aiming at it. It also left the collapsed
// controls in the DOM and keyboard-focusable, and cost its flex gap even when
// shut. Instant beats animated on a data-entry screen.
function ConditionalBlock({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return <div>{children}</div>;
}

function WarningCard({
  warning,
  onDismiss,
}: {
  warning: { title: string; body: string };
  onDismiss: () => void;
}) {
  return (
    <div
      className="rounded-md px-4 py-3 flex items-start gap-3"
      style={{ border: `1px solid ${COLOR_AMBER}` }}
    >
      <button
        type="button"
        onClick={onDismiss}
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
      className="w-full flex items-center justify-between border border-border bg-shadow rounded-md px-3 py-2"
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
