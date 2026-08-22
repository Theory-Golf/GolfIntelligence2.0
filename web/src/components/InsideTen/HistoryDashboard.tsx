'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { loadSessions, persistSessions, syncSessions, type InsideTenSession, type TierName } from '.';
import './InsideTen.css';
import { fmtDateShort } from '@/lib/playerpath/format';

const SG_TABLE: Record<number, number> = {
  18: 6.28, 17: 5.25, 16: 4.22, 15: 3.19, 14: 2.16, 13: 1.13,
  12: 0.10, 11: -0.93, 10: -1.96, 9: -2.99, 8: -4.02, 7: -5.05,
  6: -6.08, 5: -7.11, 4: -8.14, 3: -9.17, 2: -10.20, 1: -11.23, 0: -12.26,
};

const TIER_CONFIG: Record<TierName, { label: string; color: string; hexColor: string }> = {
  elite:       { label: 'Elite',       color: 'var(--sg-strong)', hexColor: '#00C07A' },
  tour:        { label: 'Tour',        color: 'var(--sg-gain)',   hexColor: '#52D9A0' },
  competitive: { label: 'Competitive', color: 'var(--bogey)',     hexColor: '#F59520' },
  developing:  { label: 'Developing',  color: 'var(--double)',    hexColor: '#E8202A' },
};

function tierForScore(score: number): TierName {
  if (score >= 13) return 'elite';
  if (score >= 11) return 'tour';
  if (score >= 9)  return 'competitive';
  return 'developing';
}

function formatSG(sg: number): string {
  const abs = Math.abs(sg).toFixed(1);
  return sg >= 0 ? `+${abs}` : `-${abs}`;
}

// Recharts custom tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  const sg = SG_TABLE[score] ?? 0;
  const tier = tierForScore(score);
  const cfg = TIER_CONFIG[tier];
  return (
    <div style={{
      background: 'var(--shadow)',
      border: '1px solid var(--pitch)',
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
    }}>
      <div style={{ color: 'var(--ash)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Session {label}
      </div>
      <div style={{ color: 'var(--chalk)', fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
        {score}/18
      </div>
      <div style={{ color: cfg.color, fontSize: 11, marginTop: 4 }}>
        {formatSG(sg)} SG · {cfg.label}
      </div>
    </div>
  );
}

export default function HistoryDashboard() {
  const [sessions, setSessions] = useState<InsideTenSession[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    // This device's history first, then the account copy folded in.
    const local = loadSessions();
    setSessions(local);
    void syncSessions(local).then((merged) => {
      if (!merged) return;
      setSessions(merged);
      persistSessions(merged);
    });
  }, []);

  function handleDelete(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    const updated = sessions.filter(s => s.id !== id);
    persistSessions(updated);
    setSessions(updated);
    setPendingDelete(null);
  }

  // ── Derived stats ──────────────────────────────────────────────
  const allTimeBest = sessions.length > 0 ? Math.max(...sessions.map(s => s.score)) : null;
  const last10Avg   = sessions.length > 0
    ? (sessions.slice(0, 10).reduce((s, r) => s + r.score, 0) / Math.min(sessions.length, 10)).toFixed(1)
    : null;
  const last5AvgScore = sessions.length > 0
    ? sessions.slice(0, 5).reduce((s, r) => s + r.score, 0) / Math.min(sessions.length, 5)
    : null;
  const currentTier = last5AvgScore !== null ? TIER_CONFIG[tierForScore(Math.round(last5AvgScore))] : null;

  // Chart data: oldest-first, with session number label
  const chartData = [...sessions].reverse().map((s, i) => ({
    session: i + 1,
    score: s.score,
  }));

  // Tier breakdown counts
  const tierCounts = { elite: 0, tour: 0, competitive: 0, developing: 0 };
  for (const s of sessions) tierCounts[s.tier]++;
  const pieData = (Object.entries(tierCounts) as [TierName, number][])
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: TIER_CONFIG[key].label, value, color: TIER_CONFIG[key].hexColor }));

  const hasEnoughData = sessions.length >= 3;

  return (
    <div className="it-wrapper">
      <div className="it-top-nav" style={{ marginBottom: 24 }}>
        <Link href="/player-path/putting/inside-ten" className="it-back-btn" style={{ textDecoration: 'none' }}>
          ← Inside Ten
        </Link>
        <span className="it-nav-label">History</span>
        <span style={{ minWidth: 60 }} />
      </div>

      {/* ── Summary stat row ── */}
      <div className="it-stat-row">
        <div className="it-stat-card">
          <div className="it-stat-label">All-Time Best</div>
          <div className="it-stat-value" style={{ color: allTimeBest !== null && allTimeBest >= 13 ? 'var(--sg-strong)' : 'var(--chalk)' }}>
            {allTimeBest ?? '—'}
          </div>
          {allTimeBest !== null && (
            <div className="it-stat-sub">out of 18</div>
          )}
        </div>
        <div className="it-stat-card">
          <div className="it-stat-label">Last 10 Avg</div>
          <div className="it-stat-value">{last10Avg ?? '—'}</div>
          {last10Avg !== null && <div className="it-stat-sub">out of 18</div>}
        </div>
        <div className="it-stat-card">
          <div className="it-stat-label">Sessions</div>
          <div className="it-stat-value">{sessions.length}</div>
          <div className="it-stat-sub">logged</div>
        </div>
        <div className="it-stat-card">
          <div className="it-stat-label">Current Tier</div>
          <div className="it-stat-value" style={{ fontSize: currentTier ? 20 : 32, paddingTop: currentTier ? 6 : 0, color: currentTier?.color }}>
            {currentTier?.label ?? '—'}
          </div>
          {currentTier && <div className="it-stat-sub">last 5 avg</div>}
        </div>
      </div>

      {/* ── Trend chart or empty state ── */}
      {hasEnoughData ? (
        <>
          <div className="it-chart-card">
            <div className="it-chart-card-header">
              <p className="it-section-label" style={{ marginBottom: 0 }}>Score Trend</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pitch)" vertical={false} />
                <XAxis
                  dataKey="session"
                  tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)', letterSpacing: '0.08em' }}
                  axisLine={{ stroke: 'var(--pitch)' }}
                  tickLine={false}
                  label={{ value: 'Session', position: 'insideBottomRight', offset: -4, fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)' }}
                />
                <YAxis
                  domain={[0, 18]}
                  ticks={[0, 3, 6, 9, 12, 15, 18]}
                  tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine
                  y={12}
                  stroke="var(--ash)"
                  strokeDasharray="4 4"
                  label={{ value: 'SG 0', position: 'insideTopRight', fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)' }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--pitch)', strokeWidth: 1 }} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--c1)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--c1)', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--c1)', stroke: 'var(--shadow)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="it-chart-card-header">
              <p className="it-chart-note">Dashed line = SG 0 baseline (score 12)</p>
            </div>
          </div>

          {/* ── Tier breakdown ── */}
          <div className="it-chart-card">
            <div className="it-chart-card-header">
              <p className="it-section-label" style={{ marginBottom: 0 }}>Tier Breakdown</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} sessions`, '']}
                  contentStyle={{ background: 'var(--shadow)', border: '1px solid var(--pitch)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                  itemStyle={{ color: 'var(--chalk)' }}
                  labelStyle={{ display: 'none' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ash)' }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="it-empty-state">
          <p className="it-empty-icon">Trend Analysis</p>
          <p className="it-empty-text">
            Log {Math.max(0, 3 - sessions.length)} more session{3 - sessions.length !== 1 ? 's' : ''} to unlock trend analysis.
          </p>
        </div>
      )}

      {/* ── Session log ── */}
      {sessions.length > 0 ? (
        <div className="it-card">
          <p className="it-section-label">Session Log</p>
          <div className="it-log-head">
            <span>Date</span>
            <span>Score</span>
            <span style={{ textAlign: 'right' }}>SG</span>
            <span>Tier</span>
            <span />
          </div>
          {sessions.map(s => {
            const cfg = TIER_CONFIG[s.tier];
            const isPending = pendingDelete === s.id;
            return (
              <div className="it-log-row" key={s.id}>
                <span className="it-log-date">
                  {fmtDateShort(s.date)}
                </span>
                <span className="it-log-score">{s.score}/18</span>
                <span className="it-log-sg" style={{ color: cfg.color }}>{formatSG(s.sg)}</span>
                <span className="it-log-tier-badge" style={{ color: cfg.color }}>{cfg.label}</span>
                <button
                  className="it-log-delete"
                  onClick={() => handleDelete(s.id)}
                  aria-label={isPending ? 'Confirm delete' : 'Delete session'}
                  title={isPending ? 'Click again to confirm' : 'Delete session'}
                  style={isPending ? { color: 'var(--double)', borderColor: 'var(--double)' } : undefined}
                >
                  {isPending ? <Trash2 size={13} /> : <Trash2 size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="it-empty-state">
          <p className="it-empty-icon">No Sessions Yet</p>
          <p className="it-empty-text">Complete your first session to see your history here.</p>
        </div>
      )}

      <Link
        href="/player-path/putting/inside-ten"
        className="it-primary-btn"
        style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
      >
        Start New Session
      </Link>
    </div>
  );
}
