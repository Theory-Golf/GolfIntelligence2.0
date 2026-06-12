'use client';

/**
 * Golf Intelligence Dashboard — Main Orchestrator
 * Single client-side page with tab-based navigation
 */

import { useState, lazy, Suspense } from 'react';
import '@/styles/dashboard.css';
import { useGolfData } from '@/lib/golf/useGolfData';
import { getBenchmarkOptions } from '@/lib/golf/benchmarks';
import type { BenchmarkType } from '@/lib/golf/benchmarks';
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
    performanceDrivers,
    playerPathMetrics,
    performanceDriversV2,
    coachTableMetrics,
    isLoading,
    error,
    lastUpdated,
    filterOptions,
    cascadingFilterOptions,
    filters,
    setFilters,
    clearFilters,
    benchmark,
    setBenchmark,
  } = useGolfData();

  const benchmarkOptions = getBenchmarkOptions();

  const handleBenchmarkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBenchmark(e.target.value as BenchmarkType);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1><span style={{ fontFamily: 'var(--font-body)' }}>Golf</span> <em>Intelligence</em></h1>
          <p className="subtitle">By: Theory Golf</p>
        </div>
        {/* Benchmark Selector */}
        <div className="benchmark-selector">
          <label htmlFor="benchmark-select">Benchmark:</label>
          <select
            id="benchmark-select"
            value={benchmark}
            onChange={handleBenchmarkChange}
            className="benchmark-dropdown"
          >
            {benchmarkOptions.map(opt => (
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
        />
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
            <a
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
            </a>
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
              <PlayerPathView drivers={performanceDrivers} playerPathMetrics={playerPathMetrics} performanceDriversV2={performanceDriversV2} />
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
