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
import { persistOrQueue } from '@/lib/golf/offlineQueue';
import {
  geocodeLocation,
  fetchWeather,
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
  courseId: string | null;
  courseName: string;
  locationCity: string;
  locationState: string;
  locationZip: string;
  roundType: RoundType | null;
  roundNumber: number | null;
  weather: WeatherFields;
  geocode: GeocodeResult | null;
  weatherStatus: WeatherStatus;
}

type Action =
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_COURSE'; courseId: string; courseName: string }
  | { type: 'SET_COURSE_NAME'; courseName: string }
  | { type: 'CLEAR_COURSE' }
  | { type: 'SET_LOCATION_CITY'; city: string }
  | { type: 'SET_LOCATION_STATE'; stateAbbr: string }
  | { type: 'SET_LOCATION_ZIP'; zip: string }
  | { type: 'SET_ROUND_TYPE'; roundType: RoundType }
  | { type: 'SET_ROUND_NUMBER'; roundNumber: number }
  | { type: 'SET_WEATHER_FIELD'; field: keyof WeatherFields; value: string }
  | { type: 'SET_GEOCODE'; geocode: GeocodeResult | null }
  | { type: 'SET_WEATHER_STATUS'; status: WeatherStatus }
  | { type: 'SET_WEATHER_AUTO'; weather: WeatherFields };

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
    case 'SET_LOCATION_CITY':
      return { ...state, locationCity: action.city };
    case 'SET_LOCATION_STATE':
      return { ...state, locationState: action.stateAbbr };
    case 'SET_LOCATION_ZIP':
      return { ...state, locationZip: action.zip };
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
    case 'SET_GEOCODE':
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
    locationCity: '',
    locationState: '',
    locationZip: '',
    roundType: null,
    roundNumber: null,
    weather: EMPTY_WEATHER,
    geocode: null,
    weatherStatus: 'idle',
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
    function onPointerDown(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const locationQuery = state.locationZip.trim()
    ? state.locationZip.trim()
    : state.locationCity.trim() && state.locationState.trim()
      ? `${state.locationCity.trim()}, ${state.locationState.trim()}`
      : '';

  const locationString = locationQuery || null;

  // Geocode the location field on a 600ms debounce.
  const geocodeReqId = useRef(0);
  useEffect(() => {
    const query = locationQuery;
    if (!query) {
      dispatch({ type: 'SET_GEOCODE', geocode: null });
      dispatch({ type: 'SET_WEATHER_STATUS', status: 'idle' });
      return;
    }
    const my = ++geocodeReqId.current;
    dispatch({ type: 'SET_WEATHER_STATUS', status: 'loading' });
    const t = setTimeout(async () => {
      const result = await geocodeLocation(query);
      if (my !== geocodeReqId.current) return;
      if (!result) {
        dispatch({ type: 'SET_GEOCODE', geocode: null });
        dispatch({ type: 'SET_WEATHER_STATUS', status: 'manual' });
        return;
      }
      dispatch({ type: 'SET_GEOCODE', geocode: result });
    }, 600);
    return () => clearTimeout(t);
  }, [locationQuery]);

  // Re-fetch weather whenever geocode or date changes, on a 300ms debounce.
  const weatherReqId = useRef(0);
  useEffect(() => {
    if (!state.geocode) return;
    const my = ++weatherReqId.current;
    dispatch({ type: 'SET_WEATHER_STATUS', status: 'loading' });
    const { lat, lon } = state.geocode;
    const date = state.date;
    const t = setTimeout(async () => {
      const w = await fetchWeather(lat, lon, date);
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
    }, 300);
    return () => clearTimeout(t);
  }, [state.geocode, state.date]);

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

    const numericTemp = state.weather.temp.trim();
    const numericWind = state.weather.windSpeed.trim();
    const numericPrecip = state.weather.precip.trim();

    void persistOrQueue({
      type: 'upsertRound',
      payload: {
        id: roundId,
        player_id: playerId,
        course_id: state.courseId,
        date: state.date,
        round_type: state.roundType,
        round_number: state.roundNumber,
        location: locationString,
        weather_temp: numericTemp === '' ? null : Number(numericTemp),
        weather_wind_speed: numericWind === '' ? null : Number(numericWind),
        weather_wind_direction:
          state.weather.windDirection.trim() || null,
        weather_precip: numericPrecip === '' ? null : Number(numericPrecip),
      },
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
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCourse(c)}
                        className="block w-full px-3.5 py-2.5 bg-transparent border-b border-border text-cement font-body text-[13px] text-left last:border-b-0"
                      >
                        {c.name}
                      </button>
                    ))}
                    {showAddNew && (
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addNewCourse()}
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

          <div className="mb-2">
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="City"
                  value={state.locationCity}
                  onChange={(e) =>
                    dispatch({ type: 'SET_LOCATION_CITY', city: e.target.value })
                  }
                  className={input}
                />
              </div>
              <div className="w-14 flex-shrink-0">
                <input
                  type="text"
                  placeholder="ST"
                  value={state.locationState}
                  maxLength={2}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_LOCATION_STATE',
                      stateAbbr: e.target.value.toUpperCase(),
                    })
                  }
                  className={input}
                />
              </div>
              <div className="w-20 flex-shrink-0">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Zip"
                  value={state.locationZip}
                  maxLength={5}
                  onChange={(e) =>
                    dispatch({ type: 'SET_LOCATION_ZIP', zip: e.target.value.replace(/\D/g, '') })
                  }
                  className={input}
                />
              </div>
            </div>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-ash mt-1.5 min-h-[14px]">
              {state.weatherStatus === 'loading' && 'Fetching weather…'}
              {state.weatherStatus === 'ok' && state.geocode?.displayName}
              {state.weatherStatus === 'manual' &&
                'Location not found — enter weather manually'}
              {state.weatherStatus === 'idle' && ' '}
            </p>
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
