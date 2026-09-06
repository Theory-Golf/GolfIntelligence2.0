'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { LS_INSIDE_TEN_SESSIONS } from '@/lib/constants';
import { useDrillHistory } from '@/lib/golf/useDrillHistory';
import { DistanceProfile } from '@/components/putting/LadderBreakdown';
import {
  TIER_CONFIG,
  TOUR_BASELINE_SCORE,
  allPutts,
  formatSG,
  sgForScore,
  tierForScore,
  type InsideTenSession,
  type TierName,
} from './model';
import '@/components/putting/LadderPlay.css';
import './InsideTen.css';

const getSessionId = (s: InsideTenSession) => s.id;
const getSessionPlayedAt = (s: InsideTenSession) => s.date;

// Recharts custom tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  const cfg = TIER_CONFIG[tierForScore(score)];
  return (
    <div style={{
      background: 'var(--shadow)',
      border: '1px solid var(--pitch)',
      padding: 'var(--spacing-2-5) var(--spacing-3-5)',
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
        {formatSG(sgForScore(score))} SG · {cfg.label}
      </div>
    </div>
  );
}

export default function HistoryDashboard() {
  const { sessions, remove } = useDrillHistory<InsideTenSession>({
    drillType: 'inside-ten',
    lsKey: LS_INSIDE_TEN_SESSIONS,
    getId: getSessionId,
    getPlayedAt: getSessionPlayedAt,
  });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    remove(id);
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

  // Distance rollup across every session that was logged putt by putt.
  const loggedSessions = sessions.filter(s => s.putts?.length);
  const puttLog = allPutts(sessions);

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
 y={TOUR_BASELINE_SCORE}
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
              <p className="it-chart-note">Dashed line = SG 0 baseline (score {TOUR_BASELINE_SCORE})</p>
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

      {/* ── Make rate by distance, across every putt-by-putt session ── */}
      {puttLog.length > 0 ? (
        <DistanceProfile
 putts={puttLog}
 title="Make Rate by Distance"
 note={`${puttLog.length} putts across ${loggedSessions.length} session${loggedSessions.length === 1 ? '' : 's'} logged putt by putt. Total-only sessions are not included.`}
        />
      ) : sessions.length > 0 && (
        <div className="it-empty-state">
          <p className="it-empty-icon">Make Rate by Distance</p>
          <p className="it-empty-text">
            Log a session putt by putt to see which distances your makes and
            misses are coming from.
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
            <span className="text-right">SG</span>
            <span>Tier</span>
            <span />
          </div>
          {sessions.map(s => {
            const cfg = TIER_CONFIG[s.tier];
            const isPending = pendingDelete === s.id;
            return (
              <div className="it-log-row" key={s.id}>
                <span className="it-log-date">
                  {new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  {s.putts?.length ? (
                    <span className="lp-log-mark" title="Logged putt by putt">▪</span>
                  ) : null}
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
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
          <p className="lp-note">
            <span className="lp-log-mark">▪</span> logged putt by putt — carries distance detail
          </p>
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
