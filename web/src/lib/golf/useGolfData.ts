/**
 * Golf Intelligence — Data Loading Hook
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ProcessedShot, Tiger5Metrics, RoundSummary, FilterState, FilterOptions, FilterOption, DrivingMetrics, DrivingAnalysis, ProblemDriveMetrics, ApproachMetrics, ApproachDistanceBucket, ApproachHeatMapData, PuttingMetrics, PuttingDistanceBucket, LagPuttingMetrics, ScoringMetrics, MentalMetrics, BirdieAndBogeyMetrics, ShortGameMetrics, ShortGameHeatMapData, CoachTableMetrics } from './types';
import type { Gender, BenchmarkTier } from './benchmarks';
import { createBrowserClient } from './db/client';
import { processShots, calculateTiger5Metrics, getRoundSummaries, calculateDrivingMetrics, calculateDrivingAnalysis, calculateProblemDriveMetrics, calculateApproachMetrics, calculateApproachByDistance, calculateApproachFromRough, calculateApproachHeatMapData, calculatePuttingMetrics, calculatePuttingByDistance, calculateLagPuttingMetrics, calculateScoringMetrics, calculateMentalMetrics, calculateBirdieAndBogeyMetrics, calculateShortGameMetrics, calculateShortGameHeatMapData } from './calculations';
import { runDriverEngine, type DriverEngineResult } from './driverEngine';
import { runSegmentDiagnosis, type SegmentDiagnosisResult } from './segmentDiagnosis';
import { buildPracticePlan, type PracticePlan } from './practicePrescription';
import { calculateCoachTableMetrics } from './calculations';
import { fetchDashboardShots, type DashboardShotRow } from './db/dashboard';

// Sentinel for rounds without a linked course
const UNKNOWN_COURSE_ID = 'unknown';

interface UseGolfDataResult {
  processedShots: ProcessedShot[];
  filteredShots: ProcessedShot[];
  tiger5Metrics: Tiger5Metrics;
  scoringMetrics: ScoringMetrics;
  birdieAndBogeyMetrics: BirdieAndBogeyMetrics;
  drivingMetrics: DrivingMetrics;
  drivingAnalysis: DrivingAnalysis;
  problemDriveMetrics: ProblemDriveMetrics;
  approachMetrics: ApproachMetrics;
  approachByDistance: ApproachDistanceBucket[];
  approachFromRough: ApproachDistanceBucket[];
  approachHeatMapData: ApproachHeatMapData;
  puttingMetrics: PuttingMetrics;
  puttingByDistance: PuttingDistanceBucket[];
  lagPuttingMetrics: LagPuttingMetrics;
  mentalMetrics: MentalMetrics;
  shortGameMetrics: ShortGameMetrics;
  shortGameHeatMapData: ShortGameHeatMapData;
  driverEngine: DriverEngineResult;
  segmentDiagnosis: SegmentDiagnosisResult;
  practicePlan: PracticePlan;
  coachTableMetrics: CoachTableMetrics;
  roundSummaries: RoundSummary[];
  filterOptions: FilterOptions;
  cascadingFilterOptions: FilterOptions;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  clearFilters: () => void;
  benchmarkGender: Gender;
  setBenchmarkGender: (gender: Gender) => void;
  benchmarkTier: BenchmarkTier;
  setBenchmarkTier: (tier: BenchmarkTier) => void;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const initialFilters: FilterState = {
  playerIds: [],
  courseIds: [],
  roundTypes: [],
  dates: [],
};

function shotCourseId(shot: ProcessedShot): string {
  return shot.courseId ?? UNKNOWN_COURSE_ID;
}

// Build {value, label} options from shots, sorted by label
function buildOptions(shots: ProcessedShot[]): FilterOptions {
  const players = new Map<string, string>();
  const courses = new Map<string, string>();
  const roundTypes = new Set<string>();
  const dates = new Set<string>();

  shots.forEach(s => {
    players.set(s.playerId, s.playerName);
    courses.set(shotCourseId(s), s.courseName);
    roundTypes.add(s.roundType);
    dates.add(s.playedOn);
  });

  const toSorted = (map: Map<string, string>): FilterOption[] =>
    [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

  return {
    players: toSorted(players),
    courses: toSorted(courses),
    roundTypes: [...roundTypes].sort().map(value => ({ value, label: value })),
    // ISO dates sort correctly as strings
    dates: [...dates].sort().map(value => ({ value, label: value })),
  };
}

const emptyOptions: FilterOptions = { players: [], courses: [], roundTypes: [], dates: [] };

export function useGolfData(): UseGolfDataResult {
  const [rows, setRows] = useState<DashboardShotRow[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [benchmarkTier, setBenchmarkTier] = useState<BenchmarkTier>('eliteCollege');
  const [benchmarkGender, setBenchmarkGender] = useState<Gender>('male');
  const [genderTouched, setGenderTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Persisted to the player's profile as well as held locally, so the choice
  // follows them to another device instead of resetting to the male default.
  // Fire-and-forget: the dashboard should never block on this write, and a
  // failure only costs the player re-picking next time.
  const setBenchmarkGenderManual = useCallback((gender: Gender) => {
    setGenderTouched(true);
    setBenchmarkGender(gender);

    void (async () => {
      const supabase = createBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { error } = await supabase
        .from('profiles')
        .update({ gender })
        .eq('id', userData.user.id);
      if (error) console.error('Failed to save benchmark gender to profile:', error);
    })();
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchDashboardShots();
        setRows(data);
        setLastUpdated(new Date());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error loading data';
        setError(message);
        console.error('Failed to load golf data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Default the benchmark gender from the signed-in player's profile, once,
  // unless the viewer has already picked one manually.
  useEffect(() => {
    if (genderTouched) return;
    let cancelled = false;

    async function loadProfileGender() {
      const supabase = createBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', userData.user.id)
        .single();
      // Checked rather than ignored: a missing column or a failed request used
      // to be indistinguishable from "no gender set", so every player silently
      // fell back to the male benchmark with nothing logged.
      if (error) {
        console.error('Failed to read benchmark gender from profile:', error);
        return;
      }
      if (!cancelled && !genderTouched && (profile?.gender === 'male' || profile?.gender === 'female')) {
        setBenchmarkGender(profile.gender);
      }
    }

    loadProfileGender();
    return () => {
      cancelled = true;
    };
  }, [genderTouched]);

  const benchmark = useMemo(() => ({ gender: benchmarkGender, tier: benchmarkTier }), [benchmarkGender, benchmarkTier]);

  // Process shots when raw data or benchmark changes
  const processedShots = useMemo(() => {
    if (rows.length === 0) return [];
    return processShots(rows, benchmark);
  }, [rows, benchmark]);

  // Compute filter options from all data
  const filterOptions = useMemo<FilterOptions>(() => {
    if (processedShots.length === 0) return emptyOptions;
    return buildOptions(processedShots);
  }, [processedShots]);

  // Compute cascading filter options based on current selections
  // Bidirectional cascading: selecting items in one category filters options in all other categories
  // OR within each category: selecting multiple players shows rounds for ANY of those players
  // AND across categories: dates AND courses must both match
  const cascadingFilterOptions = useMemo<FilterOptions>(() => {
    if (processedShots.length === 0) return emptyOptions;

    // If no filters selected, show all options
    const hasAnyFilters = filters.playerIds.length > 0 || filters.courseIds.length > 0 || filters.roundTypes.length > 0 || filters.dates.length > 0;
    if (!hasAnyFilters) {
      return buildOptions(processedShots);
    }

    // For each category, calculate valid options by applying ALL other filters (NOT the current category)
    // This allows selecting multiple within each category while cascading to others
    const applyFilters = (shots: ProcessedShot[], skip: keyof FilterState): ProcessedShot[] => {
      let result = shots;
      if (skip !== 'playerIds' && filters.playerIds.length > 0) {
        result = result.filter(s => filters.playerIds.includes(s.playerId));
      }
      if (skip !== 'courseIds' && filters.courseIds.length > 0) {
        result = result.filter(s => filters.courseIds.includes(shotCourseId(s)));
      }
      if (skip !== 'roundTypes' && filters.roundTypes.length > 0) {
        result = result.filter(s => filters.roundTypes.includes(s.roundType));
      }
      if (skip !== 'dates' && filters.dates.length > 0) {
        result = result.filter(s => filters.dates.includes(s.playedOn));
      }
      return result;
    };

    return {
      players: buildOptions(applyFilters(processedShots, 'playerIds')).players,
      courses: buildOptions(applyFilters(processedShots, 'courseIds')).courses,
      roundTypes: buildOptions(applyFilters(processedShots, 'roundTypes')).roundTypes,
      dates: buildOptions(applyFilters(processedShots, 'dates')).dates,
    };
  }, [processedShots, filters]);

  // Filter shots based on selected filters
  const filteredShots = useMemo(() => {
    if (processedShots.length === 0) return [];

    return processedShots.filter(shot => {
      // If filter is empty, include all
      const playerMatch = filters.playerIds.length === 0 || filters.playerIds.includes(shot.playerId);
      const courseMatch = filters.courseIds.length === 0 || filters.courseIds.includes(shotCourseId(shot));
      const roundTypeMatch = filters.roundTypes.length === 0 || filters.roundTypes.includes(shot.roundType);
      const dateMatch = filters.dates.length === 0 || filters.dates.includes(shot.playedOn);

      return playerMatch && courseMatch && roundTypeMatch && dateMatch;
    });
  }, [processedShots, filters]);

  // Calculate metrics from filtered shots
  const tiger5Metrics = useMemo(() => {
    return calculateTiger5Metrics(filteredShots);
  }, [filteredShots]);

  // Calculate scoring metrics from filtered shots
  const scoringMetrics = useMemo(() => {
    return calculateScoringMetrics(filteredShots);
  }, [filteredShots]);

  // Calculate birdie and bogey metrics from filtered shots
  const birdieAndBogeyMetrics = useMemo(() => {
    return calculateBirdieAndBogeyMetrics(filteredShots);
  }, [filteredShots]);

  // Calculate driving metrics from filtered shots
  const drivingMetrics = useMemo(() => {
    return calculateDrivingMetrics(filteredShots);
  }, [filteredShots]);

  // Calculate driving analysis from filtered shots
  const drivingAnalysis = useMemo(() => {
    return calculateDrivingAnalysis(filteredShots);
  }, [filteredShots]);

  // Calculate problem drive metrics
  const problemDriveMetrics = useMemo(() => {
    return calculateProblemDriveMetrics(filteredShots);
  }, [filteredShots]);

  // Calculate approach metrics from filtered shots
  const approachMetrics = useMemo(() => {
    return calculateApproachMetrics(filteredShots);
  }, [filteredShots]);

  // Calculate approach by distance from filtered shots
  const approachByDistance = useMemo(() => {
    return calculateApproachByDistance(filteredShots);
  }, [filteredShots]);

  // Calculate approach from rough from filtered shots
  const approachFromRough = useMemo(() => {
    return calculateApproachFromRough(filteredShots);
  }, [filteredShots]);

  // Get unique rounds count for SG per Round calculation
  const uniqueRounds = useMemo(() => {
    return [...new Set(filteredShots.map(s => s.roundId))].length;
  }, [filteredShots]);

  // Calculate approach heat map data
  const approachHeatMapData = useMemo(() => {
    return calculateApproachHeatMapData(filteredShots, uniqueRounds);
  }, [filteredShots, uniqueRounds]);

  // Calculate putting metrics from filtered shots
  const puttingMetrics = useMemo(() => {
    return calculatePuttingMetrics(filteredShots, benchmark);
  }, [filteredShots, benchmark]);

  // Calculate putting by distance
  const puttingByDistance = useMemo(() => {
    return calculatePuttingByDistance(filteredShots, benchmark);
  }, [filteredShots, benchmark]);

  // Calculate lag putting metrics from filtered shots
  const lagPuttingMetrics = useMemo(() => {
    return calculateLagPuttingMetrics(filteredShots);
  }, [filteredShots]);

  // Calculate mental metrics from filtered shots
  const mentalMetrics = useMemo(() => {
    return calculateMentalMetrics(filteredShots, benchmark);
  }, [filteredShots, benchmark]);

  // Calculate short game metrics from filtered shots
  const shortGameMetrics = useMemo(() => {
    return calculateShortGameMetrics(filteredShots);
  }, [filteredShots]);

  // Calculate short game heat map data
  const shortGameHeatMapData = useMemo(() => {
    return calculateShortGameHeatMapData(filteredShots, uniqueRounds);
  }, [filteredShots, uniqueRounds]);

  // PlayerPath drivers: one engine over the 17 published specs. Depends on the
  // benchmark because both strokes gained and the derived putting thresholds
  // are relative to the selected tier.
  const driverEngine = useMemo(() => {
    return runDriverEngine(filteredShots, benchmark);
  }, [filteredShots, benchmark]);

  // The verdict layer above those drivers: which of the four segments is
  // costing strokes, and which built practice game addresses it.
  const segmentDiagnosis = useMemo(() => {
    return runSegmentDiagnosis(filteredShots, benchmark);
  }, [filteredShots, benchmark]);

  const practicePlan = useMemo(() => {
    return buildPracticePlan(segmentDiagnosis);
  }, [segmentDiagnosis]);

  // Calculate Coach Table metrics (per player pivot table)
  const coachTableMetrics = useMemo(() => {
    return calculateCoachTableMetrics(processedShots, benchmark);
  }, [processedShots, benchmark]);

  // Get round summaries from filtered shots
  const roundSummaries = useMemo(() => {
    return getRoundSummaries(filteredShots);
  }, [filteredShots]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  return {
    processedShots,
    filteredShots,
    tiger5Metrics,
    scoringMetrics,
    birdieAndBogeyMetrics,
    drivingMetrics,
    drivingAnalysis,
    problemDriveMetrics,
    approachMetrics,
    approachByDistance,
    approachFromRough,
    approachHeatMapData,
    puttingMetrics,
    puttingByDistance,
    lagPuttingMetrics,
    mentalMetrics,
    shortGameMetrics,
    shortGameHeatMapData,
    driverEngine,
    segmentDiagnosis,
    practicePlan,
    coachTableMetrics,
    roundSummaries,
    filterOptions,
    cascadingFilterOptions,
    filters,
    setFilters,
    clearFilters,
    benchmarkGender,
    setBenchmarkGender: setBenchmarkGenderManual,
    benchmarkTier,
    setBenchmarkTier,
    isLoading,
    error,
    lastUpdated,
  };
}
