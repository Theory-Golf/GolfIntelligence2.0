'use client';

/**
 * Golf Intelligence Dashboard — Main Orchestrator
 * Single client-side page with tab-based navigation
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import Link from 'next/link';
import '@/styles/dashboard.css';
import { useGolfData } from '@/lib/golf/useGolfData';
import { getBenchmarkTierOptions, getGenderOptions } from '@/lib/golf/benchmarks';
import type { BenchmarkTier, Gender } from '@/lib/golf/benchmarks';
import { DashboardNav } from './DashboardNav';
import { FilterBar } from './FilterBar';

// Lazy-load each view — only the active tab's code is fetched
const Tiger5View = lazy(() => import('./Tiger5View').then(m => ({ default: m.Tiger5View })));
const RoundsView = lazy(() => import('./RoundsView').then(m => ({ default: m.RoundsView })));
const StrokesGainedView = lazy(() => import('./StrokesGainedView').then(m => ({ default: m.StrokesGainedView })));
const DrivingView = lazy(() => import('./DrivingView').then(m => ({ default: m.DrivingView })));
const ApproachView = lazy(() => import('./ApproachView').then(m => ({ default: m.ApproachView })));
const PuttingView = lazy(() => import('./PuttingView').then(m => ({ default: m.PuttingView })));
const ScoringView = lazy(() => import('./ScoringView').then(m => ({ default: m.ScoringView })));
const ShortGameView = lazy(() => import('./ShortGameView').then(m => ({ default: m.ShortGameView })));
const PlayerPathView = lazy(() => import('./PlayerPathView').then(m => ({ default: m.PlayerPathView })));
const CoachingView = lazy(() => import('./CoachingView').then(m => ({ default: m.CoachingView })));

function ViewLoading() {
  return (
    <div className="loading">
      <div className="loading-spinner"></div>
      <p style={{ marginTop: '16px' }}>Loading view...</p>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('tiger5');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Mobile drawer. Deliberately separate from sidebarCollapsed, which is
  // the desktop 280px-to-48px rail: conflating them would need a width
  // read during render (hydration mismatch) or in a mount effect (a flash
  // of an open full-height drawer). Which control is visible is decided
  // entirely in CSS, so nothing here measures the viewport.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Tabs are this dashboard's navigation; mirrors Navbar.tsx's
  // close-on-route-change.
  useEffect(() => { setFiltersOpen(false); }, [activeTab]);

  // Without this a flick that starts on the backdrop scrolls the
  // dashboard behind the drawer and the reader loses their place.
  useEffect(() => {
    if (!filtersOpen) return;
    document.body.classList.add('gi-scroll-lock');
    return () => document.body.classList.remove('gi-scroll-lock');
  }, [filtersOpen]);
  const {
    processedShots,
    filteredShots,
    roundSummaries,
    tiger5Metrics,
    scoringMetrics,
    birdieAndBogeyMetrics,
    drivingMetrics,
    drivingAnalysis,
    approachMetrics,
    approachByDistance,
    approachFromRough,
    approachHeatMapData,
    puttingMetrics,
    lagPuttingMetrics,
    mentalMetrics,
    shortGameMetrics,
    shortGameHeatMapData,
    driverEngine,
    segmentDiagnosis,
    practicePlan,
    coachTableMetrics,
    isLoading,
    error,
    lastUpdated,
    filterOptions,
    cascadingFilterOptions,
    filters,
    setFilters,
    clearFilters,
    benchmarkGender,
    setBenchmarkGender,
    benchmarkTier,
    setBenchmarkTier,
  } = useGolfData();

  const activeFilterCount =
    filters.playerIds.length +
    filters.courseIds.length +
    filters.roundTypes.length +
    filters.dates.length;

  const benchmarkTierOptions = getBenchmarkTierOptions();
  const genderOptions = getGenderOptions();

  const handleBenchmarkGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBenchmarkGender(e.target.value as Gender);
  };

  const handleBenchmarkTierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBenchmarkTier(e.target.value as BenchmarkTier);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>Golf <span className="header-accent">Intelligence</span></h1>
          <p className="subtitle">By: Theory Golf</p>
        </div>
        {/* Benchmark Selectors */}
        <div className="benchmark-selector">
          <label htmlFor="benchmark-gender-select">Benchmark:</label>
          <select
            id="benchmark-gender-select"
            value={benchmarkGender}
            onChange={handleBenchmarkGenderChange}
            className="benchmark-dropdown"
          >
            {genderOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            id="benchmark-tier-select"
            value={benchmarkTier}
            onChange={handleBenchmarkTierChange}
            className="benchmark-dropdown"
          >
            {benchmarkTierOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Navigation */}
      <DashboardNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Filter Bar */}
      {!isLoading && !error && processedShots.length > 0 && (
        <FilterBar
          filters={filters}
          options={filterOptions}
          validOptions={cascadingFilterOptions}
          onFilterChange={setFilters}
          onClear={clearFilters}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {/* Mobile filter trigger. Fixed rather than another sticky bar:
          the site Navbar and the tab strip already take 113px of an
          844px viewport. Hidden at >=768px by .filter-fab's guard. */}
      {!isLoading && !error && processedShots.length > 0 && !filtersOpen && (
        <button
          type="button"
          className="filter-fab"
          onClick={() => setFiltersOpen(true)}
          aria-label="Open filters"
          aria-expanded={filtersOpen}
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="filter-fab-count">{activeFilterCount}</span>
          )}
        </button>
      )}

      {/* Main Content */}
      <main className={`main ${!isLoading && !error && processedShots.length > 0 ? 'main-with-sidebar' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {isLoading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p style={{ marginTop: '16px' }}>Loading golf data...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>{error}</p>
            <p style={{ marginTop: '8px', fontSize: '12px' }}>
              There was a problem loading your data. Make sure you are signed in, then refresh the page.
            </p>
          </div>
        )}

        {!isLoading && !error && processedShots.length === 0 && (
          <div className="loading">
            <p style={{ fontSize: '16px', color: 'var(--chalk)' }}>No rounds yet</p>
            <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--ash)' }}>
              Enter your first round to see your Golf Intelligence dashboard.
            </p>
            <Link
              href="/golf-intelligence/round/new"
              style={{
                marginTop: '16px',
                display: 'inline-block',
                padding: '10px 20px',
                background: 'var(--scarlet)',
                color: 'var(--chalk)',
                borderRadius: '4px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Enter a round
            </Link>
          </div>
        )}

        {!isLoading && !error && processedShots.length > 0 && (
          <Suspense fallback={<ViewLoading />}>
            {activeTab === 'tiger5' && (
              <Tiger5View metrics={tiger5Metrics} lastUpdated={lastUpdated} />
            )}

            {activeTab === 'rounds' && (
              <RoundsView roundSummaries={roundSummaries} filteredShots={filteredShots} />
            )}

            {activeTab === 'sg' && (
              <StrokesGainedView metrics={tiger5Metrics} filteredShots={filteredShots} />
            )}

            {activeTab === 'driving' && (
              <DrivingView metrics={drivingMetrics} analysis={drivingAnalysis} filteredShots={filteredShots} />
            )}

            {activeTab === 'approach' && (
              <ApproachView metrics={approachMetrics} approachByDistance={approachByDistance} approachFromRough={approachFromRough} approachHeatMapData={approachHeatMapData} filteredShots={filteredShots} />
            )}

            {activeTab === 'putting' && (
              <PuttingView metrics={puttingMetrics} lagMetrics={lagPuttingMetrics} filteredShots={filteredShots} />
            )}

            {activeTab === 'scoring' && (
              <ScoringView metrics={scoringMetrics} birdieAndBogeyMetrics={birdieAndBogeyMetrics} mentalMetrics={mentalMetrics} />
            )}

            {activeTab === 'path' && (
              <PlayerPathView
            driverEngine={driverEngine}
            benchmark={{ gender: benchmarkGender, tier: benchmarkTier }}
            diagnosis={segmentDiagnosis}
            practicePlan={practicePlan}
          />
            )}

            {activeTab === 'shortgame' && (
              <ShortGameView metrics={shortGameMetrics} shortGameHeatMapData={shortGameHeatMapData} filteredShots={filteredShots} />
            )}

            {activeTab === 'coaching' && (
              <CoachingView metrics={coachTableMetrics} />
            )}
          </Suspense>
        )}
      </main>
    </div>
  );
}
