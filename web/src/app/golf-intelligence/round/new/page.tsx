'use client';

import { useReducer, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  getCoursesByPlayer,
  upsertCourse,
  fuzzyMatchCourse,
  upsertRound,
} from '@/lib/golf/db/index';
import { createBrowserClient } from '@/lib/golf/db/client';
import { createId } from '@/lib/golf/utils/index';
import type { CourseRow, RoundType } from '@/lib/golf/db/types';

// ─── State ────────────────────────────────────────────────────────────────────

interface RoundSetupState {
  date: string;
  courseId: string | null;
  courseName: string;
  location: string;
  roundType: RoundType | null;
  roundNumber: number | null;
}

type Action =
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_COURSE'; courseId: string; courseName: string }
  | { type: 'SET_COURSE_NAME'; courseName: string }
  | { type: 'CLEAR_COURSE' }
  | { type: 'SET_LOCATION'; location: string }
  | { type: 'SET_ROUND_TYPE'; roundType: RoundType }
  | { type: 'SET_ROUND_NUMBER'; roundNumber: number };

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function reducer(state: RoundSetupState, action: Action): RoundSetupState {
  switch (action.type) {
    case 'SET_DATE':
      return { ...state, date: action.date };
    case 'SET_COURSE':
      return { ...state, courseId: action.courseId, courseName: action.courseName };
    case 'SET_COURSE_NAME':
      return { ...state, courseName: action.courseName, courseId: null };
    case 'CLEAR_COURSE':
      return { ...state, courseId: null, courseName: '' };
    case 'SET_LOCATION':
      return { ...state, location: action.location };
    case 'SET_ROUND_TYPE':
      return {
        ...state,
        roundType: action.roundType,
        roundNumber: action.roundType === 'Practice' ? null : state.roundNumber,
      };
    case 'SET_ROUND_NUMBER':
      return { ...state, roundNumber: action.roundNumber };
  }
}

const ROUND_TYPES: RoundType[] = ['Practice', 'Qualifying', 'Tournament'];
const ROUND_NUMBERS = [1, 2, 3, 4];

const defaultPars = {
  par_hole_1: 4, par_hole_2: 4, par_hole_3: 4, par_hole_4: 4,
  par_hole_5: 4, par_hole_6: 4, par_hole_7: 4, par_hole_8: 4,
  par_hole_9: 4, par_hole_10: 4, par_hole_11: 4, par_hole_12: 4,
  par_hole_13: 4, par_hole_14: 4, par_hole_15: 4, par_hole_16: 4,
  par_hole_17: 4, par_hole_18: 4,
} as const;

// ─── Shared Tailwind class strings ───────────────────────────────────────────

const monoLabel = 'font-mono text-[10px] tracking-[0.25em] uppercase text-ash';
const containerLabel = 'block font-mono text-[9px] tracking-[0.3em] uppercase text-ash mb-3';
const container = 'border border-border rounded-md p-6';
const input =
  'w-full bg-shadow border border-border rounded-md px-3 py-2.5 text-chalk font-body text-sm outline-none box-border';

function roundTypeBtnClass(selected: boolean): string {
  return (
    'w-full px-4 py-3 rounded-md border font-display text-[13px] font-semibold tracking-[0.12em] uppercase text-left transition-colors ' +
    (selected
      ? 'border-scarlet bg-scarlet-tint text-chalk'
      : 'border-border bg-shadow text-ash')
  );
}

function roundNumBtnClass(selected: boolean): string {
  return (
    'flex-1 py-2.5 rounded-md border font-display text-[15px] font-bold transition-colors ' +
    (selected
      ? 'border-scarlet bg-scarlet-tint text-chalk'
      : 'border-border bg-shadow text-ash')
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewRoundPage() {
  const router = useRouter();

  const [state, dispatch] = useReducer(reducer, {
    date: todayIso(),
    courseId: null,
    courseName: '',
    location: '',
    roundType: null,
    roundNumber: null,
  });

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const uid = data.user.id;
      setPlayerId(uid);
      const email = data.user.email ?? '';
      setPlayerName(email.split('@')[0] || uid.slice(0, 8));
      getCoursesByPlayer(uid).then(setCourses).catch(console.error);
    });
  }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const needsRoundNumber =
    state.roundType === 'Qualifying' || state.roundType === 'Tournament';

  const isValid =
    state.courseId !== null &&
    state.roundType !== null &&
    (!needsRoundNumber || state.roundNumber !== null);

  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(state.courseName.toLowerCase()),
  );

  const fuzzyMatch =
    state.courseId === null && state.courseName.length >= 2
      ? fuzzyMatchCourse(state.courseName, courses)
      : null;

  const showFuzzyHint =
    fuzzyMatch !== null &&
    !filteredCourses.some((c) => c.id === fuzzyMatch.id);

  const showAddNew =
    state.courseId === null &&
    state.courseName.trim().length >= 2 &&
    !filteredCourses.some(
      (c) => c.name.toLowerCase() === state.courseName.trim().toLowerCase(),
    );

  function selectCourse(course: CourseRow) {
    dispatch({ type: 'SET_COURSE', courseId: course.id, courseName: course.name });
    setShowDropdown(false);
  }

  async function addNewCourse() {
    if (!playerId || !state.courseName.trim()) return;
    const name = state.courseName.trim();
    const id = createId();
    const newCourse = await upsertCourse({ id, player_id: playerId, name, ...defaultPars });
    setCourses((prev) => [...prev, newCourse]);
    selectCourse(newCourse);
  }

  function handleStart() {
    if (!isValid || !playerId || isSubmitting || !state.roundType) return;
    setIsSubmitting(true);
    const roundId = createId();

    upsertRound({
      id: roundId,
      player_id: playerId,
      course_id: state.courseId,
      date: state.date,
      round_type: state.roundType,
      round_number: state.roundNumber,
      location: state.location.trim() || null,
      weather_temp: null,
      weather_wind_speed: null,
      weather_wind_direction: null,
      weather_precip: null,
    }).catch(() => {
      try {
        sessionStorage.setItem(`round-error:${roundId}`, '1');
      } catch {
        // sessionStorage unavailable
      }
    });

    router.push(`/golf-intelligence/round/${roundId}/hole/1`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Page header */}
      <header className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <span className={monoLabel}>New Round</span>
        <span className={monoLabel}>{playerName}</span>
      </header>

      {/* Scrollable form */}
      <div className="max-w-[480px] mx-auto p-4 flex flex-col gap-4">
        {/* ── Container 1: WHEN ── */}
        <div className={container}>
          <span className={containerLabel}>When</span>
          <input
            type="date"
            value={state.date}
            onChange={(e) => dispatch({ type: 'SET_DATE', date: e.target.value })}
            className={`${input} [color-scheme:dark]`}
          />
        </div>

        {/* ── Container 2: WHERE ── */}
        <div className={container}>
          <span className={containerLabel}>Where</span>

          <div className="mb-3">
            {state.courseId ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground font-display text-[11px] font-bold tracking-[0.1em] uppercase px-2.5 py-1 rounded-sm">
                  {state.courseName}
                  <button
                    onClick={() => dispatch({ type: 'CLEAR_COURSE' })}
                    className="bg-transparent border-0 text-inherit p-0 leading-none text-base"
                    aria-label="Clear course"
                  >
                    ×
                  </button>
                </span>
              </div>
            ) : (
              <div ref={dropdownRef} className="relative">
                <input
                  type="text"
                  placeholder="Course name"
                  value={state.courseName}
                  onChange={(e) =>
                    dispatch({ type: 'SET_COURSE_NAME', courseName: e.target.value })
                  }
                  onFocus={() => setShowDropdown(true)}
                  className={input}
                />

                {showDropdown && (filteredCourses.length > 0 || showAddNew) && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-shadow border border-border rounded-md overflow-hidden z-50">
                    {filteredCourses.map((c) => (
                      <button
                        key={c.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectCourse(c);
                        }}
                        className="block w-full px-3.5 py-2.5 bg-transparent border-b border-border text-cement font-body text-[13px] text-left last:border-b-0"
                      >
                        {c.name}
                      </button>
                    ))}
                    {showAddNew && (
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addNewCourse();
                        }}
                        className="block w-full px-3.5 py-2.5 bg-transparent text-scarlet-glow font-body text-[13px] text-left"
                      >
                        + Add &ldquo;{state.courseName.trim()}&rdquo; as new course
                      </button>
                    )}
                  </div>
                )}

                {showFuzzyHint && fuzzyMatch && (
                  <div className="mt-1.5">
                    <button
                      onClick={() => selectCourse(fuzzyMatch)}
                      className="bg-transparent border-0 font-body text-xs text-ash p-0 text-left"
                    >
                      Did you mean{' '}
                      <strong className="text-chalk">{fuzzyMatch.name}</strong>?
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mb-4">
            <input
              type="text"
              placeholder="City, State"
              value={state.location}
              onChange={(e) => dispatch({ type: 'SET_LOCATION', location: e.target.value })}
              className={input}
            />
          </div>

          <div className="border border-border rounded-md px-4 py-3.5">
            <span className={`${containerLabel} mb-1.5`}>Conditions</span>
            <span className="font-body text-[13px] text-ash">
              Weather will be pulled automatically
            </span>
          </div>
        </div>

        {/* ── Container 3: WHAT ── */}
        <div className={container}>
          <span className={containerLabel}>What</span>

          <div className="flex flex-col gap-2">
            {ROUND_TYPES.map((rt) => {
              const selected = state.roundType === rt;
              return (
                <button
                  key={rt}
                  onClick={() => dispatch({ type: 'SET_ROUND_TYPE', roundType: rt })}
                  className={roundTypeBtnClass(selected)}
                >
                  {rt}
                </button>
              );
            })}
          </div>

          <div
            className={
              'overflow-hidden transition-[max-height] duration-200 ' +
              (needsRoundNumber ? 'max-h-[140px]' : 'max-h-0')
            }
          >
            <div className="border-t border-border mt-4 pt-4">
              <span className={`${containerLabel} mb-2.5`}>Round</span>
              <div className="flex gap-2">
                {ROUND_NUMBERS.map((n) => {
                  const selected = state.roundNumber === n;
                  return (
                    <button
                      key={n}
                      onClick={() =>
                        dispatch({ type: 'SET_ROUND_NUMBER', roundNumber: n })
                      }
                      className={roundNumBtnClass(selected)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <Button
          disabled={!isValid || isSubmitting}
          onClick={handleStart}
          className="w-full"
          size="lg"
        >
          Start Round →
        </Button>
      </div>
    </div>
  );
}
