import { useState } from 'react'
import './styles/globals.css'
import { useGolfData } from './hooks/useGolfData'
import { TABS, Tiger5Metrics } from './types/golf'
import { getStrokeGainedColor, formatStrokesGained } from './styles/tokens'

function App() {
  const [activeTab, setActiveTab] = useState('tiger5')
  const { processedShots, tiger5Metrics, isLoading, error, lastUpdated } = useGolfData()

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>Golf <em>Intelligence</em></h1>
          <p className="subtitle">Analytics Dashboard</p>
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

      {/* Main Content */}
      <main className="main">
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
        
        {!isLoading && !error && activeTab !== 'tiger5' && (
          <div className="content">
            <div className="card">
              <h3>{TABS.find(t => t.id === activeTab)?.label}</h3>
              <p>Coming soon... ({processedShots.length} shots loaded)</p>
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
function Tiger5View({ metrics, lastUpdated }: { metrics: Tiger5Metrics; lastUpdated: Date | null }) {
  return (
    <div className="content">
      {/* Hero Cards - Top Level Metrics */}
      <div className="grid-hero">
        <HeroCard 
          label="SG · Total"
          value={formatStrokesGained(metrics.totalStrokesGained)}
          subtext={`${metrics.totalShots} shots`}
          isFlagship
        />
        <HeroCard 
          label="SG · Average"
          value={formatStrokesGained(metrics.avgStrokesGained)}
          subtext="Per shot"
          color={getStrokeGainedColor(metrics.avgStrokesGained)}
        />
        <HeroCard 
          label="Rounds"
          value={metrics.totalRounds.toString()}
          subtext="Total rounds"
        />
      </div>

      {/* Stat Cards */}
      <div className="grid-stats">
        <StatCard 
          label="Fairways Hit"
          value={`${metrics.fairwayPct.toFixed(1)}%`}
        />
        <StatCard 
          label="GIR"
          value={`${metrics.girPct.toFixed(1)}%`}
        />
        <StatCard 
          label="Total Shots"
          value={metrics.totalShots.toString()}
        />
        <StatCard 
          label="Last Updated"
          value={lastUpdated ? lastUpdated.toLocaleDateString() : 'N/A'}
        />
      </div>

      {/* Category Breakdown */}
      <div style={{ marginTop: '24px' }}>
        <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Strokes Gained by Category</h4>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
          {metrics.byCategory.map(cat => (
            <CategoryCard key={cat.type} category={cat} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CategoryCard({ category }: { category: { type: string; totalShots: number; avgStrokesGained: number } }) {
  return (
    <div className="card-stat">
      <div className="label label-ash" style={{ marginBottom: '12px' }}>{category.type}</div>
      <div 
        className="value-stat" 
        style={{ color: getStrokeGainedColor(category.avgStrokesGained) }}
      >
        {formatStrokesGained(category.avgStrokesGained)}
      </div>
      <div className="label" style={{ marginTop: '8px', color: 'var(--ash)' }}>
        {category.totalShots} shots
      </div>
    </div>
  )
}

/**
 * Hero Card - Large KPI display
 */
function HeroCard({ 
  label, 
  value, 
  subtext, 
  isFlagship = false, 
  color 
}: { 
  label: string; 
  value: string; 
  subtext: string; 
  isFlagship?: boolean;
  color?: string;
}) {
  return (
    <div className={`card-hero ${isFlagship ? 'is-flagship' : ''}`}>
      <div className="flex justify-between items-center" style={{ marginBottom: '24px' }}>
        <div className="label" style={{ color: isFlagship ? 'var(--scarlet)' : 'var(--ash)' }}>
          {label}
        </div>
        {isFlagship && (
          <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
        )}
      </div>
      <div 
        className="value-hero" 
        style={{ color: color || (isFlagship ? 'var(--chalk)' : 'var(--chalk)') }}
      >
        {value}
      </div>
      <div className="label" style={{ marginTop: '16px', color: 'var(--ash)' }}>
        {subtext}
      </div>
    </div>
  )
}

/**
 * Stat Card - Smaller metric display
 */
function StatCard({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: string; 
  value: string; 
  highlight?: boolean;
}) {
  return (
    <div className={`card-stat ${highlight ? 'is-highlighted' : ''}`}>
      <div className="label" style={{ color: highlight ? 'var(--scarlet)' : 'var(--ash)', marginBottom: '12px' }}>
        {label}
      </div>
      <div className="value-stat">{value}</div>
    </div>
  )
}

export default App
