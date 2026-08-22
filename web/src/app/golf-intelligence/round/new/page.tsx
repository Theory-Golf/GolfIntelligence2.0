'use client';

import { useReducer, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  getCoursesByPlayer,
  upsertCourse,
  fuzzyMatchCourse,
} from '@/lib/golf/db/index';
import { createBrowserClient } from '@/lib/golf/db/client';
import { createId } from '@/lib/golf/utils/index';
import { writeDraft } from '@/lib/golf/draftStore';
import {
  resolveLocation,
  parseLocationQuery,
  fetchWeather,
  currentTimeHHMM,
  type GeocodeResult,
} from '@/lib/golf/weatherService';
import type { CourseRow, RoundType } from '@/lib/golf/db/types';

// ─── State ────────────────────────────────────────────────────────────────────

type WeatherStatus = 'idle' | 'loading' | 'ok' | 'manual';

interface WeatherFields {
  temp: string;
  windSpeed: string;
  windDirection: string;
  precip: string;
}

const EMPTY_WEATHER: WeatherFields = {
  temp: '',
  windSpeed: '',
  windDirection: '',
  precip: '',
};

interface RoundSetupState {
  date: string;
  teeTime: string;
  courseId: string | null;
  courseName: string;
  /** Free text: "Austin, TX", "Austin", or "78701" — all resolve. */
  locationInput: string;
  roundType: RoundType | null;
  roundNumber: number | null;
  weather: WeatherFields;
  geocode: GeocodeResult | null;
  /** Alternates offered when a city name is ambiguous ("Springfield"). */
  candidates: GeocodeResult[];
  weatherStatus: WeatherStatus;
}

type Action =
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_TEE_TIME'; teeTime: string }
  | { type: 'SET_COURSE'; courseId: string; courseName: string }
  | { type: 'SET_COURSE_NAME'; courseName: string }
  | { type: 'CLEAR_COURSE' }
  | { type: 'SET_LOCATION_INPUT'; value: string }
  | { type: 'SET_ROUND_TYPE'; roundType: RoundType }
  | { type: 'SET_ROUND_NUMBER'; roundNumber: number }
  | { type: 'SET_WEATHER_FIELD'; field: keyof WeatherFields; value: string }
  | { type: 'SET_CANDIDATES'; candidates: GeocodeResult[] }
  | { type: 'PICK_CANDIDATE'; geocode: GeocodeResult }
  | { type: 'SET_WEATHER_STATUS'; status: WeatherStatus }
  | { type: 'SET_WEATHER_AUTO'; weather: WeatherFields };

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function reducer(state: RoundSetupState, action: Action): RoundSetupState {
  switch (action.type) {
    case 'SET_DATE':
      return { ...state, date: action.date };
    case 'SET_TEE_TIME':
      return { ...state, teeTime: action.teeTime };
    case 'SET_COURSE':
      return { ...state, courseId: action.courseId, courseName: action.courseName };
    case 'SET_COURSE_NAME':
      return { ...state, courseName: action.courseName, courseId: null };
    case 'CLEAR_COURSE':
      return { ...state, courseId: null, courseName: '' };
    case 'SET_LOCATION_INPUT':
      return { ...state, locationInput: action.value };
    case 'SET_ROUND_TYPE':
      return {
        ...state,
        roundType: action.roundType,
        roundNumber: action.roundType === 'Practice' ? null : state.roundNumber,
      };
    case 'SET_ROUND_NUMBER':
      return { ...state, roundNumber: action.roundNumber };
    case 'SET_WEATHER_FIELD':
      return {
        ...state,
        weather: { ...state.weather, [action.field]: action.value },
      };
    case 'SET_CANDIDATES':
      return {
        ...state,
        candidates: action.candidates,
        geocode: action.candidates[0] ?? null,
        weatherStatus: action.candidates.length > 0 ? state.weatherStatus : 'manual',
      };
    case 'PICK_CANDIDATE':
      return { ...state, geocode: action.geocode };
    case 'SET_WEATHER_STATUS':
      return { ...state, weatherStatus: action.status };
    case 'SET_WEATHER_AUTO':
      return { ...state, weather: action.weather, weatherStatus: 'ok' };
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
// text-base (16px) is deliberate and load-bearing: iOS Safari auto-zooms the
// page when an input under 16px is focused, and because App Router navigations
// are same-document that zoom follows the player into the hole screens with no
// reload to reset it, offsetting every tap from there on.
const input =
  'w-full bg-shadow border border-border rounded-md px-3 py-2.5 text-chalk font-body text-base outline-none box-border';

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
    teeTime: currentTimeHHMM(),
    courseId: null,
    courseName: '',
    locationInput: '',
    roundType: null,
    roundNumber: null,
    weather: EMPTY_WEATHER,
    geocode: null,
    candidates: [],
    weatherStatus: 'idle',
  });

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const pendingCourseRef = useRef<Promise<void> | null>(null);

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
    function onPointerDown(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // The typed location only needs to be one of: ZIP, "City, ST", or a city.
  const locationInput = state.locationInput;
  const parsedLocation = parseLocationQuery(locationInput);

  // Geocode the location field on a 400ms debounce.
  const geocodeReqId = useRef(0);
  useEffect(() => {
    const query = locationInput.trim();
    const my = ++geocodeReqId.current;
    if (!parseLocationQuery(query)) {
      dispatch({ type: 'SET_CANDIDATES', candidates: [] });
      dispatch({ type: 'SET_WEATHER_STATUS', status: 'idle' });
      return;
    }
    dispatch({ type: 'SET_WEATHER_STATUS', status: 'loading' });
    const controller = new AbortController();
    const t = setTimeout(async () => {
      const results = await resolveLocation(query, controller.signal);
      if (my !== geocodeReqId.current) return;
      dispatch({ type: 'SET_CANDIDATES', candidates: results });
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [locationInput]);

  // Re-fetch weather whenever geocode, date, or tee time changes.
  const weatherReqId = useRef(0);
  const { geocode, date: roundDate, teeTime } = state;
  useEffect(() => {
    if (!geocode) return;
    const my = ++weatherReqId.current;
    dispatch({ type: 'SET_WEATHER_STATUS', status: 'loading' });
    const controller = new AbortController();
    const t = setTimeout(async () => {
      const w = await fetchWeather(
        geocode.lat,
        geocode.lon,
        roundDate,
        teeTime,
        controller.signal,
      );
      if (my !== weatherReqId.current) return;
      if (!w) {
        dispatch({ type: 'SET_WEATHER_STATUS', status: 'manual' });
        return;
      }
      dispatch({
        type: 'SET_WEATHER_AUTO',
        weather: {
          temp: String(Math.round(w.temp)),
          windSpeed: String(Math.round(w.windSpeed)),
          windDirection: w.windDirection,
          precip: w.precip.toFixed(2),
        },
      });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [geocode, roundDate, teeTime]);

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

  function addNewCourse() {
    if (!playerId || !state.courseName.trim()) return;
    setCourseError(null);
    const name = state.courseName.trim();
    const id = createId();
    const now = new Date().toISOString();
    const optimistic: CourseRow = { id, player_id: playerId, name, ...defaultPars, created_at: now, updated_at: now };
    // Optimistically add the course so the user can proceed immediately.
    setCourses((prev) => [...prev, optimistic]);
    selectCourse(optimistic);
    // Track the pending DB write so handleStart can await it before saving the round.
    const p = upsertCourse({ id, player_id: playerId, name, ...defaultPars })
      .then(() => { pendingCourseRef.current = null; })
      .catch((err) => {
        console.error('[addNewCourse]', err);
        pendingCourseRef.current = null;
        setCourseError('Course could not be saved — it will sync when online.');
      });
    pendingCourseRef.current = p;
  }

  async function handleStart() {
    if (!isValid || !playerId || isSubmitting || !state.roundType) return;
    setIsSubmitting(true);
    const roundId = createId();

    const numericTemp = state.weather.temp.trim();
    const numericWind = state.weather.windSpeed.trim();
    const numericPrecip = state.weather.precip.trim();

    // Ensure any in-flight course upsert completes before saving the round,
    // so the course FK exists in the DB when the round row is written.
    if (pendingCourseRef.current) await pendingCourseRef.current;

    // Build hole pars from the selected course so the session can start
    // even if the DB write hasn't completed yet.
    const selectedCourse = courses.find((c) => c.id === state.courseId);
    const holePars: Record<number, number> = {};
    for (let i = 1; i <= 18; i++) {
      const key = `par_hole_${i}` as keyof typeof defaultPars;
      holePars[i] = selectedCourse ? (selectedCourse[key as keyof CourseRow] as number) : 4;
    }
    // Nothing is written to the DB until the player presses "Submit round"
    // on the review screen — the round lives in a local draft until then.
    const ok = writeDraft(roundId, {
      version: 1,
      round: {
        id: roundId,
        player_id: playerId,
        course_id: state.courseId,
        played_on: state.date,
        round_type: state.roundType,
        round_number: state.roundNumber,
        // Prefer the resolved place; fall back to whatever was typed so the
        // round still records a location when geocoding was unavailable.
        location_city:
          state.geocode?.city ??
          (parsedLocation?.kind === 'place' ? parsedLocation.city : null),
        location_state:
          state.geocode?.stateAbbr ??
          (parsedLocation?.kind === 'place' ? parsedLocation.stateAbbr : null),
        weather_temp_f: numericTemp === '' ? null : Number(numericTemp),
        weather_wind_mph: numericWind === '' ? null : Number(numericWind),
        weather_wind_dir: state.weather.windDirection.trim() || null,
        weather_precip: numericPrecip === '' ? null : Number(numericPrecip),
      },
      courseName: state.courseName,
      holePars,
      holes: [],
      updatedAt: new Date().toISOString(),
    });

    if (!ok) {
      setSubmitWarning('Could not save the round on this device — storage may be full.');
      setIsSubmitting(false);
      return;
    }

    router.push(`/golf-intelligence/round/${roundId}/hole/1`);
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
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
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <input
                type="date"
                value={state.date}
                onChange={(e) => dispatch({ type: 'SET_DATE', date: e.target.value })}
                className={`${input} [color-scheme:dark]`}
              />
            </div>
            <div className="w-32 flex-shrink-0">
              <input
                type="time"
                value={state.teeTime}
                onChange={(e) => dispatch({ type: 'SET_TEE_TIME', teeTime: e.target.value })}
                className={`${input} [color-scheme:dark]`}
              />
            </div>
          </div>
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
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => selectCourse(c)}
                        className="block w-full px-3.5 py-2.5 bg-transparent border-b border-border text-cement font-body text-[13px] text-left last:border-b-0"
                      >
                        {c.name}
                      </button>
                    ))}
                    {showAddNew && (
                      <button
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => addNewCourse()}
                        className="block w-full px-3.5 py-2.5 bg-transparent text-scarlet-glow font-body text-[13px] text-left"
                      >
                        + Add &ldquo;{state.courseName.trim()}&rdquo; as new course
                      </button>
                    )}
                  </div>
                )}

                {courseError && (
                  <p className="mt-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-scarlet">
                    {courseError}
                  </p>
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

          <div className="mb-2">
            <input
              type="text"
              placeholder="City, state or ZIP"
              value={state.locationInput}
              onChange={(e) =>
                dispatch({ type: 'SET_LOCATION_INPUT', value: e.target.value })
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="done"
              className={input}
            />
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash mt-1.5 min-h-[14px]">
              {state.weatherStatus === 'loading' && 'Finding location…'}
              {state.weatherStatus === 'ok' && state.geocode?.displayName}
              {state.weatherStatus === 'manual' &&
                (state.geocode
                  ? `${state.geocode.displayName} · weather unavailable`
                  : 'Location not found — enter weather manually')}
              {state.weatherStatus === 'idle' && ' '}
            </p>

            {/* Ambiguous city names ("Springfield") — offer the alternates. */}
            {state.candidates.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {state.candidates.map((c) => {
                  const active =
                    state.geocode?.lat === c.lat && state.geocode?.lon === c.lon;
                  return (
                    <button
                      key={`${c.lat},${c.lon}`}
                      type="button"
                      onClick={() =>
                        dispatch({ type: 'PICK_CANDIDATE', geocode: c })
                      }
                      className={
                        'rounded-sm px-2 py-1 border font-mono text-[10px] tracking-[0.15em] uppercase touch-manipulation ' +
                        (active
                          ? 'border-scarlet bg-scarlet-tint text-chalk'
                          : 'border-border bg-shadow text-ash')
                      }
                    >
                      {c.displayName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border border-border rounded-md px-4 py-3.5">
            <span className={`${containerLabel} mb-2`}>Conditions</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash">
                  Temp °F
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={state.weather.temp}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_WEATHER_FIELD',
                      field: 'temp',
                      value: e.target.value,
                    })
                  }
                  className={input}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash">
                  Wind mph
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={state.weather.windSpeed}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_WEATHER_FIELD',
                      field: 'windSpeed',
                      value: e.target.value,
                    })
                  }
                  className={input}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash">
                  Wind dir
                </span>
                <input
                  type="text"
                  value={state.weather.windDirection}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_WEATHER_FIELD',
                      field: 'windDirection',
                      value: e.target.value.toUpperCase(),
                    })
                  }
                  className={input}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash">
                  Precip in
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={state.weather.precip}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_WEATHER_FIELD',
                      field: 'precip',
                      value: e.target.value,
                    })
                  }
                  className={input}
                />
              </label>
            </div>
            {state.weatherStatus === 'ok' && (
              <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-ash mt-3">
                Weather auto-filled · edit if needed
              </p>
            )}
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

          {/* Rendered outright rather than animated open: this sits directly
              above "Start Round", and animating its height moves that button
              for 200ms after the round type is tapped. */}
          {needsRoundNumber && (
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
          )}
        </div>

        {submitWarning && (
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-yellow-400 text-center px-2">
            {submitWarning}
          </p>
        )}

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
