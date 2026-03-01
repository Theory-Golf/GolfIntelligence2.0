import { useState, useMemo } from 'react'
import './styles/globals.css'
import { useGolfData } from './hooks/useGolfData'
import { TABS, Tiger5Metrics, Tiger5Fail, RootCauseMetrics, Tiger5FailDetails, RootCauseByFailTypeList, Tiger5TrendDataPoint, ProcessedShot, DrivingMetrics, DrivingAnalysis, ProblemDriveMetrics, ApproachMetrics, ApproachDistanceBucket } from './types/golf'
import { getStrokeGainedColor, getShotSGColor, formatStrokesGained, chartColors } from './styles/tokens'
import { calculateProblemDriveMetrics } from './utils/calculations'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart } from 'recharts'
import { FilterBar } from './components/FilterBar'
import { StrokesGainedTrendChart } from './components/StrokesGainedTrendChart'
import { getBenchmarkOptions } from './data/benchmarks'
import type { BenchmarkType } from './data/benchmarks'

function App() {
  const [activeTab, setActiveTab] = useState('tiger5')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { 
    filteredShots, 
    tiger5Metrics, 
    drivingMetrics,
    drivingAnalysis,
    approachMetrics,
    approachByDistance,
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
  } = useGolfData()

  const benchmarkOptions = getBenchmarkOptions()

  const handleBenchmarkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBenchmark(e.target.value as BenchmarkType)
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>Golf <em>Intelligence</em></h1>
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
      <nav className="nav">
        <div className="nav-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Filter Bar */}
      {!isLoading && !error && (
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
      <main className={`main ${!isLoading && !error ? 'main-with-sidebar' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
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
              Make sure your Google Sheet is published to the web (File → Share → Publish to web)
            </p>
          </div>
        )}

        {!isLoading && !error && activeTab === 'tiger5' && (
          <Tiger5View metrics={tiger5Metrics} lastUpdated={lastUpdated} />
        )}

        {!isLoading && !error && activeTab === 'sg' && (
          <StrokesGainedView metrics={tiger5Metrics} filteredShots={filteredShots} />
        )}

        {!isLoading && !error && activeTab === 'driving' && (
          <DrivingView metrics={drivingMetrics} analysis={drivingAnalysis} filteredShots={filteredShots} />
        )}

        {!isLoading && !error && activeTab === 'approach' && (
          <ApproachView metrics={approachMetrics} approachByDistance={approachByDistance} filteredShots={filteredShots} />
        )}
        
        {!isLoading && !error && activeTab !== 'tiger5' && activeTab !== 'sg' && activeTab !== 'driving' && activeTab !== 'approach' && (
          <div className="content">
            <div className="card">
              <h3>{TABS.find(t => t.id === activeTab)?.label}</h3>
              <p>Coming soon... ({filteredShots.length} shots loaded)</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

/**
 * Tiger 5 - Summary Metrics View
 */
function Tiger5View({ metrics }: { metrics: Tiger5Metrics; lastUpdated: Date | null }) {
  const { tiger5Fails, rootCause, failDetails, rootCauseByFailType, tiger5Trend, lowestRound, highestRound, avgScore, totalRounds } = metrics;
  
  // Calculate SG per round (average)
  const avgSGPerRound = totalRounds > 0 ? metrics.totalStrokesGained / totalRounds : 0;
  
  return (
    <div className="content">
      {/* Section Heading */}
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Tiger 5 Performance</h4>
      
      {/* Hero Cards - Section 1: Tiger 5 Fails, Average Score, Rounds */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {/* Card 1: Total Tiger 5 Fails */}
        <HeroCardWithSubValues
          label="Tiger 5 Fails"
          value={tiger5Fails.totalFails.toString()}
          bottomLeftLabel="Per Round"
          bottomLeftValue={tiger5Fails.failsPerRound.toFixed(1)}
          bottomRightLabel="SG on Fail Holes"
          bottomRightValue={formatStrokesGained(tiger5Fails.sgOnFailHoles)}
          isFlagship
        />
        
        {/* Card 2: Average Score */}
        <HeroCardWithSubValues
          label="Avg Score"
          value={avgScore.toFixed(1)}
          middleLabel="SG / Round"
          middleValue={formatStrokesGained(avgSGPerRound)}
        />
        
        {/* Card 3: Rounds */}
        <HeroCardWithSubValues
          label="Rounds"
          value={totalRounds.toString()}
          bottomLeftLabel="Lowest"
          bottomLeftValue={lowestRound.toString()}
          bottomRightLabel="Highest"
          bottomRightValue={highestRound.toString()}
        />
      </div>

      {/* Stat Cards - Tiger 5 Fail Breakdown */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginTop: '24px' }}>
        {getSortedTiger5Cards(tiger5Fails, totalRounds).map((card) => (
          <StatCardWithSG 
            key={card.label}
            label={card.label}
            value={card.value.toString()}
            valueColor={card.valueColor}
            percentage={card.percentage}
            sgValue={card.sg}
            color={card.color}
          />
        ))}
      </div>

      {/* Root Cause Section */}
      <RootCauseSection rootCause={rootCause} totalFailHoles={tiger5Fails.totalFails} />

      {/* Tiger 5 Fail Details Section */}
      <Tiger5FailDetailsSection failDetails={failDetails} />

      {/* Root Cause By Fail Type Section */}
      <RootCauseByFailTypeSection rootCauseByFailType={rootCauseByFailType} totalFails={tiger5Fails.totalFails} />

      {/* Tiger 5 Trend Chart */}
      <Tiger5TrendSection trendData={tiger5Trend} />

      {/* Potential Score Section - What if Tiger 5 fails reduced by 50% */}
      <PotentialScoreSection trendData={tiger5Trend} tiger5Fails={tiger5Fails} totalRounds={totalRounds} />
    </div>
  )
}

/**
 * Hero Card with sub-values (for Tiger 5 Fails and Average Score)
 */
function HeroCardWithSubValues({
  label,
  value,
  middleLabel,
  middleValue,
  bottomLeftLabel,
  bottomLeftValue,
  bottomRightLabel,
  bottomRightValue,
  isFlagship = false,
}: {
  label: string;
  value: string;
  middleLabel?: string;
  middleValue?: string;
  bottomLeftLabel?: string;
  bottomLeftValue?: string;
  bottomRightLabel?: string;
  bottomRightValue?: string;
  isFlagship?: boolean;
}) {
  return (
    <div className={`card-hero ${isFlagship ? 'is-flagship' : ''}`}>
      <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
        <div className="label" style={{ color: isFlagship ? 'var(--scarlet)' : 'var(--ash)' }}>
          {label}
        </div>
        {isFlagship && (
          <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
        )}
      </div>
      <div className="value-hero" style={{ color: 'var(--chalk)' }}>
        {value}
      </div>
      
      {/* Middle row (optional) */}
      {middleLabel && middleValue && (
        <div style={{ marginTop: '12px', padding: '8px 0', borderTop: '1px solid var(--charcoal)', borderBottom: '1px solid var(--charcoal)' }}>
          <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>{middleLabel}</div>
          <div className="value-stat" style={{ color: getStrokeGainedColor(parseFloat(middleValue)) }}>
            {middleValue}
          </div>
        </div>
      )}
      
      {/* Bottom row (optional) */}
      {(bottomLeftLabel || bottomRightLabel) && (
        <div className="flex justify-between" style={{ marginTop: '16px' }}>
          <div>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>{bottomLeftLabel}</div>
            <div className="value-stat">{bottomLeftValue}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>{bottomRightLabel}</div>
            <div className="value-stat">{bottomRightValue}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Tiger 5 Card data structure
 */
interface Tiger5CardData {
  label: string;
  value: number;
  failsPerRound: number;
  percentage: number;
  sg: number;
  color: string;
  valueColor: string;
}

/**
 * Get color based on fails per round
 * Green: <=0.25 per round
 * Yellow: 0.25 to 1 per round
 * Red: >1 per round
 */
function getFailsPerRoundColor(failsPerRound: number): string {
  if (failsPerRound <= 0.25) return 'var(--under)';      // Green
  if (failsPerRound <= 1) return 'var(--bogey)';          // Yellow/Amber
  return 'var(--double)';                                  // Red
}

/**
 * Get color based on penalty rate (lower is better)
 * <5%: Green (good)
 * 5-10%: Yellow (average)
 * >10%: Red (poor)
 */
function getPenaltyRateColor(penaltyRate: number): string {
  if (penaltyRate < 5) return 'var(--under)';    // Green
  if (penaltyRate <= 10) return 'var(--bogey)';   // Yellow
  return 'var(--double)';                         // Red
}

/**
 * Get color based on fairway percentage (higher is better)
 * >60%: Green (good)
 * 40-60%: Yellow (average)
 * <40%: Red (poor)
 */
function getFairwayPctColor(fairwayPct: number): string {
  if (fairwayPct > 60) return 'var(--under)';     // Green
  if (fairwayPct >= 40) return 'var(--bogey)';    // Yellow
  return 'var(--double)';                         // Red
}

/**
 * Sort Tiger 5 fails by count (most fails to least fails) and return card data
 */
function getSortedTiger5Cards(fails: Tiger5Fail, totalRounds: number): Tiger5CardData[] {
  const totalFails = fails.totalFails;
  
  // Chart colors for variety - one unique color per card
  const chartColors = [
    '#3D8EF0',  // Royal Blue
    '#A855F7',  // Court Purple
    '#06C8E0',  // Aqua
    '#D4F000',  // Volt
    '#F03DAA',  // Magenta
  ];
  
  const cards: Tiger5CardData[] = [
    { 
      label: '3 Putts', 
      value: fails.threePutts, 
      failsPerRound: totalRounds > 0 ? fails.threePutts / totalRounds : 0,
      percentage: totalFails > 0 ? (fails.threePutts / totalFails) * 100 : 0,
      sg: fails.threePuttsSG,
      color: chartColors[0],
      valueColor: ''
    },
    { 
      label: 'Bogey on Par 5', 
      value: fails.bogeyOnPar5, 
      failsPerRound: totalRounds > 0 ? fails.bogeyOnPar5 / totalRounds : 0,
      percentage: totalFails > 0 ? (fails.bogeyOnPar5 / totalFails) * 100 : 0,
      sg: fails.bogeyOnPar5SG,
      color: chartColors[1],
      valueColor: ''
    },
    { 
      label: 'Double Bogey', 
      value: fails.doubleBogey, 
      failsPerRound: totalRounds > 0 ? fails.doubleBogey / totalRounds : 0,
      percentage: totalFails > 0 ? (fails.doubleBogey / totalFails) * 100 : 0,
      sg: fails.doubleBogeySG,
      color: chartColors[2],
      valueColor: ''
    },
    { 
      label: 'Bogey: Approach <125', 
      value: fails.bogeyApproach, 
      failsPerRound: totalRounds > 0 ? fails.bogeyApproach / totalRounds : 0,
      percentage: totalFails > 0 ? (fails.bogeyApproach / totalFails) * 100 : 0,
      sg: fails.bogeyApproachSG,
      color: chartColors[3],
      valueColor: ''
    },
    { 
      label: 'Missed Green (Short Game)', 
      value: fails.missedGreen, 
      failsPerRound: totalRounds > 0 ? fails.missedGreen / totalRounds : 0,
      percentage: totalFails > 0 ? (fails.missedGreen / totalFails) * 100 : 0,
      sg: fails.missedGreenSG,
      color: chartColors[4],
      valueColor: ''
    },
  ];
  
  // Calculate valueColor for each card based on fails per round
  cards.forEach(card => {
    card.valueColor = getFailsPerRoundColor(card.failsPerRound);
  });
  
  // Sort by value (count) descending - most fails to least fails
  return cards.sort((a, b) => b.value - a.value);
}

/**
 * Stat Card with SG - Enhanced metric display for Tiger 5
 */
function StatCardWithSG({ 
  label, 
  value, 
  valueColor,
  percentage,
  sgValue,
  color 
}: { 
  label: string; 
  value: string;
  valueColor: string;
  percentage: number;
  sgValue: number;
  color: string;
}) {
  return (
    <div className="card-stat" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="label" style={{ color: 'var(--ash)', marginBottom: '12px' }}>
        {label}
      </div>
      <div className="value-stat" style={{ color: valueColor }}>{value}</div>
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>% of Fails</div>
          <div className="value-stat" style={{ fontSize: '12px' }}>{percentage.toFixed(1)}%</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Total SG</div>
          <div className="value-stat" style={{ color: getStrokeGainedColor(sgValue), fontSize: '12px' }}>
            {formatStrokesGained(sgValue)}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Root Cause By Fail Type Section - Shows root cause breakdown for each fail type
 */
function RootCauseByFailTypeSection({ rootCauseByFailType, totalFails }: { rootCauseByFailType: RootCauseByFailTypeList; totalFails: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const failTypes = [
    { key: 'threePutts', label: '3 Putts', data: rootCauseByFailType.threePutts },
    { key: 'bogeyOnPar5', label: 'Bogey on Par 5', data: rootCauseByFailType.bogeyOnPar5 },
    { key: 'doubleBogey', label: 'Double Bogey', data: rootCauseByFailType.doubleBogey },
    { key: 'bogeyApproach', label: 'Bogey: Approach <125', data: rootCauseByFailType.bogeyApproach },
    { key: 'missedGreen', label: 'Missed Green', data: rootCauseByFailType.missedGreen },
  ];

  const totalFailsInTypes = failTypes.reduce((sum, ft) => sum + ft.data.totalCount, 0);
  
  if (totalFailsInTypes === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 16px',
          background: 'var(--charcoal)',
          border: '1px solid var(--ash)',
          borderRadius: '4px',
          color: 'var(--chalk)',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        <span style={{ fontWeight: 600 }}>Root Cause by Fail Type</span>
        <span style={{ fontSize: '12px', color: 'var(--ash)' }}>
          {totalFailsInTypes} fails • {isExpanded ? '▲' : '▼'}
        </span>
      </button>
      
      {isExpanded && (
        <div style={{ marginTop: '16px' }}>
          {failTypes.map((failType) => {
            if (failType.data.totalCount === 0) return null;
            const data = failType.data;
            
            // Build root cause items based on fail type
            let rootCauseItems: { label: string; count: number; percentageOfFailType: number; percentageOfTotal: number; sgTotal: number }[] = [];
            
            if (failType.key === 'threePutts') {
              // For 3 Putts: Makeable Putts and Lag Putts
              if (data.makeablePutts > 0) {
                rootCauseItems.push({
                  label: 'Makeable Putts (0-12)',
                  count: data.makeablePutts,
                  percentageOfFailType: (data.makeablePutts / data.totalCount) * 100,
                  percentageOfTotal: totalFails > 0 ? (data.makeablePutts / totalFails) * 100 : 0,
                  sgTotal: data.makeablePuttsSG,
                });
              }
              if (data.lagPutts > 0) {
                rootCauseItems.push({
                  label: 'Lag Putts (13+)',
                  count: data.lagPutts,
                  percentageOfFailType: (data.lagPutts / data.totalCount) * 100,
                  percentageOfTotal: totalFails > 0 ? (data.lagPutts / totalFails) * 100 : 0,
                  sgTotal: data.lagPuttsSG,
                });
              }
            } else if (failType.key === 'missedGreen') {
              // For Missed Green: Show by starting lie
              if (data.byStartingLie && data.byStartingLie.length > 0) {
                data.byStartingLie.forEach((lie) => {
                  rootCauseItems.push({
                    label: `Starting Lie: ${lie.lie}`,
                    count: lie.count,
                    percentageOfFailType: lie.percentageOfFailType,
                    percentageOfTotal: lie.percentageOfTotal,
                    sgTotal: lie.sgTotal,
                  });
                });
              }
            } else {
              // Other fail types: standard root causes
              if (data.penalties > 0) rootCauseItems.push({ label: 'Penalties', count: data.penalties, percentageOfFailType: (data.penalties / data.totalCount) * 100, percentageOfTotal: totalFails > 0 ? (data.penalties / totalFails) * 100 : 0, sgTotal: data.penaltiesSG });
              if (data.driving > 0) rootCauseItems.push({ label: 'Driving', count: data.driving, percentageOfFailType: (data.driving / data.totalCount) * 100, percentageOfTotal: totalFails > 0 ? (data.driving / totalFails) * 100 : 0, sgTotal: data.drivingSG });
              if (data.approach > 0) rootCauseItems.push({ label: 'Approach', count: data.approach, percentageOfFailType: (data.approach / data.totalCount) * 100, percentageOfTotal: totalFails > 0 ? (data.approach / totalFails) * 100 : 0, sgTotal: data.approachSG });
              if (data.lagPutts > 0) rootCauseItems.push({ label: 'Lag Putts (13+)', count: data.lagPutts, percentageOfFailType: (data.lagPutts / data.totalCount) * 100, percentageOfTotal: totalFails > 0 ? (data.lagPutts / totalFails) * 100 : 0, sgTotal: data.lagPuttsSG });
              if (data.makeablePutts > 0) rootCauseItems.push({ label: 'Makeable Putts (0-12)', count: data.makeablePutts, percentageOfFailType: (data.makeablePutts / data.totalCount) * 100, percentageOfTotal: totalFails > 0 ? (data.makeablePutts / totalFails) * 100 : 0, sgTotal: data.makeablePuttsSG });
              if (data.shortGame > 0) rootCauseItems.push({ label: 'Short Game', count: data.shortGame, percentageOfFailType: (data.shortGame / data.totalCount) * 100, percentageOfTotal: totalFails > 0 ? (data.shortGame / totalFails) * 100 : 0, sgTotal: data.shortGameSG });
              if (data.recovery > 0) rootCauseItems.push({ label: 'Recovery', count: data.recovery, percentageOfFailType: (data.recovery / data.totalCount) * 100, percentageOfTotal: totalFails > 0 ? (data.recovery / totalFails) * 100 : 0, sgTotal: data.recoverySG });
            }
            
            return (
              <div key={failType.key} style={{ marginBottom: '20px', padding: '12px', background: 'var(--charcoal)', borderRadius: '4px' }}>
                <h5 style={{ marginBottom: '12px', color: 'var(--chalk)', fontSize: '13px', fontWeight: 600 }}>
                  {failType.label} ({data.totalCount})
                </h5>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                      <th style={{ textAlign: 'left', padding: '6px', color: 'var(--ash)', width: '35%' }}>Root Cause</th>
                      <th style={{ textAlign: 'right', padding: '6px', color: 'var(--ash)', width: '15%' }}>Count</th>
                      <th style={{ textAlign: 'right', padding: '6px', color: 'var(--ash)', width: '20%' }}>% of Fail Type</th>
                      <th style={{ textAlign: 'right', padding: '6px', color: 'var(--ash)', width: '15%' }}>% of Total</th>
                      <th style={{ textAlign: 'right', padding: '6px', color: 'var(--ash)', width: '15%' }}>Total SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rootCauseItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                        <td style={{ padding: '6px', color: 'var(--chalk)' }}>{item.label}</td>
                        <td style={{ padding: '6px', textAlign: 'right', color: 'var(--chalk)' }}>{item.count}</td>
                        <td style={{ padding: '6px', textAlign: 'right', color: 'var(--ash)' }}>{item.percentageOfFailType.toFixed(1)}%</td>
                        <td style={{ padding: '6px', textAlign: 'right', color: 'var(--ash)' }}>{item.percentageOfTotal.toFixed(1)}%</td>
                        <td style={{ padding: '6px', textAlign: 'right', color: getStrokeGainedColor(item.sgTotal || 0) }}>{formatStrokesGained(item.sgTotal || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Tiger 5 Fail Details Section - Collapsible section showing detailed fail information
 */
function Tiger5FailDetailsSection({ failDetails }: { failDetails: Tiger5FailDetails }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Group fail types with their details
  const failTypes = [
    { key: 'threePutts', label: '3 Putts', details: failDetails.threePutts },
    { key: 'bogeyOnPar5', label: 'Bogey on Par 5', details: failDetails.bogeyOnPar5 },
    { key: 'doubleBogey', label: 'Double Bogey', details: failDetails.doubleBogey },
    { key: 'bogeyApproach', label: 'Bogey: Approach <125', details: failDetails.bogeyApproach },
    { key: 'missedGreen', label: 'Missed Green', details: failDetails.missedGreen },
  ];

  const totalFails = failTypes.reduce((sum, ft) => sum + ft.details.length, 0);
  
  if (totalFails === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 16px',
          background: 'var(--charcoal)',
          border: '1px solid var(--ash)',
          borderRadius: '4px',
          color: 'var(--chalk)',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        <span style={{ fontWeight: 600 }}>Tiger 5 Fail Details</span>
        <span style={{ fontSize: '12px', color: 'var(--ash)' }}>
          {totalFails} fails • {isExpanded ? '▲' : '▼'}
        </span>
      </button>
      
      {isExpanded && (
        <div style={{ marginTop: '16px' }}>
          {failTypes.map((failType) => {
            if (failType.details.length === 0) return null;
            return (
              <div key={failType.key} style={{ marginBottom: '24px' }}>
                <h5 style={{ marginBottom: '12px', color: 'var(--chalk)', fontSize: '13px', fontWeight: 600 }}>
                  {failType.label} ({failType.details.length})
                </h5>
                {failType.details.map((detail, idx) => (
                  <div key={idx} style={{ marginBottom: '16px', padding: '12px', background: 'var(--charcoal)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', fontSize: '12px', color: 'var(--chalk)' }}>
                      <span><strong>Date:</strong> {detail.date}</span>
                      <span><strong>Course:</strong> {detail.course}</span>
                      <span><strong>Hole:</strong> {detail.hole} (Par {detail.par})</span>
                      <span><strong>Score:</strong> {detail.score}</span>
                    </div>
                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                          <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>Shot #</th>
                          <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>Start Lie</th>
                          <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>Start Dist</th>
                          <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>End Lie</th>
                          <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>End Dist</th>
                          <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>Penalty</th>
                          <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>SG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.shots.map((shot, shotIdx) => (
                          <tr key={shotIdx} style={{ borderBottom: '1px solid var(--charcoal)' }}>
                            <td style={{ padding: '4px' }}>{shot.Shot}</td>
                            <td style={{ padding: '4px' }}>{shot['Starting Lie']}</td>
                            <td style={{ padding: '4px' }}>{shot['Starting Distance']}</td>
                            <td style={{ padding: '4px' }}>{shot['Ending Lie']}</td>
                            <td style={{ padding: '4px' }}>{shot['Ending Distance']}</td>
                            <td style={{ padding: '4px' }}>{shot.Penalty}</td>
                            <td style={{ padding: '4px', textAlign: 'right', color: getShotSGColor(shot.calculatedStrokesGained) }}>
                              {formatStrokesGained(shot.calculatedStrokesGained)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Tiger 5 Trend Section - Dual axis chart with stacked bars and line
 */
function Tiger5TrendSection({ trendData }: { trendData: Tiger5TrendDataPoint[] }) {
  if (trendData.length === 0) {
    return null;
  }

  // Colors matching Tiger 5 stat cards
  const COLORS = {
    threePutts: '#3D8EF0',    // Royal Blue
    bogeyOnPar5: '#A855F7',   // Court Purple
    doubleBogey: '#06C8E0',   // Aqua
    bogeyApproach: '#D4F000', // Volt
    missedGreen: '#F03DAA',  // Magenta
  };

  // Format x-axis label as "Date - Course"
  const formattedData = trendData.map(d => ({
    ...d,
    label: `${d.date.substring(5)} - ${d.course}`,
  }));

  return (
    <div style={{ marginTop: '24px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Tiger 5 Trend</h4>
      <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ash)" opacity={0.3} />
            <XAxis 
              dataKey="label" 
              stroke="var(--ash)" 
              tick={{ fill: 'var(--ash)', fontSize: 10 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              yAxisId="left" 
              stroke="var(--ash)" 
              tick={{ fill: 'var(--ash)', fontSize: 11 }}
              label={{ value: 'Tiger 5 Fails', angle: -90, position: 'insideLeft', fill: 'var(--ash)', fontSize: 11 }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="var(--ash)" 
              tick={{ fill: 'var(--ash)', fontSize: 11 }}
              domain={[(dataMin: number) => dataMin - 5, (dataMax: number) => dataMax + 5]}
              label={{ value: 'Score', angle: 90, position: 'insideRight', fill: 'var(--ash)', fontSize: 11 }}
            />
            <Tooltip 
              contentStyle={{ background: 'var(--court)', border: '1px solid var(--scarlet)', borderRadius: '4px', padding: '12px' }}
              labelStyle={{ color: 'var(--chalk)', fontWeight: 600, marginBottom: '8px' }}
              itemStyle={{ color: 'var(--cement)', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar yAxisId="left" dataKey="threePutts" name="3 Putts" stackId="a" fill={COLORS.threePutts} />
            <Bar yAxisId="left" dataKey="bogeyOnPar5" name="Bogey on Par 5" stackId="a" fill={COLORS.bogeyOnPar5} />
            <Bar yAxisId="left" dataKey="doubleBogey" name="Double Bogey" stackId="a" fill={COLORS.doubleBogey} />
            <Bar yAxisId="left" dataKey="bogeyApproach" name="Bogey: Approach <125" stackId="a" fill={COLORS.bogeyApproach} />
            <Bar yAxisId="left" dataKey="missedGreen" name="Missed Green" stackId="a" fill={COLORS.missedGreen} />
            <Line yAxisId="right" type="monotone" dataKey="totalScore" name="Score" stroke="var(--scarlet)" strokeWidth={3} dot={{ fill: 'var(--scarlet)', r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Potential Score Section - Shows what scores could be if Tiger 5 fails reduced by 50%
 */
function PotentialScoreSection({ 
  trendData, 
  tiger5Fails, 
  totalRounds 
}: { 
  trendData: Tiger5TrendDataPoint[]; 
  tiger5Fails: Tiger5Fail; 
  totalRounds: number;
}) {
  if (trendData.length === 0 || tiger5Fails.totalFails === 0) {
    return null;
  }

  // Calculate average strokes lost per Tiger 5 fail
  const avgStrokesLostPerFail = tiger5Fails.totalFails > 0 
    ? Math.abs(tiger5Fails.sgOnFailHoles) / tiger5Fails.totalFails 
    : 0;

  // Calculate potential score for each round
  const potentialData = trendData.map(d => {
    const totalFails = d.threePutts + d.bogeyOnPar5 + d.doubleBogey + d.bogeyApproach + d.missedGreen;
    // If we reduce fails by 50%, we save half the strokes lost per fail
    const strokesSaved = totalFails * 0.5 * avgStrokesLostPerFail;
    const potentialScore = d.totalScore - strokesSaved;
    
    return {
      ...d,
      label: `${d.date.substring(5)} - ${d.course}`,
      totalFails,
      strokesSaved,
      potentialScore: Math.round(potentialScore * 10) / 10,
    };
  });

  // Calculate totals
  const avgActualScore = potentialData.reduce((sum, d) => sum + d.totalScore, 0) / potentialData.length;
  const avgPotentialScore = potentialData.reduce((sum, d) => sum + d.potentialScore, 0) / potentialData.length;
  const totalStrokesSaved = potentialData.reduce((sum, d) => sum + d.strokesSaved, 0);

  return (
    <div style={{ marginTop: '24px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>What If: Tiger 5 Fails Reduced by 50%?</h4>
      
      {/* Chart */}
      <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={potentialData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ash)" opacity={0.3} />
            <XAxis 
              dataKey="label" 
              stroke="var(--ash)" 
              tick={{ fill: 'var(--ash)', fontSize: 10 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="var(--ash)" 
              tick={{ fill: 'var(--ash)', fontSize: 11 }}
              domain={['dataMin - 5', 'dataMax + 5']}
              label={{ value: 'Score', angle: -90, position: 'insideLeft', fill: 'var(--ash)', fontSize: 11 }}
            />
            <Tooltip 
              contentStyle={{ background: 'var(--court)', border: '1px solid var(--scarlet)', borderRadius: '4px', padding: '12px' }}
              labelStyle={{ color: 'var(--chalk)', fontWeight: 600, marginBottom: '8px' }}
              itemStyle={{ color: 'var(--cement)', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar dataKey="totalScore" name="Actual Score" fill="var(--pitch)" />
            <Bar dataKey="potentialScore" name="Potential Score" fill="var(--chalk)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
        <div className="card-stat" style={{ borderLeft: '3px solid var(--pitch)' }}>
          <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px' }}>Average Score</div>
          <div className="value-stat" style={{ color: 'var(--pitch)' }}>{avgActualScore.toFixed(1)}</div>
          <div className="label" style={{ marginTop: '8px', color: 'var(--ash)', fontSize: '11px' }}>
            Actual average across {totalRounds} rounds
          </div>
        </div>
        
        <div className="card-stat" style={{ borderLeft: '3px solid var(--chalk)' }}>
          <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px' }}>Potential Average</div>
          <div className="value-stat" style={{ color: 'var(--chalk)' }}>{avgPotentialScore.toFixed(1)}</div>
          <div className="label" style={{ marginTop: '8px', color: 'var(--ash)', fontSize: '11px' }}>
            If Tiger 5 fails reduced by 50%
          </div>
        </div>
        
        <div className="card-stat" style={{ borderLeft: '3px solid var(--chalk)' }}>
          <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px' }}>Total Strokes Saved</div>
          <div className="value-stat" style={{ color: 'var(--chalk)' }}>{totalStrokesSaved.toFixed(1)}</div>
          <div className="label" style={{ marginTop: '8px', color: 'var(--ash)', fontSize: '11px' }}>
            Across all rounds
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Strokes Gained View - Hero card + stat cards for each shot type
 * SG Driving, SG Approach, SG Putting, SG Short Game, SG Recovery + Other
 */
function StrokesGainedView({ metrics, filteredShots }: { metrics: Tiger5Metrics; filteredShots: ProcessedShot[] }) {
  const { totalStrokesGained, byCategory, sgSeparators } = metrics;
  const [sgDisplayMode, setSgDisplayMode] = useState<'total' | 'average'>('total');

  // Calculate total holes played (unique round-hole combinations)
  const uniqueHoles = new Set(filteredShots.map(s => `${s['Round ID']}-${s.Hole}`));
  const totalHoles = uniqueHoles.size;
  const sgPerHole = totalHoles > 0 ? totalStrokesGained / totalHoles : 0;

  // Build SG per hole by shot type data
  const shotTypes = ['Driving', 'Approach', 'Short Game', 'Putting', 'Other'] as const;
  type TableShotType = typeof shotTypes[number];

  // Initialize data structure: shotType -> hole -> { totalSG, shotCount, avgSG }
  const sgByHoleAndType = new Map<TableShotType, Map<number, { totalSG: number; shotCount: number; avgSG: number }>>();

  shotTypes.forEach(st => {
    sgByHoleAndType.set(st, new Map());
  });

  // Process each shot
  filteredShots.forEach(shot => {
    // Map shotType to our table categories
    let tableShotType: TableShotType;
    switch (shot.shotType) {
      case 'Drive':
        tableShotType = 'Driving';
        break;
      case 'Approach':
        tableShotType = 'Approach';
        break;
      case 'Short Game':
        tableShotType = 'Short Game';
        break;
      case 'Putt':
        tableShotType = 'Putting';
        break;
      case 'Recovery':
      default:
        tableShotType = 'Other';
        break;
    }

    const holeMap = sgByHoleAndType.get(tableShotType)!;
    const holeData = holeMap.get(shot.Hole) || { totalSG: 0, shotCount: 0, avgSG: 0 };
    holeData.totalSG += shot.calculatedStrokesGained;
    holeData.shotCount += 1;
    holeData.avgSG = holeData.shotCount > 0 ? holeData.totalSG / holeData.shotCount : 0;
    holeMap.set(shot.Hole, holeData);
  });

  // Calculate totals for each shot type
  const totalsByShotType = new Map<TableShotType, { totalSG: number; shotCount: number; avgSG: number }>();
  shotTypes.forEach(st => {
    const holeMap = sgByHoleAndType.get(st)!;
    let totalSG = 0;
    let shotCount = 0;
    holeMap.forEach(holeData => {
      totalSG += holeData.totalSG;
      shotCount += holeData.shotCount;
    });
    totalsByShotType.set(st, {
      totalSG,
      shotCount,
      avgSG: shotCount > 0 ? totalSG / shotCount : 0
    });
  });

  // Calculate totals for each hole (across all shot types)
  const totalsByHole = new Map<number, { totalSG: number; shotCount: number; avgSG: number }>();
  for (let hole = 1; hole <= 18; hole++) {
    let totalSG = 0;
    let shotCount = 0;
    shotTypes.forEach(st => {
      const holeMap = sgByHoleAndType.get(st)!;
      const holeData = holeMap.get(hole);
      if (holeData) {
        totalSG += holeData.totalSG;
        shotCount += holeData.shotCount;
      }
    });
    totalsByHole.set(hole, {
      totalSG,
      shotCount,
      avgSG: shotCount > 0 ? totalSG / shotCount : 0
    });
  }

  // Build category data for stat cards
  // Map existing categories: Drive, Approach, Short Game, Putt
  // For Recovery + Other: combine Recovery shots with any edge cases
  const categoryData = byCategory.map(cat => ({
    type: cat.type,
    totalShots: cat.totalShots,
    strokesGained: cat.strokesGained,
    avgStrokesGained: cat.avgStrokesGained,
  }));

  // Find Recovery shots for "Recovery + Other"
  const recoveryShots = filteredShots.filter(s => s.shotType === 'Recovery');
  const recoverySG = recoveryShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);

  // Build stat cards data
  const statCards = [
    {
      id: 'driving',
      label: 'Driving',
      category: categoryData.find(c => c.type === 'Drive'),
      accentColor: '',
    },
    {
      id: 'approach',
      label: 'Approach',
      category: categoryData.find(c => c.type === 'Approach'),
      accentColor: '',
    },
    {
      id: 'putting',
      label: 'Putting',
      category: categoryData.find(c => c.type === 'Putt'),
      accentColor: '',
    },
    {
      id: 'shortgame',
      label: 'Short Game',
      category: categoryData.find(c => c.type === 'Short Game'),
      accentColor: '',
    },
    {
      id: 'recovery',
      label: 'Recovery + Other',
      category: {
        type: 'Recovery + Other',
        totalShots: recoveryShots.length,
        strokesGained: recoverySG,
        avgStrokesGained: recoveryShots.length > 0 ? recoverySG / recoveryShots.length : 0,
      },
      accentColor: '',
    },
  ];

  // Find highest and lowest SG values for accent colors
  const sgValues = statCards.map(card => card.category?.avgStrokesGained ?? 0);
  const highestSG = Math.max(...sgValues);
  const lowestSG = Math.min(...sgValues);

  // Apply accent colors (green for highest, red for lowest)
  statCards.forEach(card => {
    const sg = card.category?.avgStrokesGained ?? 0;
    if (sg === highestSG && highestSG !== lowestSG) {
      card.accentColor = 'var(--under)'; // Green
    } else if (sg === lowestSG && highestSG !== lowestSG) {
      card.accentColor = 'var(--scarlet)'; // Red
    }
  });

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Strokes Gained</h4>

      {/* Hero Card - Total SG */}
      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '16px', maxWidth: '400px' }}>
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--scarlet)' }}>Total SG</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(totalStrokesGained) }}>
            {formatStrokesGained(totalStrokesGained)}
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>SG / Hole</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(sgPerHole) }}>
                {formatStrokesGained(sgPerHole)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Total Holes</div>
              <div className="value-stat">{totalHoles}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards - SG by Shot Type */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginTop: '24px' }}>
        {statCards.map((card) => {
          const cat = card.category;
          if (!cat || cat.totalShots === 0) return null;
          
          return (
            <div 
              key={card.id} 
              className="card-stat"
              style={{ 
                borderLeft: card.accentColor ? `3px solid ${card.accentColor}` : '3px solid var(--pitch)',
                background: card.accentColor ? 'var(--shadow)' : 'var(--shadow)',
              }}
            >
              <div className="label" style={{ color: 'var(--ash)', marginBottom: '12px' }}>
                {card.label}
              </div>
              <div 
                className="value-stat" 
                style={{ color: getStrokeGainedColor(cat.strokesGained) }}
              >
                {formatStrokesGained(cat.strokesGained)}
              </div>
              <div className="flex justify-between" style={{ marginTop: '12px' }}>
                <div>
                  <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>SG / Shot</div>
                  <div 
                    className="value-stat" 
                    style={{ color: getStrokeGainedColor(cat.avgStrokesGained), fontSize: '12px' }}
                  >
                    {formatStrokesGained(cat.avgStrokesGained)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Shots</div>
                  <div className="value-stat" style={{ fontSize: '12px' }}>{cat.totalShots}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend for accents */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '24px', fontSize: '11px', color: 'var(--ash)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--under)', borderRadius: '2px' }}></div>
          <span>Highest SG</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--scarlet)', borderRadius: '2px' }}></div>
          <span>Lowest SG</span>
        </div>
      </div>

      {/* SG Separators Section - Distance-based SG breakdown */}
      <div style={{ marginTop: '32px' }}>
        <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Strokes Gained Separators</h4>
        <p style={{ fontSize: '12px', color: 'var(--ash)', marginBottom: '16px' }}>
          SG breakdown by distance categories
        </p>
        
        <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {sgSeparators.map((separator) => {
            return (
              <div 
                key={separator.label} 
                className="card-stat"
                style={{ borderLeft: '3px solid var(--pitch)' }}
              >
                <div className="label" style={{ color: 'var(--ash)', marginBottom: '4px', fontSize: '12px' }}>
                  {separator.label}
                </div>
                <div className="label" style={{ color: 'var(--ash)', marginBottom: '12px', fontSize: '10px' }}>
                  {separator.description}
                </div>
                <div 
                  className="value-stat" 
                  style={{ color: getStrokeGainedColor(separator.strokesGained) }}
                >
                  {formatStrokesGained(separator.strokesGained)}
                </div>
                <div className="flex justify-between" style={{ marginTop: '12px' }}>
                  <div>
                    <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>SG / Shot</div>
                    <div 
                      className="value-stat" 
                      style={{ color: getStrokeGainedColor(separator.avgStrokesGained), fontSize: '12px' }}
                    >
                      {formatStrokesGained(separator.avgStrokesGained)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Shots</div>
                    <div className="value-stat" style={{ fontSize: '12px' }}>{separator.totalShots}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SG Per Hole By Shot Type Table */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--ash)' }}>SG by Hole & Shot Type</h4>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--ash)', fontSize: '12px' }}>
              <input
                type="radio"
                name="sgDisplayMode"
                checked={sgDisplayMode === 'total'}
                onChange={() => setSgDisplayMode('total')}
                style={{ accentColor: 'var(--scarlet)' }}
              />
              Total SG
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--ash)', fontSize: '12px' }}>
              <input
                type="radio"
                name="sgDisplayMode"
                checked={sgDisplayMode === 'average'}
                onChange={() => setSgDisplayMode('average')}
                style={{ accentColor: 'var(--scarlet)' }}
              />
              Avg SG / Shot
            </label>
          </div>
        </div>

        <div style={{ background: 'var(--charcoal)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--ash)', fontWeight: 600, background: 'var(--obsidian)', position: 'sticky', left: 0, zIndex: 1 }}>
                    Shot Type
                  </th>
                  {[...Array(18)].map((_, i) => (
                    <th key={i + 1} style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--ash)', fontWeight: 600, minWidth: '40px' }}>
                      {i + 1}
                    </th>
                  ))}
                  <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--ash)', fontWeight: 600, background: 'var(--obsidian)', minWidth: '50px' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {shotTypes.map((shotType) => {
                  const holeMap = sgByHoleAndType.get(shotType)!;
                  const totals = totalsByShotType.get(shotType)!;
                  
                  return (
                    <tr key={shotType} style={{ borderBottom: '1px solid var(--pitch)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)', position: 'sticky', left: 0, zIndex: 1 }}>
                        {shotType}
                      </td>
                      {[...Array(18)].map((_, i) => {
                        const holeNum = i + 1;
                        const holeData = holeMap.get(holeNum);
                        const value = holeData ? (sgDisplayMode === 'total' ? holeData.totalSG : holeData.avgSG) : 0;
                        const hasData = holeData && holeData.shotCount > 0;
                        
                        return (
                          <td
                            key={holeNum}
                            style={{
                              padding: '8px 4px',
                              textAlign: 'center',
                              color: hasData ? getStrokeGainedColor(value) : 'var(--ash)',
                              opacity: hasData ? 1 : 0.3,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '10px'
                            }}
                          >
                            {hasData ? formatStrokesGained(value) : '-'}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'center',
                          color: getStrokeGainedColor(sgDisplayMode === 'total' ? totals.totalSG : totals.avgSG),
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          fontWeight: 600,
                          background: 'var(--obsidian)'
                        }}
                      >
                        {formatStrokesGained(sgDisplayMode === 'total' ? totals.totalSG : totals.avgSG)}
                      </td>
                    </tr>
                  );
                })}

                {/* Total Row - sums across all shot types for each hole */}
                <tr style={{ borderTop: '2px solid var(--pitch)', background: 'var(--obsidian)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--chalk)', fontWeight: 700, position: 'sticky', left: 0, zIndex: 1 }}>
                    Total
                  </td>
                  {[...Array(18)].map((_, i) => {
                    const holeNum = i + 1;
                    const holeTotal = totalsByHole.get(holeNum)!;
                    const value = sgDisplayMode === 'total' ? holeTotal.totalSG : holeTotal.avgSG;
                    const hasData = holeTotal.shotCount > 0;
                    
                    return (
                      <td
                        key={holeNum}
                        style={{
                          padding: '10px 4px',
                          textAlign: 'center',
                          color: hasData ? getStrokeGainedColor(value) : 'var(--ash)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          fontWeight: 600
                        }}
                      >
                        {hasData ? formatStrokesGained(value) : '-'}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'center',
                      color: getStrokeGainedColor(sgDisplayMode === 'total' ? totalStrokesGained : metrics.avgStrokesGained),
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: 700
                    }}
                  >
                    {formatStrokesGained(sgDisplayMode === 'total' ? totalStrokesGained : metrics.avgStrokesGained)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Strokes Gained Trend Chart */}
      <StrokesGainedTrendChart filteredShots={filteredShots} />
    </div>
  )
}

/**
 * Root Cause Section - Shows the root cause of Tiger 5 fails
 * For each Tiger 5 fail hole, identifies the shot with lowest SG as the root cause
 */
function RootCauseSection({ rootCause, totalFailHoles }: { rootCause: RootCauseMetrics; totalFailHoles: number }) {
  // Root cause card data - ordered as: penalty, driving, approach, lag putts, makeable putts, short game, recovery
  const rootCauseCards = [
    { 
      label: 'Penalties', 
      value: rootCause.penalties,
      sgValue: rootCause.penaltiesSG,
      color: '#F03DAA'  // Magenta
    },
    { 
      label: 'Driving', 
      value: rootCause.driving,
      sgValue: rootCause.drivingSG,
      color: '#A855F7'  // Court Purple
    },
    { 
      label: 'Approach', 
      value: rootCause.approach,
      sgValue: rootCause.approachSG,
      color: '#D4F000'  // Volt
    },
    { 
      label: 'Lag Putts (13+)', 
      value: rootCause.lagPutts,
      sgValue: rootCause.lagPuttsSG,
      color: '#06C8E0'  // Aqua
    },
    { 
      label: 'Makeable Putts (0-12)', 
      value: rootCause.makeablePutts,
      sgValue: rootCause.makeablePuttsSG,
      color: '#3D8EF0'  // Royal Blue
    },
    { 
      label: 'Short Game', 
      value: rootCause.shortGame,
      sgValue: rootCause.shortGameSG,
      color: '#FF8C00'  // Orange
    },
    { 
      label: 'Recovery', 
      value: rootCause.recovery,
      sgValue: rootCause.recoverySG,
      color: '#10B981'  // Emerald
    },
  ];

  return (
    <div style={{ marginTop: '24px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Tiger 5: Root Cause</h4>
      <p style={{ fontSize: '12px', color: 'var(--ash)', marginBottom: '16px' }}>
        Shot with lowest SG on each Tiger 5 fail hole ({totalFailHoles} total fails)
      </p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px' }}>
        {rootCauseCards.map((card) => {
          const percentage = totalFailHoles > 0 ? (card.value / totalFailHoles) * 100 : 0;
          return (
            <div 
              key={card.label} 
              className="card-stat" 
              style={{ borderLeft: `3px solid ${card.color}` }}
            >
              <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>
                {card.label}
              </div>
              <div className="value-stat">{card.value}</div>
              <div style={{ marginTop: '8px' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '9px' }}>% of Fails</div>
                <div className="value-stat" style={{ fontSize: '11px' }}>{percentage.toFixed(1)}%</div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '9px' }}>Total SG</div>
                <div className="value-stat" style={{ fontSize: '11px', color: getStrokeGainedColor(card.sgValue) }}>
                  {formatStrokesGained(card.sgValue)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Driving View - Hero cards for driving metrics
 * - Penalty Rate (OB counts double)
 * - Driving Distance (75th percentile)
 * - Total Strokes Gained - Driving
 * - Fairway Hit Percentage
 * - Driving Analysis section with charts
 */
function DrivingView({ metrics, analysis, filteredShots }: { metrics: DrivingMetrics; analysis: DrivingAnalysis; filteredShots: ProcessedShot[] }) {
  const [driveFilter, setDriveFilter] = useState<'all' | 'driver' | 'non-driver'>('all');

  // Filter shots based on drive type
  // Driver = Did not Hit Driver is "No" or blank/empty
  // Non Driver = Did not Hit Driver is "Yes"
  const filteredDrives = useMemo(() => {
    return filteredShots.filter(shot => {
      if (driveFilter === 'all') return shot.shotType === 'Drive';
      if (driveFilter === 'driver') {
        return shot.shotType === 'Drive' && 
          (shot['Did not Hit Driver'] === 'No' || shot['Did not Hit Driver'] === '' || shot['Did not Hit Driver'] === undefined);
      }
      if (driveFilter === 'non-driver') return shot.shotType === 'Drive' && shot['Did not Hit Driver'] === 'Yes';
      return false;
    });
  }, [filteredShots, driveFilter]);

  // Recalculate metrics based on filtered drives
  const filteredMetrics = useMemo(() => {
    const drives = filteredDrives;
    const totalDrives = drives.length;
    
    if (totalDrives === 0) {
      return {
        ...metrics,
        totalDrives: 0,
        fairwayPct: 0,
        drivingSG: 0,
        avgDrivingSG: 0,
        fairwayPctDriver: 0,
        fairwayPctNonDriver: 0,
        drivingDistance75th: 0,
        penaltyRate: 0,
        positiveSGPct: 0,
        totalPenalties: 0,
        obPenalties: 0,
        otherPenalties: 0,
        sgPenalties: 0,
      };
    }

    // Calculate fairways
    const fairwaysHit = drives.filter(d => d['Ending Lie'] === 'Fairway').length;
    const fairwayPct = (fairwaysHit / totalDrives) * 100;

    // Calculate SG
    const drivingSG = drives.reduce((sum, d) => sum + d.calculatedStrokesGained, 0);
    const avgDrivingSG = drivingSG / totalDrives;

    // Fairway % by driver type
    const driverDrives = drives.filter(d => d['Did not Hit Driver'] === 'No' || d['Did not Hit Driver'] === '' || d['Did not Hit Driver'] === undefined);
    const nonDriverDrives = drives.filter(d => d['Did not Hit Driver'] === 'Yes');
    
    const driverFairways = driverDrives.filter(d => d['Ending Lie'] === 'Fairway').length;
    const nonDriverFairways = nonDriverDrives.filter(d => d['Ending Lie'] === 'Fairway').length;

    // Calculate driving distance (75th percentile)
    const driveDistances = drives.map(d => Math.abs(d['Starting Distance'] - d['Ending Distance'])).sort((a, b) => a - b);
    const distance75thIndex = Math.floor(driveDistances.length * 0.75);
    const drivingDistance75th = driveDistances[distance75thIndex] || 0;

    // Calculate penalty rate
    const obPenalties = drives.filter(d => d.Penalty === 'Yes' && (d['Ending Lie'] === 'Out of Bounds' || d['Ending Lie'] === 'OB')).length;
    const otherPenalties = drives.filter(d => d.Penalty === 'Yes' && d['Ending Lie'] !== 'Out of Bounds' && d['Ending Lie'] !== 'OB').length;
    const totalPenalties = obPenalties + otherPenalties;
    const penaltyRate = ((obPenalties * 2 + otherPenalties) / totalDrives) * 100;
    const sgPenalties = drives.filter(d => d.Penalty === 'Yes').reduce((sum, d) => sum + d.calculatedStrokesGained, 0);

    // Calculate positive SG percentage
    const positiveDrives = drives.filter(d => d.calculatedStrokesGained > 0).length;
    const positiveSGPct = (positiveDrives / totalDrives) * 100;

    return {
      ...metrics,
      totalDrives,
      fairwayPct,
      drivingSG,
      avgDrivingSG,
      fairwayPctDriver: driverDrives.length > 0 ? (driverFairways / driverDrives.length) * 100 : 0,
      fairwayPctNonDriver: nonDriverDrives.length > 0 ? (nonDriverFairways / nonDriverDrives.length) * 100 : 0,
      drivingDistance75th,
      penaltyRate,
      positiveSGPct,
      totalPenalties,
      obPenalties,
      otherPenalties,
      sgPenalties,
    };
  }, [filteredDrives, metrics]);

  const { 
    totalDrives, 
    fairwayPct, 
    drivingSG, 
    avgDrivingSG, 
    drivingDistance75th,
    obPenalties,
    otherPenalties,
    penaltyRate,
    sgPenalties,
    fairwayPctDriver,
    fairwayPctNonDriver,
    positiveSGPct,
  } = filteredMetrics;

  // Calculate Problem Drive metrics from filtered drives
  const problemMetrics = useMemo(() => {
    return calculateProblemDriveMetrics(filteredDrives);
  }, [filteredDrives]);

  // Filter analysis data based on drive type - always use actual ending lie (no grouping)
  const filteredAnalysis = useMemo(() => {
    // Recalculate ending locations using actual ending lie
    const endingLocationsMap = new Map<string, { count: number; strokesGained: number }>();
    
    filteredDrives.forEach(drive => {
      const location = drive['Ending Lie'] as string;
      const existing = endingLocationsMap.get(location) || { count: 0, strokesGained: 0 };
      existing.count += 1;
      existing.strokesGained += drive.calculatedStrokesGained;
      endingLocationsMap.set(location, existing);
    });
    
    const totalDrives = filteredDrives.length;
    const endingLocations = Array.from(endingLocationsMap.entries())
      .map(([location, data]) => ({
        location: location as 'Fairway' | 'Rough' | 'Recovery' | 'Sand' | 'Green' | 'Tee' | 'Out of Bounds' | 'Water' | 'Penalty Area' | 'Other',
        count: data.count,
        percentage: totalDrives > 0 ? (data.count / totalDrives) * 100 : 0,
        strokesGained: data.strokesGained,
        avgStrokesGained: data.count > 0 ? data.strokesGained / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count);
    
    return {
      ...analysis,
      endingLocations,
    };
  }, [analysis, filteredDrives]);

  return (
    <div className="content">
      {/* Section Heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ color: 'var(--ash)' }}>Driving Performance</h4>
        
        {/* Drive Type Filter Radio Buttons */}
        <div style={{ display: 'flex', gap: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: driveFilter === 'all' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="driveFilter"
              value="all"
              checked={driveFilter === 'all'}
              onChange={() => setDriveFilter('all')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            All Drives
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: driveFilter === 'driver' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="driveFilter"
              value="driver"
              checked={driveFilter === 'driver'}
              onChange={() => setDriveFilter('driver')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            Driver
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: driveFilter === 'non-driver' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="driveFilter"
              value="non-driver"
              checked={driveFilter === 'non-driver'}
              onChange={() => setDriveFilter('non-driver')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            Non Driver
          </label>
        </div>
      </div>
      
      {/* Hero Cards - 4 metrics */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        
        {/* Card 1: Penalty Rate */}
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--scarlet)' }}>Penalty Rate</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getPenaltyRateColor(penaltyRate) }}>
            {penaltyRate.toFixed(1)}%
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>SG Penalties</div>
            <div className="value-stat" style={{ color: getStrokeGainedColor(sgPenalties) }}>
              {formatStrokesGained(sgPenalties)}
            </div>
          </div>
        </div>

        {/* Card 2: Driving Distance (75th percentile) */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Distance (75th %)</div>
          </div>
          <div className="value-hero" style={{ color: 'var(--chalk)' }}>
            {drivingDistance75th.toFixed(0)} <span style={{ fontSize: '18px' }}>yds</span>
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>Total Drives</div>
            <div className="value-stat">{totalDrives}</div>
          </div>
        </div>

        {/* Card 3: Total SG - Driving */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>SG - Driving</div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(drivingSG) }}>
            {formatStrokesGained(drivingSG)}
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>SG / Drive</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgDrivingSG) }}>
                {formatStrokesGained(avgDrivingSG)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>+ Drives</div>
              <div className="value-stat">{positiveSGPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Card 4: Fairway Hit % */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>
              {driveFilter === 'all' ? 'Fairway %' : driveFilter === 'driver' ? 'Fairway % (Driver)' : 'Fairway % (Non Driver)'}
            </div>
          </div>
          <div className="value-hero" style={{ color: getFairwayPctColor(fairwayPct) }}>
            {fairwayPct.toFixed(1)}%
          </div>
          {driveFilter === 'all' && (
            <div className="flex justify-between" style={{ marginTop: '16px' }}>
              <div>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Driver</div>
                <div className="value-stat" style={{ color: getFairwayPctColor(fairwayPctDriver) }}>
                  {fairwayPctDriver.toFixed(1)}%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Non-Driver</div>
                <div className="value-stat" style={{ color: getFairwayPctColor(fairwayPctNonDriver) }}>
                  {fairwayPctNonDriver.toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Driving Analysis Section */}
      <DrivingAnalysisSection analysis={filteredAnalysis} totalDrives={totalDrives} />

      {/* Problem Drive Section */}
      <ProblemDriveSection metrics={problemMetrics} />

      {/* All Drives Table - Collapsible */}
      <DrivesTableSection shots={filteredDrives} />
    </div>
  );
}

/**
 * Driving Analysis Section - Donut and Bar charts for drive analysis
 */
function DrivingAnalysisSection({ analysis, totalDrives }: { analysis: DrivingAnalysis; totalDrives: number }) {
  const { endingLocations } = analysis;

  // Map location types to chart colors - each location has a distinct color
  const LOCATION_COLORS: Record<string, string> = {
    'Fairway': '#3D8EF0',      // Royal Blue
    'Rough': '#A855F7',         // Court Purple
    'Recovery': '#06C8E0',      // Aqua
    'Sand': '#D4F000',          // Volt
    'Green': '#F03DAA',         // Magenta
    'Tee': '#FF8C00',           // Orange
    'Out of Bounds': '#EF4444', // Red
    'Water': '#3D8EF0',         // Royal Blue (same as Fairway for water)
    'Penalty Area': '#A855F7',  // Court Purple (same as Rough)
    'Other': '#6B7280',         // Gray
  };

  // Format data for donut chart
  const donutData = endingLocations.map(loc => ({
    name: loc.location,
    value: loc.count,
    percentage: loc.percentage.toFixed(1),
    strokesGained: loc.strokesGained,
    avgStrokesGained: loc.avgStrokesGained,
  }));

  // Custom tooltip for donut chart
  const DonutTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof donutData[0] }> }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'var(--court)',
        border: '1px solid var(--scarlet)',
        borderRadius: '4px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ color: 'var(--chalk)', fontWeight: 600, marginBottom: '8px' }}>
          {data.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Count: <span style={{ color: 'var(--chalk)' }}>{data.value}</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Percentage: <span style={{ color: 'var(--chalk)' }}>{data.percentage}%</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)' }}>
          Avg SG: <span style={{ color: getStrokeGainedColor(data.avgStrokesGained) }}>
            {formatStrokesGained(data.avgStrokesGained)}
          </span>
        </div>
      </div>
    );
  };

  // Custom tooltip for SG by location horizontal bar chart
  const LocationSGTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { strokesGained: number; avgStrokesGained: number; count: number; location: string } }> }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'var(--court)',
        border: '1px solid var(--scarlet)',
        borderRadius: '4px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ color: 'var(--chalk)', fontWeight: 600, marginBottom: '8px' }}>
          {data.location}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Total SG: <span style={{ color: getStrokeGainedColor(data.strokesGained) }}>
            {formatStrokesGained(data.strokesGained)}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Avg SG: <span style={{ color: getStrokeGainedColor(data.avgStrokesGained) }}>
            {formatStrokesGained(data.avgStrokesGained)}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)' }}>
          Count: <span style={{ color: 'var(--chalk)' }}>{data.count}</span>
        </div>
      </div>
    );
  };

  if (endingLocations.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '32px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Driving Analysis</h4>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Donut Chart - Drive Ending Locations */}
        {endingLocations.length > 0 && (
          <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
            <h5 style={{ marginBottom: '12px', color: 'var(--chalk)', fontSize: '14px', fontWeight: 600 }}>
              Drive Ending Locations
            </h5>
            <p style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '16px' }}>
              Percentage breakdown of where drives end up
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ percentage }) => `${percentage}%`}
                  labelLine={false}
                >
                  {donutData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={LOCATION_COLORS[entry.name] || '#6B7280'}
                      stroke="var(--charcoal)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                {/* Center text showing total drives - separate from data to avoid tooltip issues */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--chalk)"
                  style={{ fontSize: '24px', fontWeight: 'bold' }}
                >
                  {totalDrives}
                </text>
                <Tooltip content={<DonutTooltip />} />
                <Legend 
                  layout="vertical" 
                  align="right" 
                  verticalAlign="middle"
                  formatter={(value) => <span style={{ color: 'var(--ash)', fontSize: '11px' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Horizontal Bar Chart - SG by Ending Location */}
        {endingLocations.length > 0 && (
          <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
            <h5 style={{ marginBottom: '12px', color: 'var(--chalk)', fontSize: '14px', fontWeight: 600 }}>
              SG by Ending Location
            </h5>
            <p style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '16px' }}>
              Total Strokes Gained by where drives end up
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart 
                data={endingLocations} 
                layout="vertical"
                margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ash)" opacity={0.3} horizontal={false} />
                <XAxis 
                  type="number"
                  stroke="var(--ash)" 
                  tick={{ fill: 'var(--ash)', fontSize: 11 }}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <YAxis 
                  type="category"
                  dataKey="location" 
                  stroke="var(--ash)" 
                  tick={{ fill: 'var(--ash)', fontSize: 11 }}
                  width={80}
                />
                <Tooltip content={<LocationSGTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={() => <span style={{ color: 'var(--ash)', fontSize: '11px' }}>Total SG</span>}
                />
                <Bar 
                  dataKey="strokesGained" 
                  name="Total SG"
                  radius={[0, 4, 4, 0]}
                >
                  {endingLocations.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={LOCATION_COLORS[entry.location] || chartColors[0]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Drives Table Section - Collapsible table showing all drives
 * Columns: Course, Hole, Starting Distance, Ending Distance, Ending Lie, Penalty, SG
 */
function DrivesTableSection({ shots }: { shots: ProcessedShot[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter for drives only
  const drives = shots.filter(shot => shot.shotType === 'Drive');

  // Group drives by round (date + course)
  const drivesByRound = drives.reduce((acc, drive) => {
    const key = `${drive.Date}|${drive.Course}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(drive);
    return acc;
  }, {} as Record<string, ProcessedShot[]>);

  // Sort rounds by date (most recent first)
  const sortedRounds = Object.entries(drivesByRound).sort((a, b) => {
    const dateA = a[0].split('|')[0];
    const dateB = b[0].split('|')[0];
    return dateB.localeCompare(dateA);
  });

  if (drives.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '32px' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 16px',
          background: 'var(--charcoal)',
          border: '1px solid var(--ash)',
          borderRadius: '4px',
          color: 'var(--chalk)',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        <span style={{ fontWeight: 600 }}>All Drives</span>
        <span style={{ fontSize: '12px', color: 'var(--ash)' }}>
          {drives.length} drives • {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {isExpanded && (
        <div style={{ marginTop: '16px' }}>
          {sortedRounds.map(([roundKey, roundDrives]) => {
            const [dateStr, courseStr] = roundKey.split('|');

            return (
              <div key={roundKey} style={{ marginBottom: '16px', padding: '12px', background: 'var(--charcoal)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', fontSize: '12px', color: 'var(--chalk)' }}>
                  <span><strong>Date:</strong> {dateStr}</span>
                  <span><strong>Course:</strong> {courseStr}</span>
                  <span><strong>Drives:</strong> {roundDrives.length}</span>
                </div>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '8%' }}>Hole</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '10%' }}>Non Driver</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>Start Dist</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>End Dist</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '15%' }}>End Lie</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '10%' }}>Penalty</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>Driver Dist</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '12%' }}>SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundDrives
                      .sort((a, b) => a.Hole - b.Hole)
                      .map((drive, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                          <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{drive.Hole}</td>
                          <td style={{ padding: '6px', textAlign: 'center', color: drive['Did not Hit Driver'] === 'Yes' ? 'var(--bogey)' : 'var(--chalk)' }}>
                            {drive['Did not Hit Driver'] === 'Yes' ? 'Yes' : ''}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                            {drive['Starting Distance']}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                            {drive['Ending Distance']}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{drive['Ending Lie']}</td>
                          <td style={{ padding: '6px', textAlign: 'center', color: drive.Penalty === 'Yes' ? 'var(--scarlet)' : 'transparent' }}>
                            {drive.Penalty === 'Yes' ? 'Yes' : ''}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                            {drive['Starting Distance'] - drive['Ending Distance']}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', color: getShotSGColor(drive.calculatedStrokesGained), fontFamily: 'var(--font-mono)' }}>
                            {formatStrokesGained(drive.calculatedStrokesGained)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Problem Drive Section - Shows penalties and obstruction breakdown
 * - Penalties: Total, OB, Standard
 * - Obstruction: Sand + Recovery (drives ending in sand or recovery lie)
 */
function ProblemDriveSection({ metrics }: { metrics: ProblemDriveMetrics }) {
  // Don't render if no drives
  if (metrics.totalDrives === 0) {
    return null;
  }

  // Chart colors for the breakdown items
  const penaltyColors = ['#F03DAA', '#A855F7', '#3D8EF0']; // Magenta, Purple, Blue
  const obstructionColors = ['#06C8E0', '#D4F000']; // Aqua, Volt

  return (
    <div style={{ marginTop: '32px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Problem Drive Analysis</h4>
      <p style={{ fontSize: '12px', color: 'var(--ash)', marginBottom: '16px' }}>
        Penalties and obstruction breakdown ({metrics.totalDrives} total drives)
      </p>

      {/* Penalties Breakdown */}
      <div style={{ marginBottom: '24px' }}>
        <h5 style={{ marginBottom: '12px', color: 'var(--chalk)', fontSize: '14px', fontWeight: 600 }}>
          Penalties
        </h5>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {/* Total Penalties */}
          <div className="card-stat" style={{ borderLeft: `3px solid ${penaltyColors[0]}` }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>
              Total Penalties
            </div>
            <div className="value-stat">{metrics.totalPenalties}</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>% of Drives</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{metrics.penaltyPct.toFixed(1)}%</div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Total SG</div>
              <div className="value-stat" style={{ fontSize: '12px', color: getStrokeGainedColor(metrics.penaltySG) }}>
                {formatStrokesGained(metrics.penaltySG)}
              </div>
            </div>
          </div>

          {/* OB Penalties */}
          <div className="card-stat" style={{ borderLeft: `3px solid ${penaltyColors[1]}` }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>
              OB Penalties
            </div>
            <div className="value-stat">{metrics.obPenalties}</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>% of Drives</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{metrics.obPenaltyPct.toFixed(1)}%</div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Total SG</div>
              <div className="value-stat" style={{ fontSize: '12px', color: getStrokeGainedColor(metrics.obPenaltySG) }}>
                {formatStrokesGained(metrics.obPenaltySG)}
              </div>
            </div>
          </div>

          {/* Standard Penalties */}
          <div className="card-stat" style={{ borderLeft: `3px solid ${penaltyColors[2]}` }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>
              Standard Penalties
            </div>
            <div className="value-stat">{metrics.standardPenalties}</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>% of Drives</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{metrics.standardPenaltyPct.toFixed(1)}%</div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Total SG</div>
              <div className="value-stat" style={{ fontSize: '12px', color: getStrokeGainedColor(metrics.standardPenaltySG) }}>
                {formatStrokesGained(metrics.standardPenaltySG)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Obstruction Breakdown */}
      <div>
        <h5 style={{ marginBottom: '12px', color: 'var(--chalk)', fontSize: '14px', fontWeight: 600 }}>
          Obstruction Rate
        </h5>
        <p style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '12px' }}>
          Drives ending in Sand or Recovery lie
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {/* Total Obstruction */}
          <div className="card-stat" style={{ borderLeft: `3px solid ${obstructionColors[0]}` }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>
              Total Obstruction
            </div>
            <div className="value-stat">{metrics.obstructionCount}</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>% of Drives</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{metrics.obstructionPct.toFixed(1)}%</div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Total SG</div>
              <div className="value-stat" style={{ fontSize: '12px', color: getStrokeGainedColor(metrics.obstructionSG) }}>
                {formatStrokesGained(metrics.obstructionSG)}
              </div>
            </div>
          </div>

          {/* Sand */}
          <div className="card-stat" style={{ borderLeft: `3px solid ${obstructionColors[1]}` }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>
              Sand
            </div>
            <div className="value-stat">{metrics.sandCount}</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>% of Drives</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{metrics.sandPct.toFixed(1)}%</div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Total SG</div>
              <div className="value-stat" style={{ fontSize: '12px', color: getStrokeGainedColor(metrics.sandSG) }}>
                {formatStrokesGained(metrics.sandSG)}
              </div>
            </div>
          </div>

          {/* Recovery */}
          <div className="card-stat" style={{ borderLeft: `3px solid ${chartColors[4]}` }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>
              Recovery
            </div>
            <div className="value-stat">{metrics.recoveryCount}</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>% of Drives</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{metrics.recoveryPct.toFixed(1)}%</div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Total SG</div>
              <div className="value-stat" style={{ fontSize: '12px', color: getStrokeGainedColor(metrics.recoverySG) }}>
                {formatStrokesGained(metrics.recoverySG)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Approach View - Hero cards for approach metrics
 * - Total SG Approach
 * - Green Hit % = % of Approach shots with ending lie = Green
 * - Proximity < 150 = average proximity of approach shots <= 150 yards
 */
function ApproachView({ metrics, approachByDistance, filteredShots }: { metrics: ApproachMetrics; approachByDistance: ApproachDistanceBucket[]; filteredShots: ProcessedShot[] }) {
  const { 
    totalApproaches,
    approachSG,
    avgApproachSG,
    positiveSGPct,
    positiveSGCount,
    greenHitPct,
    greenHits,
    greenHitPctFairway,
    greenHitsFairway,
    totalApproachesFairway,
    greenHitPctRough,
    greenHitsRough,
    totalApproachesRough,
    proximityUnder150,
    proximityUnder150Count,
    proximityUnder150OnGreen,
    proximityUnder150OnGreenCount,
    within20FeetPct,
    within20FeetCount,
    approachesOver150,
    approachesUnder150,
    greenHitPctOver150,
    greenHitPctUnder150,
  } = metrics;

  // Get color for green hit percentage
  const getGreenHitPctColor = (pct: number): string => {
    if (pct >= 50) return 'var(--under)';      // Green
    if (pct >= 35) return 'var(--bogey)';        // Yellow
    return 'var(--double)';                       // Red
  };

  // Get color for proximity (lower is better)
  const getProximityColor = (proximity: number): string => {
    if (proximity <= 30) return 'var(--under)';  // Green
    if (proximity <= 45) return 'var(--bogey)';  // Yellow
    return 'var(--double)';                       // Red
  };

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Approach Performance</h4>

      {/* Hero Cards - 3 metrics */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        
        {/* Card 1: Total SG Approach */}
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--scarlet)' }}>Total SG Approach</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(approachSG) }}>
            {formatStrokesGained(approachSG)}
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>SG / Shot</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgApproachSG) }}>
                {formatStrokesGained(avgApproachSG)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>+ Approach</div>
              <div className="value-stat">{positiveSGPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Card 2: Green Hit % */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Green Hit %</div>
          </div>
          <div className="value-hero" style={{ color: getGreenHitPctColor(greenHitPct) }}>
            {greenHitPct.toFixed(1)}%
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Fairway</div>
              <div className="value-stat" style={{ color: getGreenHitPctColor(greenHitPctFairway) }}>
                {greenHitPctFairway.toFixed(1)}%
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Rough</div>
              <div className="value-stat" style={{ color: getGreenHitPctColor(greenHitPctRough) }}>
                {greenHitPctRough.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Proximity < 150 */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Proximity &lt; 150yds</div>
          </div>
          <div className="value-hero" style={{ color: getProximityColor(proximityUnder150) }}>
            {proximityUnder150.toFixed(1)} <span style={{ fontSize: '18px' }}>ft</span>
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Prox. on Green</div>
              <div className="value-stat" style={{ color: getProximityColor(proximityUnder150OnGreen) }}>
                {proximityUnder150OnGreen.toFixed(1)} ft
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Within 20ft</div>
              <div className="value-stat" style={{ color: getGreenHitPctColor(within20FeetPct) }}>
                {within20FeetPct.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Approach by Distance Section */}
      {approachByDistance.length > 0 && (
        <>
          <h4 style={{ marginTop: '32px', marginBottom: '16px', color: 'var(--ash)' }}>Approach by Distance</h4>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {approachByDistance.map((bucket) => (
              <div key={bucket.label} className="card">
                <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
                  <div className="label" style={{ color: 'var(--scarlet)' }}>{bucket.label}</div>
                </div>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px', marginBottom: '12px' }}>
                  {bucket.description}
                </div>
                
                {/* Main Value: SG */}
                <div className="value-hero" style={{ color: getStrokeGainedColor(bucket.strokesGained), fontSize: '28px' }}>
                  {formatStrokesGained(bucket.strokesGained)}
                </div>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px', marginBottom: '16px' }}>
                  SG ({bucket.totalShots} shots)
                </div>
                
                <div className="flex justify-between">
                  <div>
                    <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Green %</div>
                    <div className="value-stat" style={{ color: getGreenHitPctColor(bucket.greenHitPct), fontSize: '14px' }}>
                      {bucket.greenHitPct.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Prox</div>
                    <div className="value-stat" style={{ color: getProximityColor(bucket.proximity), fontSize: '14px' }}>
                      {bucket.proximity.toFixed(1)} ft
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App
