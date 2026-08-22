'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { loadRuns, persistRuns, syncRuns, type WinnersCircleRun } from '.';
import './WinnersCircle.css';
import { fmtDateShort } from '@/lib/playerpath/format';

const STANDARD_MAKES = 20;

// Recharts custom tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const makes = payload[0].value;
  const cleared = makes >= STANDARD_MAKES;
  return (
    <div style={{
      background: 'var(--shadow)',
      border: '1px solid var(--pitch)',
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
    }}>
      <div style={{ color: 'var(--ash)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Run {label}
      </div>
      <div style={{ color: 'var(--chalk)', fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
        {makes} makes
      </div>
      <div style={{ color: cleared ? 'var(--scarlet)' : 'var(--ash)', fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {cleared ? 'Standard cleared' : `${STANDARD_MAKES - makes} short`}
      </div>
    </div>
  );
}

export default function HistoryDashboard() {
  const [runs, setRuns] = useState<WinnersCircleRun[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    // This device's history first, then the account copy folded in.
    const local = loadRuns();
    setRuns(local);
    void syncRuns(local).then((merged) => {
      if (!merged) return;
      setRuns(merged);
      persistRuns(merged);
    });
  }, []);

  function handleDelete(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    const updated = runs.filter(r => r.id !== id);
    persistRuns(updated);
    setRuns(updated);
    setPendingDelete(null);
  }

  // ── Derived stats ──────────────────────────────────────────────
  const allTimeBest = runs.length > 0 ? Math.max(...runs.map(r => r.totalMakes)) : null;
  const deepestFt   = runs.length > 0 ? Math.max(...runs.map(r => r.maxDistanceReached)) : null;
  const last10Avg   = runs.length > 0
    ? (runs.slice(0, 10).reduce((s, r) => s + r.totalMakes, 0) / Math.min(runs.length, 10)).toFixed(1)
    : null;
  const clearedCount = runs.filter(r => r.standardCleared).length;

  // Chart data: oldest-first, with run number label
  const chartData = [...runs].reverse().map((r, i) => ({
    run: i + 1,
    makes: r.totalMakes,
  }));

  const hasEnoughData = runs.length >= 3;

  return (
    <div className="wc-wrapper">
      <div className="wc-top-nav" style={{ marginBottom: 24 }}>
        <Link href="/player-path/putting/winners-circle" className="wc-back-btn" style={{ textDecoration: 'none' }}>
          ← Winners Circle
        </Link>
        <span className="wc-nav-label">History</span>
        <span style={{ minWidth: 60 }} />
      </div>

      {/* ── Summary stat row ── */}
      <div className="wc-stat-row">
        <div className="wc-stat-card">
          <div className="wc-stat-label">All-Time Best</div>
          <div className="wc-stat-value" style={{ color: allTimeBest !== null && allTimeBest >= STANDARD_MAKES ? 'var(--scarlet)' : 'var(--chalk)' }}>
            {allTimeBest ?? '—'}
          </div>
          {allTimeBest !== null && <div className="wc-stat-sub">total makes</div>}
        </div>
        <div className="wc-stat-card">
          <div className="wc-stat-label">Last 10 Avg</div>
          <div className="wc-stat-value">{last10Avg ?? '—'}</div>
          {last10Avg !== null && <div className="wc-stat-sub">makes per run</div>}
        </div>
        <div className="wc-stat-card">
          <div className="wc-stat-label">Deepest Run</div>
          <div className="wc-stat-value">{deepestFt ?? '—'}</div>
          {deepestFt !== null && <div className="wc-stat-sub">feet</div>}
        </div>
        <div className="wc-stat-card">
          <div className="wc-stat-label">Standards</div>
          <div className="wc-stat-value" style={{ color: clearedCount > 0 ? 'var(--scarlet)' : 'var(--chalk)' }}>
            {clearedCount}
          </div>
          <div className="wc-stat-sub">of {runs.length} run{runs.length !== 1 ? 's' : ''} cleared</div>
        </div>
      </div>

      {/* ── Trend chart or empty state ── */}
      {hasEnoughData ? (
        <div className="wc-chart-card">
          <div className="wc-chart-card-header">
            <p className="wc-section-label" style={{ marginBottom: 0 }}>Makes Trend</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pitch)" vertical={false} />
              <XAxis
                dataKey="run"
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)', letterSpacing: '0.08em' }}
                axisLine={{ stroke: 'var(--pitch)' }}
                tickLine={false}
                label={{ value: 'Run', position: 'insideBottomRight', offset: -4, fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)' }}
              />
              <YAxis
                domain={[0, (dataMax: number) => Math.max(24, dataMax + 2)]}
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)' }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine
                y={STANDARD_MAKES}
                stroke="var(--scarlet)"
                strokeDasharray="4 4"
                label={{ value: 'Standard', position: 'insideTopRight', fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--scarlet)' }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--pitch)', strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="makes"
                stroke="var(--c1)"
                strokeWidth={2}
                dot={{ fill: 'var(--c1)', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--c1)', stroke: 'var(--shadow)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="wc-chart-card-header">
            <p className="wc-chart-note">Dashed line = the Standard ({STANDARD_MAKES} makes)</p>
          </div>
        </div>
      ) : (
        <div className="wc-empty-state">
          <p className="wc-empty-icon">Trend Analysis</p>
          <p className="wc-empty-text">
            Log {Math.max(0, 3 - runs.length)} more run{3 - runs.length !== 1 ? 's' : ''} to unlock trend analysis.
          </p>
        </div>
      )}

      {/* ── Run log ── */}
      {runs.length > 0 ? (
        <div className="wc-card">
          <p className="wc-section-label">Run Log</p>
          <div className="wc-log-head">
            <span>Date</span>
            <span>Makes</span>
            <span>Max</span>
            <span>Standard</span>
            <span />
          </div>
          {runs.map(r => {
            const isPending = pendingDelete === r.id;
            return (
              <div className="wc-log-row" key={r.id}>
                <span className="wc-log-date">
                  {fmtDateShort(r.date)}
                </span>
                <span className="wc-log-score">{r.totalMakes}</span>
                <span className="wc-log-dist">{r.maxDistanceReached} ft</span>
                <span className={`wc-log-badge ${r.standardCleared ? 'is-cleared' : ''}`}>
                  {r.standardCleared ? 'Cleared' : `${STANDARD_MAKES - r.totalMakes} short`}
                </span>
                <button
                  className="wc-log-delete"
                  onClick={() => handleDelete(r.id)}
                  aria-label={isPending ? 'Confirm delete' : 'Delete run'}
                  title={isPending ? 'Click again to confirm' : 'Delete run'}
                  style={isPending ? { color: 'var(--double)', borderColor: 'var(--double)' } : undefined}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="wc-empty-state">
          <p className="wc-empty-icon">No Runs Yet</p>
          <p className="wc-empty-text">Complete your first run to see your history here.</p>
        </div>
      )}

      <Link
        href="/player-path/putting/winners-circle"
        className="wc-primary-btn"
        style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
      >
        Start New Run
      </Link>
    </div>
  );
}
