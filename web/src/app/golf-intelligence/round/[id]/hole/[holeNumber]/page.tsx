'use client';

import { useEffect, useMemo, useState } from 'react';
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

function unitFor(lie: Lie): 'YDS' | 'FT' {
  return lie === 'Green' ? 'FT' : 'YDS';
}

function mismatchMessage(par: number, distance: number): string | null {
  if (par === 3 && distance > 250) return `Long for a par 3 (${distance} yds)`;
  if (par === 4 && distance > 525) return `Long for a par 4 (${distance} yds)`;
  if (par === 4 && distance < 250) return `Short for a par 4 (${distance} yds)`;
  if (par === 5 && distance < 450) return `Short for a par 5 (${distance} yds)`;
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

  if (!hole) {
    return <ParGate holeNumber={holeNumber} />;
  }

  return (
    <ShotEntry
      key={`${hole.holeId}|${searchParams.toString()}`}
      roundId={roundId}
      hole={hole}
    />
  );
}

// ─── Par Gate ───────────────────────────────────────────────────────────────

function ParGate({ holeNumber }: { holeNumber: number }) {
  const session = useRoundSession();
  const suggestedPar = session.state.holePars[holeNumber] ?? null;
  const [busy, setBusy] = useState(false);
  const score = session.getRunningScore();

  async function pick(par: number) {
    if (busy) return;
    setBusy(true);
    try {
      await session.setPar(holeNumber, par);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto p-4 flex flex-col gap-5">
        <Header holeNumber={holeNumber} editing={false} complete={false} score={score} />

        {/* Par gate band */}
        <div className="border-b border-border pb-5">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-scarlet text-center mb-3">
            Set hole par to continue
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PAR_CHOICES.map((p) => {
              const suggested = suggestedPar === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => pick(p)}
                  disabled={busy}
                  className={
                    suggested
                      ? 'rounded-md border border-scarlet bg-scarlet-tint py-4 disabled:opacity-50'
                      : 'rounded-md border border-border bg-shadow py-4 disabled:opacity-50 active:bg-pitch'
                  }
                >
                  <div className="font-display font-extrabold text-3xl text-chalk leading-none">
                    {p}
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash mt-2">
                    Par {p}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dimmed preview */}
        <div className="opacity-30 pointer-events-none flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
                Starting from
              </p>
              <p className="font-display font-extrabold text-3xl text-chalk mt-1">
                — <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash">YDS</span>
              </p>
            </div>
            <div className="flex flex-col items-end">
              <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">Shot 1</p>
              <div
                className="mt-1 font-display font-bold text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded-sm"
                style={{ background: LIE_COLORS.Tee, color: '#0C0C0C' }}
              >
                Tee
              </div>
            </div>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-2">
              Ending distance
            </p>
            <div className="border border-border rounded-md bg-shadow px-4 py-6 text-center mb-3">
              <span className="font-mono text-5xl text-chalk">—</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <div
                  key={d}
                  className="bg-shadow border border-border rounded-md py-4 font-mono text-2xl text-chalk text-center"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function Header({
  holeNumber,
  editing,
  complete,
  score,
}: {
  holeNumber: number;
  editing: boolean;
  complete: boolean;
  score: ReturnType<ReturnType<typeof useRoundSession>['getRunningScore']>;
}) {
  return (
    <header className="flex items-start justify-between border-b border-border pb-3">
      <div className="flex items-baseline gap-3">
        <span className="font-display font-extrabold text-3xl text-chalk uppercase tracking-tight">
          Hole {holeNumber}
        </span>
        {editing && (
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-scarlet">
            Editing
          </span>
        )}
        {complete && !editing && (
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash">
            · Complete
          </span>
        )}
      </div>
      <ScoreHeader front={score.front} back={score.back} total={score.total} />
    </header>
  );
}

// ─── Shot Entry ─────────────────────────────────────────────────────────────

interface FormState {
  startingDistanceInput: string;
  endingDistance: string;
  endingLie: Lie | null;
  clubCategory: ClubCategory | null;
  missDirection: MissDirection | null;
  puttLongShort: PuttDirection | null;
  penalty: boolean;
  keypadField: 'starting' | 'ending';
  warningDismissed: boolean;
}

function ShotEntry({ roundId, hole }: { roundId: string; hole: HoleEntry }) {
  const session = useRoundSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const score = session.getRunningScore();

  const editStr = searchParams.get('edit');
  const insertStr = searchParams.get('insertAfter');
  const editOrder = editStr !== null ? Number(editStr) : null;
  const afterOrder = insertStr !== null ? Number(insertStr) : null;

  const editingShot: ShotRow | null = useMemo(() => {
    if (editOrder === null) return null;
    return hole.shots.find((s) => s.shot_order === editOrder) ?? null;
  }, [editOrder, hole.shots]);

  const afterShot: ShotRow | null = useMemo(() => {
    if (afterOrder === null) return null;
    return hole.shots.find((s) => s.shot_order === afterOrder) ?? null;
  }, [afterOrder, hole.shots]);

  const mode: 'append' | 'edit' | 'insert' = editingShot
    ? 'edit'
    : afterShot
      ? 'insert'
      : 'append';

  // Derive starting context for the current shot
  let shotOrder: number;
  let startingLie: Lie;
  let inheritedDist: number | null;
  let startingEditable: boolean;

  if (mode === 'edit' && editingShot) {
    shotOrder = editingShot.shot_order;
    startingLie = editingShot.starting_lie;
    inheritedDist = editingShot.starting_distance;
    startingEditable = editingShot.shot_order === 1;
  } else if (mode === 'insert' && afterShot) {
    shotOrder = afterShot.shot_order + 1;
    startingLie = afterShot.ending_lie;
    inheritedDist = afterShot.ending_distance;
    startingEditable = false;
  } else {
    shotOrder = hole.shots.length + 1;
    if (hole.shots.length === 0) {
      startingLie = 'Tee';
      inheritedDist = null;
      startingEditable = true;
    } else {
      const prev = hole.shots[hole.shots.length - 1];
      startingLie = prev.ending_lie;
      inheritedDist = prev.ending_distance;
      startingEditable = false;
    }
  }

  const [form, setForm] = useState<FormState>(() => {
    if (mode === 'edit' && editingShot) {
      return {
        startingDistanceInput: String(editingShot.starting_distance),
        endingDistance: String(editingShot.ending_distance),
        endingLie: editingShot.ending_lie,
        clubCategory: editingShot.club_category,
        missDirection: editingShot.miss_direction,
        puttLongShort: editingShot.putt_long_short,
        penalty: editingShot.penalty,
        keypadField: 'ending',
        warningDismissed: false,
      };
    }
    return {
      startingDistanceInput: '',
      endingDistance: '',
      endingLie: null,
      clubCategory: null,
      missDirection: null,
      puttLongShort: null,
      penalty: false,
      keypadField: startingEditable ? 'starting' : 'ending',
      warningDismissed: false,
    };
  });

  const [saving, setSaving] = useState(false);

  // Lock keypad to 'ending' whenever starting isn't editable
  useEffect(() => {
    if (!startingEditable && form.keypadField === 'starting') {
      setForm((f) => ({ ...f, keypadField: 'ending' }));
    }
  }, [startingEditable, form.keypadField]);

  const startingDistanceNum = startingEditable
    ? form.startingDistanceInput === ''
      ? null
      : Number(form.startingDistanceInput)
    : inheritedDist;

  const startingUnit = unitFor(startingLie);
  const endingUnit = startingUnit; // unit follows the shot's starting lie

  // Conditional field triggers
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

  // Mismatch warning (shot 1 only)
  const warning =
    shotOrder === 1 && startingDistanceNum !== null && !form.warningDismissed
      ? mismatchMessage(hole.par, startingDistanceNum)
      : null;

  // Save validity
  const canSave =
    !saving &&
    form.endingDistance !== '' &&
    form.endingLie !== null &&
    (!startingEditable || form.startingDistanceInput !== '') &&
    (!showClubCategory || form.clubCategory !== null);

  function dismissWarning() {
    if (warning) setForm((f) => ({ ...f, warningDismissed: true }));
  }

  function setKeypadValue(v: string) {
    setForm((f) =>
      f.keypadField === 'starting'
        ? { ...f, startingDistanceInput: v }
        : { ...f, endingDistance: v },
    );
  }

  async function persistAppend(endingLie: Lie, endingDistance: number) {
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
    return `/golf-intelligence/round/${roundId}/hole/${hole.holeNumber}/summary`;
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
      keypadField: 'ending',
      warningDismissed: f.warningDismissed,
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
    if (saving) return;
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

  const completedShots: ShotPathShot[] = hole.shots
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
    <div className="min-h-screen bg-background text-foreground" onClick={dismissWarning}>
      <div className="max-w-md mx-auto p-4 flex flex-col gap-5">
        <Header holeNumber={hole.holeNumber} editing={false} complete={false} score={score} />

        {/* THIS HOLE shot path */}
        <div>
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-2">
            This hole
          </p>
          <ShotPath shots={completedShots} activeShotNumber={shotOrder} />
        </div>

        {/* Starting from */}
        <div className="flex items-start justify-between border-t border-border pt-4">
          <div>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-ash">
              Starting from
            </p>
            {startingEditable ? (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, keypadField: 'starting' }))}
                className={
                  'mt-1 text-left ' +
                  (form.keypadField === 'starting'
                    ? 'outline outline-1 outline-scarlet rounded-sm px-1 -mx-1'
                    : '')
                }
              >
                <span className="font-display font-extrabold text-3xl text-chalk">
                  {form.startingDistanceInput === '' ? '—' : form.startingDistanceInput}
                </span>{' '}
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash">
                  {startingUnit}
                </span>
              </button>
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
            {warning && (
              <p className="mt-2 font-mono text-[10px] tracking-[0.15em] uppercase" style={{ color: '#F09020' }}>
                {warning} · tap to dismiss
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

        {/* Ending distance + keypad */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, keypadField: 'ending' }))}
              className={
                'font-mono text-[9px] tracking-[0.3em] uppercase ' +
                (form.keypadField === 'ending' ? 'text-chalk' : 'text-ash')
              }
            >
              {form.keypadField === 'starting' ? 'Starting distance' : 'Ending distance'}
            </button>
            <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash">
              {endingUnit}
            </span>
          </div>
          <NumericKeypad
            value={
              form.keypadField === 'starting'
                ? form.startingDistanceInput
                : form.endingDistance
            }
            onChange={setKeypadValue}
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

        {/* Conditional fields */}
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

        {/* Penalty toggle */}
        <PenaltyToggle
          on={form.penalty}
          onChange={(v) => setForm((f) => ({ ...f, penalty: v }))}
        />

        {/* Save */}
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
