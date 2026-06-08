'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  RoundRow,
  RoundType,
  ShotInsert,
  ShotRow,
  ShotUpdate,
} from './db/types';
import { createId } from './utils/uuid';
import { persistOrQueue } from './offlineQueue';

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
  holePars: Record<number, number>;
  holes: HoleEntry[];
  activeHoleNumber: number;
  activeHoleId: string | null;
  activeShotOrder: number;
  lastActiveHole: number | null;
}

export interface RoundSessionContextValue {
  state: RoundSessionState;
  loading: boolean;
  error: string | null;
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
    holePars: {},
    holes: [],
    activeHoleNumber: 1,
    activeHoleId: null,
    activeShotOrder: 1,
    lastActiveHole: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let round: RoundRow | null = await getRound(roundId);

        // If the round isn't in the DB yet (queued offline or DB write still
        // in-flight), fall back to the bootstrap written by the new-round page.
        if (!round) {
          const raw =
            typeof sessionStorage !== 'undefined'
              ? sessionStorage.getItem(`tg_round_bootstrap_${roundId}`)
              : null;

          if (raw) {
            try {
              const b = JSON.parse(raw) as {
                playerId: string;
                courseId: string | null;
                courseName: string;
                played_on: string;
                roundType: RoundType;
                roundNumber: number | null;
                holePars: Record<number, number>;
              };
              if (!cancelled) {
                setState({
                  roundId,
                  courseId: b.courseId,
                  courseName: b.courseName,
                  roundDate: b.played_on,
                  roundType: b.roundType,
                  holePars: b.holePars,
                  holes: [],
                  activeHoleNumber: 1,
                  activeHoleId: null,
                  activeShotOrder: 1,
                  lastActiveHole: null,
                });
                setLoading(false);
              }
            } catch {
              if (!cancelled) {
                setError('Round not found');
                setLoading(false);
              }
            }
            return;
          }

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

        // First incomplete hole, defaulting to 1 or (lastEntered+1)
        let activeHoleNumber = 1;
        for (let n = 1; n <= 18; n++) {
          const entry = entries.find((e) => e.holeNumber === n);
          if (!entry || !holeIsComplete(entry)) {
            activeHoleNumber = n;
            break;
          }
          if (n === 18) activeHoleNumber = 18;
        }
        const activeEntry = entries.find((e) => e.holeNumber === activeHoleNumber);

        if (cancelled) return;
        // Clear bootstrap now that we have a confirmed DB record.
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(`tg_round_bootstrap_${roundId}`);
        }
        setState({
          roundId,
          courseId: round.course_id,
          courseName,
          roundDate: round.played_on,
          roundType: round.round_type,
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setHoleShots = useCallback(
    (holeId: string, fn: (shots: ShotRow[]) => ShotRow[]) => {
      setState((prev) => ({
        ...prev,
        holes: prev.holes.map((h) =>
          h.holeId === holeId ? { ...h, shots: fn(h.shots) } : h,
        ),
      }));
    },
    [],
  );

  const getHole = useCallback(
    (holeNumber: number) =>
      state.holes.find((h) => h.holeNumber === holeNumber),
    [state.holes],
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const setPar = useCallback(
    async (holeNumber: number, par: number): Promise<HoleEntry> => {
      const existing = state.holes.find((h) => h.holeNumber === holeNumber);
      if (existing) {
        if (existing.par === par) return existing;
        setState((prev) => ({
          ...prev,
          holes: prev.holes.map((h) =>
            h.holeId === existing.holeId ? { ...h, par } : h,
          ),
        }));
        void persistOrQueue({
          type: 'updateHole',
          payload: { id: existing.holeId, par },
        });
        return { ...existing, par };
      }
      const id = createId();
      const entry: HoleEntry = {
        holeId: id,
        holeNumber,
        par,
        shots: [],
      };
      setState((prev) => ({
        ...prev,
        holes: [...prev.holes, entry].sort(
          (a, b) => a.holeNumber - b.holeNumber,
        ),
        activeHoleNumber: holeNumber,
        activeHoleId: entry.holeId,
        activeShotOrder: 1,
      }));
      void persistOrQueue({
        type: 'upsertHole',
        payload: { id, round_id: roundId, hole_number: holeNumber, par },
      });
      return entry;
    },
    [roundId, state.holes],
  );

  const saveShot = useCallback(
    async (shot: ShotInsert) => {
      const localRow: ShotRow = {
        ...shot,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setHoleShots(shot.hole_id, (shots) => {
        const without = shots.filter((s) => s.id !== shot.id);
        return [...without, localRow].sort(
          (a, b) => a.shot_number - b.shot_number,
        );
      });
      setState((prev) => ({
        ...prev,
        activeShotOrder: shot.shot_number + 1,
      }));
      void persistOrQueue({ type: 'upsertShot', payload: shot });
    },
    [setHoleShots],
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
      for (const u of updates) {
        void persistOrQueue({ type: 'updateShot', payload: u });
      }
    },
    [setHoleShots],
  );

  const updateShot = useCallback(
    async (holeId: string, shot: ShotUpdate) => {
      setHoleShots(holeId, (shots) =>
        shots.map((s) => (s.id === shot.id ? { ...s, ...shot } : s)),
      );
      void persistOrQueue({ type: 'updateShot', payload: shot });
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
      void persistOrQueue({ type: 'deleteShot', payload: { id: shotId } });
      for (const u of resequenceUpdates) {
        void persistOrQueue({ type: 'updateShot', payload: u });
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

      for (const u of shiftUpdates) {
        void persistOrQueue({ type: 'updateShot', payload: u });
      }
      void persistOrQueue({ type: 'upsertShot', payload: inserted });
      for (const u of cascadeUpdates) {
        void persistOrQueue({ type: 'updateShot', payload: u });
      }
    },
    [setHoleShots],
  );

  const completeHole = useCallback((holeNumber: number) => {
    setState((prev) => ({
      ...prev,
      activeHoleNumber: Math.min(18, holeNumber + 1),
      activeHoleId: null,
      activeShotOrder: 1,
    }));
  }, []);

  const getRunningScore = useCallback((): RunningScore => {
    let total = 0;
    let front = 0;
    let back = 0;
    let frontComplete = true;
    let backComplete = true;
    for (let n = 1; n <= 9; n++) {
      const h = state.holes.find((e) => e.holeNumber === n);
      if (!h || !holeIsComplete(h)) {
        frontComplete = false;
      } else {
        front += h.shots.length - h.par;
      }
    }
    for (let n = 10; n <= 18; n++) {
      const h = state.holes.find((e) => e.holeNumber === n);
      if (!h || !holeIsComplete(h)) {
        backComplete = false;
      } else {
        back += h.shots.length - h.par;
      }
    }
    for (const h of state.holes) {
      if (holeIsComplete(h)) total += h.shots.length - h.par;
    }
    return {
      front: frontComplete ? front : null,
      back: backComplete ? back : null,
      total,
      vsPar: total,
    };
  }, [state.holes]);

  const setLastActiveHole = useCallback((holeNumber: number) => {
    setState((prev) => ({ ...prev, lastActiveHole: holeNumber }));
  }, []);

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

  const value = useMemo<RoundSessionContextValue>(
    () => ({
      state,
      loading,
      error,
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
    }),
    [
      state,
      loading,
      error,
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

export { holeIsComplete, isHoled };
