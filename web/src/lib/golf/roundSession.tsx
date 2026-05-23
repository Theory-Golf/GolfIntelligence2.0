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
  upsertHole,
  upsertShot,
  updateShot as dbUpdateShot,
  deleteShot as dbDeleteShot,
} from './db/index';
import type {
  CourseRow,
  HoleRow,
  Lie,
  RoundRow,
  ShotInsert,
  ShotRow,
  ShotUpdate,
} from './db/types';
import { createId } from './utils/uuid';

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
  holePars: Record<number, number>;
  holes: HoleEntry[];
  activeHoleNumber: number;
  activeHoleId: string | null;
  activeShotOrder: number;
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
    shot: Omit<ShotInsert, 'shot_order'>,
  ) => Promise<void>;
  cascadeFromShot: (holeId: string, fromShotOrder: number) => Promise<void>;
  completeHole: (holeNumber: number) => void;
  getRunningScore: () => RunningScore;
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
    holePars: {},
    holes: [],
    activeHoleNumber: 1,
    activeHoleId: null,
    activeShotOrder: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
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
        setState({
          roundId,
          courseId: round.course_id,
          courseName,
          holePars,
          holes: entries,
          activeHoleNumber,
          activeHoleId: activeEntry?.holeId ?? null,
          activeShotOrder: (activeEntry?.shots.length ?? 0) + 1,
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
  const refreshHoleShots = useCallback(async (holeId: string) => {
    const shots = await getShotsForHole(holeId);
    setState((prev) => ({
      ...prev,
      holes: prev.holes.map((h) =>
        h.holeId === holeId ? { ...h, shots } : h,
      ),
    }));
  }, []);

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
        // Hole already created — par change not supported in this phase.
        return existing;
      }
      const id = createId();
      const row = await upsertHole({
        id,
        round_id: roundId,
        hole_number: holeNumber,
        par,
      });
      const entry: HoleEntry = {
        holeId: row.id,
        holeNumber: row.hole_number,
        par: row.par,
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
      return entry;
    },
    [roundId, state.holes],
  );

  const saveShot = useCallback(
    async (shot: ShotInsert) => {
      await upsertShot(shot);
      await refreshHoleShots(shot.hole_id);
      setState((prev) => ({
        ...prev,
        activeShotOrder: shot.shot_order + 1,
      }));
    },
    [refreshHoleShots],
  );

  const cascadeFromShot = useCallback(
    async (holeId: string, fromShotOrder: number) => {
      const shots = await getShotsForHole(holeId);
      const ordered = shots.slice().sort((a, b) => a.shot_order - b.shot_order);
      for (let i = 1; i < ordered.length; i++) {
        const prev = ordered[i - 1];
        const cur = ordered[i];
        if (cur.shot_order <= fromShotOrder) continue;
        const desiredLie: Lie = prev.ending_lie;
        const desiredDist = prev.ending_distance;
        if (
          cur.starting_lie !== desiredLie ||
          cur.starting_distance !== desiredDist
        ) {
          await dbUpdateShot({
            id: cur.id,
            starting_lie: desiredLie,
            starting_distance: desiredDist,
          });
        }
      }
      await refreshHoleShots(holeId);
    },
    [refreshHoleShots],
  );

  const updateShot = useCallback(
    async (holeId: string, shot: ShotUpdate) => {
      await dbUpdateShot(shot);
      await refreshHoleShots(holeId);
    },
    [refreshHoleShots],
  );

  const deleteShot = useCallback(
    async (holeId: string, shotId: string) => {
      await dbDeleteShot(shotId);
      // Resequence remaining shots: orders 1..N, cascade starting from each prev ending.
      const remaining = (await getShotsForHole(holeId))
        .slice()
        .sort((a, b) => a.shot_order - b.shot_order);
      for (let i = 0; i < remaining.length; i++) {
        const s = remaining[i];
        const desiredOrder = i + 1;
        const prev = i > 0 ? remaining[i - 1] : null;
        const update: ShotUpdate = { id: s.id };
        let changed = false;
        if (s.shot_order !== desiredOrder) {
          update.shot_order = desiredOrder;
          changed = true;
        }
        if (prev) {
          if (s.starting_lie !== prev.ending_lie) {
            update.starting_lie = prev.ending_lie;
            changed = true;
          }
          if (s.starting_distance !== prev.ending_distance) {
            update.starting_distance = prev.ending_distance;
            changed = true;
          }
        }
        if (changed) await dbUpdateShot(update);
      }
      await refreshHoleShots(holeId);
    },
    [refreshHoleShots],
  );

  const insertShotAfter = useCallback(
    async (
      holeId: string,
      afterOrder: number,
      shot: Omit<ShotInsert, 'shot_order'>,
    ) => {
      // Shift later shots' shot_order +1 (descending to avoid any tie window).
      const current = (await getShotsForHole(holeId))
        .slice()
        .sort((a, b) => b.shot_order - a.shot_order);
      for (const s of current) {
        if (s.shot_order > afterOrder) {
          await dbUpdateShot({ id: s.id, shot_order: s.shot_order + 1 });
        }
      }
      const newOrder = afterOrder + 1;
      await upsertShot({ ...shot, shot_order: newOrder });
      await cascadeFromShot(holeId, newOrder);
    },
    [cascadeFromShot],
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
