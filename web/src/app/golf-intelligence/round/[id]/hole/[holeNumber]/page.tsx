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
        <span className="font-mono text-label text-ash tracking-[0.25em] uppercase">
          Loading round…
        </span>
      </div>
    );
  }

  if (session.error) {
    return (
      <div className="min-h-svh bg-background text-foreground flex items-center justify-center">
        <span className="font-mono text-label text-scarlet tracking-[0.25em] uppercase">
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

// py-3 keeps every primary target at 44px.
const primaryBtn =
  'w-full rounded-md bg-chalk text-court py-3 font-display font-bold text-sm tracking-[0.2em] uppercase select-none disabled:opacity-40';

/**
 * Three fixed bands: header, a scrollable body, and a commit zone.
 *
 * The page itself is exactly one viewport tall and never scrolls — only the
 * body does. That means (a) a committing button can never be scrolled onto,
 * because commits live outside the scroll region, (b) Save is always reachable
 * without scrolling, and (c) iOS Safari's URL bar never enters its
 * collapse/expand animation, since the document has nothing to scroll.
 *
 * `min-h-0` on the body is required: without it a flex child refuses to shrink
 * below its content and the region silently won't scroll.
 */
function Shell({
  header,
  commit,
  children,
}: {
  header: React.ReactNode;
  commit: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="h-svh overflow-hidden bg-background text-foreground">
      <div className="h-full max-w-md mx-auto px-4 flex flex-col">
        <div className="flex-none pt-2">{header}</div>
        <div className="flex-1 min-h-0 relative">
          <div className="h-full overflow-y-auto py-1.5 flex flex-col gap-2">
            {children}
          </div>
          {/* Fades the cut-off row at the boundary so an overflowing body reads
              as scrollable rather than clipped. Invisible when it doesn't. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-background to-transparent" />
        </div>
        {/* pb-6 keeps the primary button clear of the phone's bottom-edge
            swipe strip, where a tap near Save was landing on the system
            gesture instead. It has to be a fixed value: the root layout's
            viewport does not set viewportFit: 'cover', so env(safe-area-*)
            resolves to zero here. */}
        <div className="flex-none pt-2 pb-6 flex flex-col gap-2 border-t border-border">
          {commit}
        </div>
      </div>
    </div>
  );
}

/**
 * A distance field: label and the running value share one line, with the
 * keypad beneath. The value used to sit in its own bordered box below the
 * label, which cost a row for no extra information.
 */
function DistanceEntry({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono text-label tracking-[0.3em] uppercase text-ash">
          {label}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl leading-none text-chalk tracking-tight">
            {value || '—'}
          </span>
          <span className="font-mono text-label tracking-[0.25em] uppercase text-ash">
            {unit}
          </span>
        </span>
      </div>
      <NumericKeypad value={value} onChange={onChange} />
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function HeaderImpl({
  holeNumber,
  roundId,
  score,
  backToReview,
}: {
  holeNumber: number;
  roundId: string;
  score: ReturnType<ReturnType<typeof useRoundSession>['getRunningScore']>;
  /** True when this hole was opened from the round review screen. */
  backToReview: boolean;
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
        {/* Only a hole opened from the round review offers a way back to it.
            During the hole-by-hole loop the title stands alone: a link sharing
            this baseline row reads as the hole's state, not as navigation. */}
        {backToReview && (
          <Link
            href={`/golf-intelligence/round/${roundId}/review`}
            className="font-mono text-label tracking-[0.25em] uppercase text-ash hover:text-chalk whitespace-nowrap border border-border rounded-sm px-2 py-0.5"
          >
            ← Round review
          </Link>
        )}
        {!online && (
          <span
            className="font-mono text-label tracking-[0.2em] uppercase px-2 py-0.5 rounded-sm bg-shadow whitespace-nowrap shrink-0"
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
  // The hole's par and distance are entered on their own screen before shot 1.
  // Reopening that screen is the only way to correct either one once the hole
  // is under way — the distance is not a column, it is shot 1's
  // starting_distance, so there is nothing else to edit.
  const [editingSetup, setEditingSetup] = useState(false);

  const shotOne = hole?.shots.find((s) => s.shot_number === 1) ?? null;

  const openSetup = useCallback(() => {
    setForm((f) => ({
      ...f,
      teeDistanceInput: shotOne ? String(shotOne.starting_distance) : f.teeDistanceInput,
      warningDismissed: false,
    }));
    setEditingSetup(true);
  }, [shotOne]);

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
      !editingSetup &&
      hole &&
      hole.shots.length >= 1 &&
      form.teeDistanceInput !== ''
    ) {
      setForm((f) => ({ ...f, teeDistanceInput: '' }));
    }
  }, [mode, editingSetup, hole, form.teeDistanceInput]);

  // Editing shot 1 is editing the hole's starting distance: shot 1 has no
  // preceding shot to inherit from, so the field is the only source there is.
  const editingShot1Start =
    mode === 'edit' && editingShot !== null && editingShot.shot_number === 1;
  const startEditable = isFreshShot1 || editingSetup || editingShot1Start;

  const startingDistanceNum = startEditable
    ? form.teeDistanceInput === ''
      ? null
      : Number(form.teeDistanceInput)
    : inheritedDist;

  const startingUnit = unitFor(startingLie);
  const endingUnit = startingUnit;
  // The setup screen always measures the hole from the tee, whatever lie the
  // shot in progress happens to start from.
  const setupUnit = unitFor(shotOne?.starting_lie ?? 'Tee');

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
    (isFreshShot1 || editingSetup) &&
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
    (!startEditable || form.teeDistanceInput !== '') &&
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

  // Leaving the setup screen. On a hole that has already started, the corrected
  // distance is written straight onto shot 1; nothing downstream needs
  // recomputing, since cascadeFromShot only ever re-derives *later* shots from
  // an earlier one's ending distance.
  async function commitSetup() {
    const n = form.teeDistanceInput === '' ? null : Number(form.teeDistanceInput);
    if (n === null) return;
    if (hole && shotOne && shotOne.starting_distance !== n) {
      await session.updateShot(hole.holeId, {
        id: shotOne.id,
        starting_distance: n,
      });
    }
    setEditingSetup(false);
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
  const openingHole = isFreshShot1 && !setupDone;
  if (openingHole || editingSetup) {
    return (
      <Shell
        header={
          <Header
            holeNumber={holeNumber}
            roundId={roundId}
            score={score}
            backToReview={fromReview}
          />
        }
        commit={
          <button
            type="button"
            onClick={() => {
              if (openingHole) setSetupDone(true);
              else void commitSetup();
            }}
            disabled={!parSet || form.teeDistanceInput === ''}
            className={primaryBtn}
          >
            {openingHole ? 'Start hole →' : 'Save hole distance'}
          </button>
        }
      >
          {/* Hole par */}
          <div>
            <p className="font-mono text-label tracking-[0.25em] uppercase text-ash mb-1">
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
          <DistanceEntry
            label="Hole distance"
            unit={setupUnit}
            value={form.teeDistanceInput}
            onChange={setTeeDistance}
          />

          {warning && (
            <WarningCard warning={warning} onDismiss={dismissWarning} />
          )}

          {/* Starting location */}
          <div className="flex items-center justify-between border border-border bg-shadow rounded-md px-3 py-2">
            <span className="font-mono text-label tracking-[0.3em] uppercase text-ash">
              Starting from
            </span>
            <span
              className="font-display font-bold text-label tracking-[0.2em] uppercase px-2 py-1 rounded-sm"
              style={{ background: LIE_COLORS.Tee, color: 'var(--court)' }}
            >
              Tee
            </span>
          </div>

      </Shell>
    );
  }

  return (
    <Shell
      header={
        <Header
          holeNumber={holeNumber}
          roundId={roundId}
          score={score}
          backToReview={fromReview}
        />
      }
      commit={
        <>
          {/* Both committing actions live here, outside the scroll region, and
              fire on a completed tap. A drag that turns into a scroll is
              cancelled by the browser before click, so neither can be
              triggered by reaching in to scroll. */}
          {/* Deliberately smaller than Save and pushed to the right edge:
              same-width buttons stacked on one centre line made Holed easy to
              hit when Save was meant. Still a 36px target. */}
          <button
            type="button"
            onClick={onHoled}
            disabled={!parSet || saving}
            className={
              'self-end w-auto min-h-9 rounded-md border px-5 py-2 font-display font-bold text-label tracking-[0.2em] uppercase select-none disabled:opacity-40 ' +
              (holedSaving
                ? 'bg-chalk border-chalk text-pitch'
                : 'bg-obsidian border-border text-chalk active:bg-pitch active:border-chalk')
            }
          >
            {holedSaving ? 'Holed ✓' : 'Holed'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={primaryBtn}
          >
            {mode === 'edit'
              ? 'Save edit · Back'
              : mode === 'insert'
                ? 'Insert shot · Back'
                : 'Save shot · Next →'}
          </button>
        </>
      }
    >
          {/* Shot path + starting context on one compact block */}
          <div>
            {/* In edit mode on shot 1 there is no path yet, and an empty one
                renders a lone "shot 1 ›" marker that costs a row for nothing. */}
            {!isFreshShot1 && hole && completedShots.length > 0 && (
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <ShotPath shots={completedShots} activeShotNumber={shotOrder} />
                </div>
                {/* Rides on the path row rather than taking one of its own:
                    this screen is exactly one viewport tall and never scrolls. */}
                {mode === 'append' && shotOne && (
                  <button
                    type="button"
                    onClick={openSetup}
                    aria-label="Edit hole distance"
                    className="shrink-0 font-mono text-label tracking-[0.15em] uppercase text-ash hover:text-chalk border border-border rounded-sm px-2 py-1"
                  >
                    ✎ {shotOne.starting_distance} {setupUnit}
                  </button>
                )}
              </div>
            )}
            {/* Editing shot 1 is editing the hole's distance — there is no
                earlier shot for it to be inherited from, so the field belongs
                here rather than being shown read-only. */}
            {editingShot1Start ? (
              <DistanceEntry
                label="Hole distance"
                unit={startingUnit}
                value={form.teeDistanceInput}
                onChange={setTeeDistance}
              />
            ) : (
              <div className="flex items-center justify-between">
                {/* On shot 1 this row *is* the hole distance, so tapping it
                    reopens the setup screen where it was entered. */}
                <FromStrip
                  distance={startingDistanceNum}
                  unit={startingUnit}
                  lie={startingLie}
                  onEdit={isFreshShot1 ? openSetup : undefined}
                />
                <span className="font-mono text-label tracking-[0.3em] uppercase text-ash">
                  Shot {displayShotNumber}
                </span>
              </div>
            )}
          </div>

          {/* Ending distance + keypad */}
          <DistanceEntry
            label="Ending distance"
            unit={endingUnit}
            value={form.endingDistance}
            onChange={setEndingDistance}
          />

          {/* Ending lie — the penalty toggle rides on this label line rather
              than taking a row of its own. */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-mono text-label tracking-[0.3em] uppercase text-ash">
                Ending lie
              </span>
              <PenaltyToggle on={form.penalty} onChange={setPenalty} />
            </div>
            <LieGrid selected={form.endingLie} onChange={setEndingLie} />
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

    </Shell>
  );
}

function FromStrip({
  distance,
  unit,
  lie,
  onEdit,
}: {
  distance: number | null;
  unit: string;
  lie: Lie;
  onEdit?: () => void;
}) {
  const body = (
    <>
      <span className="font-mono text-label tracking-[0.3em] uppercase text-ash">
        From
      </span>
      <span className="font-display font-extrabold text-2xl text-chalk">
        {distance ?? '—'}
      </span>
      <span className="font-mono text-label tracking-[0.25em] uppercase text-ash">
        {unit}
      </span>
      <span
        className="font-display font-bold text-label tracking-[0.2em] uppercase px-2 py-1 rounded-sm"
        style={{ background: LIE_COLORS[lie], color: 'var(--court)' }}
      >
        {lie}
      </span>
      {onEdit && <span className="font-mono text-label text-ash">✎</span>}
    </>
  );
  if (!onEdit) {
    return <div className="flex items-baseline gap-2">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label="Edit hole distance"
      className="flex items-baseline gap-2 text-left"
    >
      {body}
    </button>
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
    <div className="flex items-center gap-3">
      <span className="font-mono text-label tracking-[0.3em] uppercase text-ash shrink-0 w-20">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2 flex-1">
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
              'rounded-md border py-2 min-h-11 font-display font-bold text-sm tracking-[0.15em] uppercase select-none touch-manipulation ' +
              (selected === o
                ? 'border-scarlet bg-scarlet-tint text-chalk'
                : 'border-border bg-shadow text-ash')
            }
          >
            {o}
          </button>
        ))}
      </div>
    </div>
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
        <p className="font-mono text-label text-cement mt-1 leading-snug">
          {warning.body}
        </p>
      </div>
    </div>
  );
}

// A compact chip that rides on the "Ending lie" label line instead of taking a
// full row. 44px tall so it stays a legitimate touch target at that size.
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
      aria-pressed={on}
      className={
        'flex items-center gap-2 rounded-md border px-3 h-11 select-none ' +
        (on
          ? 'border-scarlet bg-scarlet-tint'
          : 'border-border bg-shadow')
      }
    >
      <span
        className={
          'inline-block w-3 h-3 rounded-sm border ' +
          (on ? 'bg-scarlet border-scarlet' : 'border-ash')
        }
      />
      <span
        className={
          'font-display font-bold text-label tracking-[0.2em] uppercase ' +
          (on ? 'text-chalk' : 'text-ash')
        }
      >
        Penalty
      </span>
    </button>
  );
}
