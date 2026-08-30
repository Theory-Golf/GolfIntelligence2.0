'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getRound,
  getHolesForRound,
  getShotsForHole,
  getCoursesByPlayer,
} from './db/index';
import type {
  CourseRow,
  HoleRow,
  RoundInsert,
  RoundRow,
  RoundType,
  ShotInsert,
  ShotRow,
  ShotUpdate,
} from './db/types';
import { createId } from './utils/uuid';
import { persistOrQueue, type PersistResult } from './offlineQueue';
import { readDraft, writeDraft, removeDraft } from './draftStore';

export interface HoleEntry {
  holeId: string;
  holeNumber: number;
  par: number;
  shots: ShotRow[];
}

export interface RunningScore {
  front: number | null;
  back: number | null;
  total: number;
  vsPar: number;
}

export interface RoundSessionState {
  roundId: string;
  courseId: string | null;
  courseName: string;
  roundDate: string | null;
  roundType: RoundType | null;
  /** Event name, for a Tournament round. */
  tournamentName: string | null;
  holePars: Record<number, number>;
  holes: HoleEntry[];
  activeHoleNumber: number;
  activeHoleId: string | null;
  activeShotOrder: number;
  lastActiveHole: number | null;
}

export interface SubmitRoundResult {
  ok: boolean;
  queued: boolean;
  message?: string;
}

export interface RoundSessionContextValue {
  state: RoundSessionState;
  loading: boolean;
  error: string | null;
  // True while the round lives only on this device (not yet submitted).
  isDraft: boolean;
  getHole: (holeNumber: number) => HoleEntry | undefined;
  setPar: (holeNumber: number, par: number) => Promise<HoleEntry>;
  saveShot: (shot: ShotInsert) => Promise<void>;
  updateShot: (holeId: string, shot: ShotUpdate) => Promise<void>;
  deleteShot: (holeId: string, shotId: string) => Promise<void>;
  insertShotAfter: (
    holeId: string,
    afterOrder: number,
    shot: Omit<ShotInsert, 'shot_number'>,
  ) => Promise<void>;
  cascadeFromShot: (holeId: string, fromShotOrder: number) => Promise<void>;
  completeHole: (holeNumber: number) => void;
  getRunningScore: () => RunningScore;
  setLastActiveHole: (holeNumber: number) => void;
  isRoundComplete: () => boolean;
  getTotalYardage: () => number | null;
  submitRound: () => Promise<SubmitRoundResult>;
}

const RoundSessionContext = createContext<RoundSessionContextValue | null>(null);

const COURSE_PAR_KEYS: Array<keyof CourseRow> = [
  'par_hole_1',
  'par_hole_2',
  'par_hole_3',
  'par_hole_4',
  'par_hole_5',
  'par_hole_6',
  'par_hole_7',
  'par_hole_8',
  'par_hole_9',
  'par_hole_10',
  'par_hole_11',
  'par_hole_12',
  'par_hole_13',
  'par_hole_14',
  'par_hole_15',
  'par_hole_16',
  'par_hole_17',
  'par_hole_18',
];

function holeParsFromCourse(course: CourseRow): Record<number, number> {
  const pars: Record<number, number> = {};
  COURSE_PAR_KEYS.forEach((key, idx) => {
    pars[idx + 1] = course[key] as number;
  });
  return pars;
}

function isHoled(shot: ShotRow): boolean {
  return shot.ending_lie === 'Green' && shot.ending_distance === 0;
}

function holeIsComplete(entry: HoleEntry): boolean {
  return entry.shots.length > 0 && entry.shots.some(isHoled);
}

function firstIncompleteHole(entries: HoleEntry[]): number {
  for (let n = 1; n <= 18; n++) {
    const entry = entries.find((e) => e.holeNumber === n);
    if (!entry || !holeIsComplete(entry)) return n;
  }
  return 18;
}

// Each penalty counts as an extra stroke on top of the physical shots.
function holeStrokes(entry: HoleEntry): number {
  return (
    entry.shots.length + entry.shots.filter((s) => s.has_penalty).length
  );
}

// Stroke number shown to the player: the stored shot_number plus penalty
// strokes incurred on earlier shots (penalty on shot 1 → next shot is 3).
function strokeNumberForShot(shots: ShotRow[], shotNumber: number): number {
  const prior = shots.filter(
    (s) => s.shot_number < shotNumber && s.has_penalty,
  ).length;
  return shotNumber + prior;
}

export function RoundSessionProvider({
  roundId,
  children,
}: {
  roundId: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<RoundSessionState>({
    roundId,
    courseId: null,
    courseName: '',
    roundDate: null,
    roundType: null,
    tournamentName: null,
    holePars: {},
    holes: [],
    activeHoleNumber: 1,
    activeHoleId: null,
    activeShotOrder: 1,
    lastActiveHole: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  // Ref mirror of isDraft for use inside useCallbacks without dep churn.
  const isDraftRef = useRef(false);
  // The full round payload (incl. weather/location) captured at round start;
  // it exists nowhere else until the round is submitted.
  const draftRoundRef = useRef<RoundInsert | null>(null);
  const submittingRef = useRef(false);

  // Ref mirror of the latest committed state. Mutations read `prev` from here
  // and flush the draft synchronously (see writeDraftFrom / commit) without
  // waiting for a re-render.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Write the localStorage draft immediately from a concrete state snapshot.
  // Draft persistence MUST be synchronous with the state change: relying on a
  // passive effect leaves a window where a saved shot is in memory but not yet
  // on disk, and if the tab is frozen/discarded in that window (mobile "pocket
  // the phone" mid-hole) the shot is silently lost. This closes that window.
  const writeDraftFrom = useCallback((next: RoundSessionState) => {
    if (!isDraftRef.current || !draftRoundRef.current) return;
    const ok = writeDraft(next.roundId, {
      version: 1,
      round: draftRoundRef.current,
      courseName: next.courseName,
      holePars: next.holePars,
      holes: next.holes,
      updatedAt: new Date().toISOString(),
    });
    if (!ok) console.warn('[draft] localStorage write failed');
  }, []);

  // Commit a state change AND flush the draft in the same tick. All in-round
  // mutations go through this so no shot can be left unpersisted.
  const commit = useCallback(
    (updater: (prev: RoundSessionState) => RoundSessionState) => {
      const next = updater(stateRef.current);
      stateRef.current = next;
      setState(next);
      writeDraftFrom(next);
    },
    [writeDraftFrom],
  );

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Unsubmitted rounds live only in the local draft; check it before
        // the DB so a partially-submitted round resumes in draft mode.
        const draft = readDraft(roundId);
        if (draft) {
          if (cancelled) return;
          draftRoundRef.current = draft.round;
          isDraftRef.current = true;
          const entries = draft.holes
            .slice()
            .sort((a, b) => a.holeNumber - b.holeNumber);
          const activeHoleNumber = firstIncompleteHole(entries);
          const activeEntry = entries.find(
            (e) => e.holeNumber === activeHoleNumber,
          );
          setState({
            roundId,
            courseId: draft.round.course_id ?? null,
            courseName: draft.courseName,
            roundDate: draft.round.played_on,
            roundType: draft.round.round_type,
            tournamentName: draft.round.tournament_name ?? null,
            holePars: draft.holePars,
            holes: entries,
            activeHoleNumber,
            activeHoleId: activeEntry?.holeId ?? null,
            activeShotOrder: (activeEntry?.shots.length ?? 0) + 1,
            lastActiveHole: null,
          });
          setIsDraft(true);
          setLoading(false);
          return;
        }

        const round: RoundRow | null = await getRound(roundId);
        if (!round) {
          if (!cancelled) {
            setError('Round not found');
            setLoading(false);
          }
          return;
        }

        let courseName = '';
        let holePars: Record<number, number> = {};
        if (round.course_id) {
          try {
            const courses = await getCoursesByPlayer(round.player_id);
            const course = courses.find((c) => c.id === round.course_id);
            if (course) {
              courseName = course.name;
              holePars = holeParsFromCourse(course);
            }
          } catch {
            // course load failure is non-fatal
          }
        }

        const holes: HoleRow[] = await getHolesForRound(roundId);
        const entries: HoleEntry[] = await Promise.all(
          holes.map(async (h) => ({
            holeId: h.id,
            holeNumber: h.hole_number,
            par: h.par,
            shots: await getShotsForHole(h.id),
          })),
        );
        entries.sort((a, b) => a.holeNumber - b.holeNumber);

        const activeHoleNumber = firstIncompleteHole(entries);
        const activeEntry = entries.find((e) => e.holeNumber === activeHoleNumber);

        if (cancelled) return;
        setState({
          roundId,
          courseId: round.course_id,
          courseName,
          roundDate: round.played_on,
          roundType: round.round_type,
          tournamentName: round.tournament_name,
          holePars,
          holes: entries,
          activeHoleNumber,
          activeHoleId: activeEntry?.holeId ?? null,
          activeShotOrder: (activeEntry?.shots.length ?? 0) + 1,
          lastActiveHole: null,
        });
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load round');
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  // ── Draft persistence ─────────────────────────────────────────────────────
  // Every in-round mutation goes through `commit`, which flushes the draft
  // synchronously in the same tick. A passive effect mirroring `state` on top
  // of that would serialise the whole round a second time on every change —
  // pure cost on a phone — so the synchronous flush is the only writer.

  // Safety net for mobile: when the tab is hidden or being discarded (the
  // player pockets the phone mid-hole), synchronously flush the draft so a
  // just-saved shot can never be lost to a starved passive effect.
  useEffect(() => {
    function flush() {
      writeDraftFrom(stateRef.current);
    }
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [writeDraftFrom]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setHoleShots = useCallback(
    (holeId: string, fn: (shots: ShotRow[]) => ShotRow[]) => {
      commit((prev) => ({
        ...prev,
        holes: prev.holes.map((h) =>
          h.holeId === holeId ? { ...h, shots: fn(h.shots) } : h,
        ),
      }));
    },
    [commit],
  );

  const getHole = useCallback(
    (holeNumber: number) =>
      state.holes.find((h) => h.holeNumber === holeNumber),
    [state.holes],
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const setPar = useCallback(
    async (holeNumber: number, par: number): Promise<HoleEntry> => {
      const existing = stateRef.current.holes.find(
        (h) => h.holeNumber === holeNumber,
      );
      if (existing) {
        if (existing.par === par) return existing;
        commit((prev) => ({
          ...prev,
          holes: prev.holes.map((h) =>
            h.holeId === existing.holeId ? { ...h, par } : h,
          ),
        }));
        if (!isDraftRef.current) {
          void persistOrQueue({
            type: 'updateHole',
            payload: { id: existing.holeId, par },
          });
        }
        return { ...existing, par };
      }
      const id = createId();
      const entry: HoleEntry = {
        holeId: id,
        holeNumber,
        par,
        shots: [],
      };
      commit((prev) => ({
        ...prev,
        holes: [...prev.holes, entry].sort(
          (a, b) => a.holeNumber - b.holeNumber,
        ),
        activeHoleNumber: holeNumber,
        activeHoleId: entry.holeId,
        activeShotOrder: 1,
      }));
      if (!isDraftRef.current) {
        void persistOrQueue({
          type: 'upsertHole',
          payload: { id, round_id: roundId, hole_number: holeNumber, par },
        });
      }
      return entry;
    },
    [commit, roundId],
  );

  const saveShot = useCallback(
    async (shot: ShotInsert) => {
      const localRow: ShotRow = {
        ...shot,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // One atomic commit: add the shot and advance the cursor together, and
      // flush the draft synchronously (via commit) before this resolves.
      commit((prev) => ({
        ...prev,
        holes: prev.holes.map((h) =>
          h.holeId === shot.hole_id
            ? {
                ...h,
                shots: [
                  ...h.shots.filter((s) => s.id !== shot.id),
                  localRow,
                ].sort((a, b) => a.shot_number - b.shot_number),
              }
            : h,
        ),
        activeShotOrder: shot.shot_number + 1,
      }));
      if (!isDraftRef.current) {
        void persistOrQueue({ type: 'upsertShot', payload: shot });
      }
    },
    [commit],
  );

  const cascadeFromShot = useCallback(
    async (holeId: string, fromShotOrder: number) => {
      const updates: ShotUpdate[] = [];
      setHoleShots(holeId, (shots) => {
        const ordered = shots.slice().sort((a, b) => a.shot_number - b.shot_number);
        const next: ShotRow[] = ordered.map((s) => ({ ...s }));
        for (let i = 1; i < next.length; i++) {
          const prev = next[i - 1];
          const cur = next[i];
          if (cur.shot_number <= fromShotOrder) continue;
          if (
            cur.starting_lie !== prev.ending_lie ||
            cur.starting_distance !== prev.ending_distance
          ) {
            cur.starting_lie = prev.ending_lie;
            cur.starting_distance = prev.ending_distance;
            updates.push({
              id: cur.id,
              starting_lie: prev.ending_lie,
              starting_distance: prev.ending_distance,
            });
          }
        }
        return next;
      });
      if (!isDraftRef.current) {
        for (const u of updates) {
          void persistOrQueue({ type: 'updateShot', payload: u });
        }
      }
    },
    [setHoleShots],
  );

  const updateShot = useCallback(
    async (holeId: string, shot: ShotUpdate) => {
      setHoleShots(holeId, (shots) =>
        shots.map((s) => (s.id === shot.id ? { ...s, ...shot } : s)),
      );
      if (!isDraftRef.current) {
        void persistOrQueue({ type: 'updateShot', payload: shot });
      }
    },
    [setHoleShots],
  );

  const deleteShot = useCallback(
    async (holeId: string, shotId: string) => {
      const resequenceUpdates: ShotUpdate[] = [];
      setHoleShots(holeId, (shots) => {
        const remaining = shots
          .filter((s) => s.id !== shotId)
          .slice()
          .sort((a, b) => a.shot_number - b.shot_number);
        const next: ShotRow[] = remaining.map((s) => ({ ...s }));
        for (let i = 0; i < next.length; i++) {
          const s = next[i];
          const desiredOrder = i + 1;
          const prev = i > 0 ? next[i - 1] : null;
          const update: ShotUpdate = { id: s.id };
          let changed = false;
          if (s.shot_number !== desiredOrder) {
            s.shot_number = desiredOrder;
            update.shot_number = desiredOrder;
            changed = true;
          }
          if (prev) {
            if (s.starting_lie !== prev.ending_lie) {
              s.starting_lie = prev.ending_lie;
              update.starting_lie = prev.ending_lie;
              changed = true;
            }
            if (s.starting_distance !== prev.ending_distance) {
              s.starting_distance = prev.ending_distance;
              update.starting_distance = prev.ending_distance;
              changed = true;
            }
          }
          if (changed) resequenceUpdates.push(update);
        }
        return next;
      });
      if (!isDraftRef.current) {
        void persistOrQueue({ type: 'deleteShot', payload: { id: shotId } });
        for (const u of resequenceUpdates) {
          void persistOrQueue({ type: 'updateShot', payload: u });
        }
      }
    },
    [setHoleShots],
  );

  const insertShotAfter = useCallback(
    async (
      holeId: string,
      afterOrder: number,
      shot: Omit<ShotInsert, 'shot_number'>,
    ) => {
      const shiftUpdates: ShotUpdate[] = [];
      const newOrder = afterOrder + 1;
      const inserted: ShotInsert = { ...shot, shot_number: newOrder };
      const insertedRow: ShotRow = {
        ...inserted,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const cascadeUpdates: ShotUpdate[] = [];

      setHoleShots(holeId, (shots) => {
        // Shift later shots' shot_number +1.
        const shifted: ShotRow[] = shots.map((s) => {
          if (s.shot_number > afterOrder) {
            shiftUpdates.push({ id: s.id, shot_number: s.shot_number + 1 });
            return { ...s, shot_number: s.shot_number + 1 };
          }
          return { ...s };
        });
        // Splice in the new shot, then run cascade from newOrder forward.
        const merged = [...shifted, insertedRow].sort(
          (a, b) => a.shot_number - b.shot_number,
        );
        for (let i = 1; i < merged.length; i++) {
          const prev = merged[i - 1];
          const cur = merged[i];
          if (cur.shot_number <= newOrder) continue;
          if (
            cur.starting_lie !== prev.ending_lie ||
            cur.starting_distance !== prev.ending_distance
          ) {
            cur.starting_lie = prev.ending_lie;
            cur.starting_distance = prev.ending_distance;
            cascadeUpdates.push({
              id: cur.id,
              starting_lie: prev.ending_lie,
              starting_distance: prev.ending_distance,
            });
          }
        }
        return merged;
      });

      if (!isDraftRef.current) {
        for (const u of shiftUpdates) {
          void persistOrQueue({ type: 'updateShot', payload: u });
        }
        void persistOrQueue({ type: 'upsertShot', payload: inserted });
        for (const u of cascadeUpdates) {
          void persistOrQueue({ type: 'updateShot', payload: u });
        }
      }
    },
    [setHoleShots],
  );

  const completeHole = useCallback(
    (holeNumber: number) => {
      commit((prev) => ({
        ...prev,
        activeHoleNumber: Math.min(18, holeNumber + 1),
        activeHoleId: null,
        activeShotOrder: 1,
      }));
    },
    [commit],
  );

  const getRunningScore = useCallback((): RunningScore => {
    // Running sums over completed holes — front/back update hole by hole,
    // null only until the first hole of that nine is finished.
    let total = 0;
    let front = 0;
    let back = 0;
    let anyFront = false;
    let anyBack = false;
    for (const h of state.holes) {
      if (!holeIsComplete(h)) continue;
      const vsPar = holeStrokes(h) - h.par;
      total += vsPar;
      if (h.holeNumber <= 9) {
        front += vsPar;
        anyFront = true;
      } else {
        back += vsPar;
        anyBack = true;
      }
    }
    return {
      front: anyFront ? front : null,
      back: anyBack ? back : null,
      total,
      vsPar: total,
    };
  }, [state.holes]);

  const setLastActiveHole = useCallback(
    (holeNumber: number) => {
      commit((prev) => ({ ...prev, lastActiveHole: holeNumber }));
    },
    [commit],
  );

  const isRoundComplete = useCallback((): boolean => {
    for (let n = 1; n <= 18; n++) {
      const h = state.holes.find((e) => e.holeNumber === n);
      if (!h || !holeIsComplete(h)) return false;
    }
    return true;
  }, [state.holes]);

  const getTotalYardage = useCallback((): number | null => {
    let total = 0;
    let any = false;
    for (const h of state.holes) {
      const d = h.shots[0]?.starting_distance;
      if (typeof d === 'number') {
        total += d;
        any = true;
      }
    }
    return any ? total : null;
  }, [state.holes]);

  // Writes the whole draft to the DB in FK order (round → holes → shots).
  // persistOrQueue enqueues any failed write into the offline queue, so the
  // draft can be cleared unconditionally — data is never lost, and keeping
  // the draft after a partial submit would create two sources of truth.
  const submitRound = useCallback(async (): Promise<SubmitRoundResult> => {
    if (!isDraftRef.current || submittingRef.current) {
      return { ok: true, queued: false };
    }
    if (!draftRoundRef.current) {
      return { ok: false, queued: false, message: 'Draft round data missing' };
    }
    submittingRef.current = true;
    try {
      let queued = false;
      let message: string | undefined;
      const track = (r: PersistResult) => {
        if (r.status !== 'saved') queued = true;
        if (r.status === 'queued-error') message = r.message;
      };
      track(
        await persistOrQueue({
          type: 'upsertRound',
          // Submitting from review is the only thing that finishes a round, so
          // it is the only place is_complete becomes true. Without it every
          // round stays flagged unfinished and an abandoned round is
          // indistinguishable from a full 18 on the dashboard.
          payload: { ...draftRoundRef.current, is_complete: true },
        }),
      );
      for (const h of state.holes) {
        track(
          await persistOrQueue({
            type: 'upsertHole',
            payload: {
              id: h.holeId,
              round_id: state.roundId,
              hole_number: h.holeNumber,
              par: h.par,
            },
          }),
        );
        const ordered = [...h.shots].sort(
          (a, b) => a.shot_number - b.shot_number,
        );
        for (const s of ordered) {
          const { created_at: _c, updated_at: _u, ...insert } = s;
          track(
            await persistOrQueue({ type: 'upsertShot', payload: insert }),
          );
        }
      }

      // Fail-closed: only discard the local draft once every hole and shot is
      // CONFIRMED present in the database. If any write only reached the
      // offline queue, or a readback comes up short, keep the draft so the
      // round can be resubmitted instead of silently losing shots.
      let verified = false;
      if (!queued) {
        try {
          const dbHoles = await getHolesForRound(state.roundId);
          const dbHoleIds = new Set(dbHoles.map((h) => h.id));
          verified = state.holes.every((h) => dbHoleIds.has(h.holeId));
          if (verified) {
            for (const h of state.holes) {
              const dbShots = await getShotsForHole(h.holeId);
              if (dbShots.length < h.shots.length) {
                verified = false;
                break;
              }
            }
          }
        } catch {
          verified = false;
        }
      }

      if (!verified) {
        return {
          ok: false,
          queued: true,
          message:
            message ??
            'Some shots could not be confirmed as saved. Your round is safe on this device — reconnect and submit again.',
        };
      }

      // Leave draft mode before removing the draft so the persist effect
      // can't resurrect it on an interleaved re-render.
      isDraftRef.current = false;
      setIsDraft(false);
      removeDraft(state.roundId);
      return { ok: true, queued: false, message };
    } finally {
      submittingRef.current = false;
    }
  }, [state.holes, state.roundId]);

  const value = useMemo<RoundSessionContextValue>(
    () => ({
      state,
      loading,
      error,
      isDraft,
      getHole,
      setPar,
      saveShot,
      updateShot,
      deleteShot,
      insertShotAfter,
      cascadeFromShot,
      completeHole,
      getRunningScore,
      setLastActiveHole,
      isRoundComplete,
      getTotalYardage,
      submitRound,
    }),
    [
      state,
      loading,
      error,
      isDraft,
      getHole,
      setPar,
      saveShot,
      updateShot,
      deleteShot,
      insertShotAfter,
      cascadeFromShot,
      completeHole,
      getRunningScore,
      setLastActiveHole,
      isRoundComplete,
      getTotalYardage,
      submitRound,
    ],
  );

  return (
    <RoundSessionContext.Provider value={value}>
      {children}
    </RoundSessionContext.Provider>
  );
}

export function useRoundSession(): RoundSessionContextValue {
  const ctx = useContext(RoundSessionContext);
  if (!ctx) {
    throw new Error('useRoundSession must be used within RoundSessionProvider');
  }
  return ctx;
}

export { holeIsComplete, holeStrokes, isHoled, strokeNumberForShot };
