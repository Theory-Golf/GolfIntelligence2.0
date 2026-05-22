'use client';

import { useReducer, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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

  // Load auth + player's courses
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

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ─── Derived ──────────────────────────────────────────────────────────────

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

  // Only show "Did you mean" when the match isn't already visible in the list
  const showFuzzyHint =
    fuzzyMatch !== null &&
    !filteredCourses.some((c) => c.id === fuzzyMatch.id);

  const showAddNew =
    state.courseId === null &&
    state.courseName.trim().length >= 2 &&
    !filteredCourses.some(
      (c) => c.name.toLowerCase() === state.courseName.trim().toLowerCase(),
    );

  // ─── Handlers ─────────────────────────────────────────────────────────────

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

    router.push(`/golf-intelligence/round/${roundId}`);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>

      {/* Page header */}
      <header style={headerStyle}>
        <span style={monoLabelStyle}>New Round</span>
        <span style={monoLabelStyle}>{playerName}</span>
      </header>

      {/* Scrollable form */}
      <div style={formWrapStyle}>

        {/* ── Container 1: WHEN ── */}
        <div style={containerStyle}>
          <span style={containerLabelStyle}>When</span>
          <input
            type="date"
            value={state.date}
            onChange={(e) => dispatch({ type: 'SET_DATE', date: e.target.value })}
            style={{ ...inputStyle, colorScheme: 'dark' }}
          />
        </div>

        {/* ── Container 2: WHERE ── */}
        <div style={containerStyle}>
          <span style={containerLabelStyle}>Where</span>

          {/* Course typeahead */}
          <div style={{ marginBottom: 12 }}>
            {state.courseId ? (
              /* Selected pill */
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={coursePillStyle}>
                  {state.courseName}
                  <button
                    onClick={() => dispatch({ type: 'CLEAR_COURSE' })}
                    style={pillClearBtnStyle}
                    aria-label="Clear course"
                  >
                    ×
                  </button>
                </span>
              </div>
            ) : (
              /* Typeahead input */
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Course name"
                  value={state.courseName}
                  onChange={(e) =>
                    dispatch({ type: 'SET_COURSE_NAME', courseName: e.target.value })
                  }
                  onFocus={() => setShowDropdown(true)}
                  style={inputStyle}
                />

                {/* Dropdown list */}
                {showDropdown && (filteredCourses.length > 0 || showAddNew) && (
                  <div style={dropdownStyle}>
                    {filteredCourses.map((c) => (
                      <button
                        key={c.id}
                        onMouseDown={(e) => {
                          e.preventDefault(); // keep focus on input until selection
                          selectCourse(c);
                        }}
                        style={dropdownItemStyle}
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
                        style={{ ...dropdownItemStyle, color: 'var(--scarlet-glow)', borderBottom: 'none' }}
                      >
                        + Add &ldquo;{state.courseName.trim()}&rdquo; as new course
                      </button>
                    )}
                  </div>
                )}

                {/* Fuzzy suggestion (when not already in list) */}
                {showFuzzyHint && fuzzyMatch && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      onClick={() => selectCourse(fuzzyMatch)}
                      style={fuzzySuggestionStyle}
                    >
                      Did you mean <strong style={{ color: 'var(--chalk)' }}>{fuzzyMatch.name}</strong>?
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location */}
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="City, State"
              value={state.location}
              onChange={(e) => dispatch({ type: 'SET_LOCATION', location: e.target.value })}
              style={inputStyle}
            />
          </div>

          {/* Weather placeholder */}
          <div style={weatherCardStyle}>
            <span style={{ ...containerLabelStyle, marginBottom: 6 }}>Conditions</span>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--ash)',
            }}>
              Weather will be pulled automatically
            </span>
          </div>
        </div>

        {/* ── Container 3: WHAT ── */}
        <div style={containerStyle}>
          <span style={containerLabelStyle}>What</span>

          {/* Round type selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ROUND_TYPES.map((rt) => {
              const selected = state.roundType === rt;
              return (
                <button
                  key={rt}
                  onClick={() => dispatch({ type: 'SET_ROUND_TYPE', roundType: rt })}
                  style={roundTypeBtnStyle(selected)}
                >
                  {rt}
                </button>
              );
            })}
          </div>

          {/* Round number — animated height */}
          <div style={{
            maxHeight: needsRoundNumber ? '140px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 240ms ease',
          }}>
            <div style={{
              borderTop: '1px solid var(--border-color)',
              marginTop: 16,
              paddingTop: 16,
            }}>
              <span style={{ ...containerLabelStyle, marginBottom: 10 }}>Round</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {ROUND_NUMBERS.map((n) => {
                  const selected = state.roundNumber === n;
                  return (
                    <button
                      key={n}
                      onClick={() => dispatch({ type: 'SET_ROUND_NUMBER', roundNumber: n })}
                      style={roundNumBtnStyle(selected)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Start button */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-color)',
};

const monoLabelStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.25em',
  textTransform: 'uppercase',
  color: 'var(--ash)',
};

const formWrapStyle: CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const containerStyle: CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: 24,
};

const containerLabelStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.3em',
  textTransform: 'uppercase',
  color: 'var(--ash)',
  display: 'block',
  marginBottom: 12,
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--shadow)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 12px',
  color: 'var(--chalk)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const coursePillStyle: CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--accent-foreground)',
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const pillClearBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
  fontSize: 16,
};

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: 'var(--shadow)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  zIndex: 50,
};

const dropdownItemStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '11px 14px',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--border-color)',
  color: 'var(--cement)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left',
};

const fuzzySuggestionStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  fontSize: 12,
  color: 'var(--ash)',
  padding: 0,
  textAlign: 'left',
};

const weatherCardStyle: CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: '14px 16px',
};

function roundTypeBtnStyle(selected: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '12px 16px',
    border: `1px solid ${selected ? 'var(--scarlet)' : 'var(--border-color)'}`,
    borderRadius: 'var(--radius-md)',
    background: selected ? 'var(--scarlet-tint)' : 'var(--shadow)',
    color: selected ? 'var(--chalk)' : 'var(--ash)',
    fontFamily: 'var(--font-display)',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 150ms ease, background 150ms ease, color 150ms ease',
  };
}

function roundNumBtnStyle(selected: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '10px 0',
    border: `1px solid ${selected ? 'var(--scarlet)' : 'var(--border-color)'}`,
    borderRadius: 'var(--radius-md)',
    background: selected ? 'var(--scarlet-tint)' : 'var(--shadow)',
    color: selected ? 'var(--chalk)' : 'var(--ash)',
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'border-color 150ms ease, background 150ms ease, color 150ms ease',
  };
}
