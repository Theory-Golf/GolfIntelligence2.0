'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { loadSessions, deleteSession } from '@/lib/inside-ten/storage';
import { TIER_META, formatSG } from '@/lib/inside-ten/scoring';
import {
  bestScore,
  last10Average,
  last5Average,
  currentTier,
  tierCounts,
  formatDate,
} from '@/lib/inside-ten/stats';
import type { InsideTenSession } from '@/lib/inside-ten/types';
import type { Tier } from '@/lib/inside-ten/types';

// ── Custom chart tooltip ─────────────────────────────────────────────────────

function ScoreTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  return (
    <div className="px-3 py-2 rounded text-left bg-shadow border border-pitch">
      <div className="font-mono text-[10px] tracking-wider text-ash mb-1">
        Session {label}
      </div>
      <div className="font-display font-bold text-lg leading-none text-chalk">
        {score}
        <span className="font-body font-light text-ash" style={{ fontSize: '11px' }}>/18</span>
      </div>
    </div>
  );
}

// ── Tier order for consistent rendering ──────────────────────────────────────

const TIER_ORDER: Tier[] = ['elite', 'tour', 'competitive', 'developing'];

// ── Main component ───────────────────────────────────────────────────────────

export default function InsideTenHistory() {
  const [sessions, setSessions] = useState<InsideTenSession[]>([]);
  const [mounted, setMounted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  function handleDelete(id: string) {
    deleteSession(id);
    setConfirmDelete(null);
    refresh();
  }

  if (!mounted) return null;

  const pb = bestScore(sessions);
  const avg10 = last10Average(sessions);
  const avg5 = last5Average(sessions);
  const tier = currentTier(sessions);
  const tierMeta = tier ? TIER_META[tier] : null;
  const counts = tierCounts(sessions);
  const hasTrend = sessions.length >= 3;

  // Chart data: chronological order (oldest first)
  const chartData = sessions
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((s, i) => ({ session: i + 1, score: s.score, date: formatDate(s.date) }));

  // Donut data — use chartColor (CSS var) for Recharts SVG fill
  const donutData = TIER_ORDER
    .filter(t => counts[t] > 0)
    .map(t => ({ name: TIER_META[t].label, value: counts[t], chartColor: TIER_META[t].chartColor }));

  return (
    <div className="px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-12">

        {/* ── Summary stat row ──────────────────────────────────── */}
        <div>
          <p className="section-label mb-6">Summary</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="p-4 rounded bg-shadow border border-pitch">
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-ash mb-2">All-Time Best</div>
              <div className="font-display font-extrabold text-xl leading-none text-chalk">
                {pb != null ? `${pb}/18` : '—'}
              </div>
            </div>
            <div className="p-4 rounded bg-shadow border border-pitch">
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-ash mb-2">Last 10 Avg</div>
              <div className="font-display font-extrabold text-xl leading-none text-chalk">
                {avg10 != null ? avg10.toFixed(1) : '—'}
              </div>
            </div>
            <div className="p-4 rounded bg-shadow border border-pitch">
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-ash mb-2">Sessions</div>
              <div className="font-display font-extrabold text-xl leading-none text-chalk">
                {sessions.length > 0 ? sessions.length : '—'}
              </div>
            </div>
            <div className="p-4 rounded bg-shadow border border-pitch">
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-ash mb-2">Current Tier</div>
              <div className={`font-display font-extrabold text-xl leading-none ${tierMeta?.textClass ?? 'text-chalk'}`}>
                {tierMeta?.label ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Empty state or charts ─────────────────────────────── */}
        {!hasTrend ? (
          <div className="p-10 rounded text-center bg-shadow border border-pitch">
            <p className="font-display font-bold text-base uppercase tracking-wider text-cement mb-2">
              {sessions.length === 0 ? 'No Sessions Yet' : 'Log a Few More Sessions'}
            </p>
            <p className="font-body text-sm text-ash">
              {sessions.length === 0
                ? 'Complete your first Inside Ten session to start tracking performance.'
                : 'Log a few more sessions to unlock trend analysis.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Trend chart ───────────────────────────────────── */}
            <div>
              <p className="section-label mb-6">Score Trend</p>
              <div className="p-4 rounded bg-shadow border border-pitch">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--pitch)" strokeDasharray="0" vertical={false} />
                    <XAxis
                      dataKey="session"
                      tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)', letterSpacing: '0.1em' }}
                      axisLine={{ stroke: 'var(--pitch)' }}
                      tickLine={false}
                      label={{ value: 'SESSION', position: 'insideBottom', offset: -2, fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)', letterSpacing: '0.15em' }}
                    />
                    <YAxis
                      domain={[0, 18]}
                      ticks={[0, 3, 6, 9, 12, 15, 18]}
                      tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ash)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ScoreTooltip />} cursor={{ stroke: 'var(--pitch)', strokeWidth: 1 }} />
                    {/* Tour baseline reference — SVG prop, keep as CSS var */}
                    <ReferenceLine
                      y={12}
                      stroke="var(--color-sg-gain)"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                      label={{ value: 'TOUR', position: 'insideTopRight', fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--color-sg-gain)', letterSpacing: '0.15em' }}
                    />
                    {/* SVG stroke prop — keep as CSS var */}
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--color-c1)"
                      strokeWidth={2}
                      dot={{ fill: 'var(--color-c1)', r: 3, strokeWidth: 0 }}
                      activeDot={{ fill: 'var(--color-c1)', r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Tier breakdown ────────────────────────────────── */}
            <div>
              <p className="section-label mb-6">Tier Breakdown</p>
              <div className="p-6 rounded bg-shadow border border-pitch flex flex-col sm:flex-row items-center gap-8">
                {/* Donut — SVG fill props, keep chartColor CSS vars */}
                <div className="shrink-0">
                  <PieChart width={160} height={160}>
                    <Pie
                      data={donutData}
                      cx={75}
                      cy={75}
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.chartColor} stroke="var(--shadow)" strokeWidth={2} />
                      ))}
                    </Pie>
                  </PieChart>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-3">
                  {TIER_ORDER.filter(t => counts[t] > 0).map(t => {
                    const m = TIER_META[t];
                    const pct = Math.round((counts[t] / sessions.length) * 100);
                    return (
                      <div key={t} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${m.bgClass.replace('/10', '')}`} style={{ background: m.chartColor }} />
                        <span className="font-mono text-[10px] tracking-wider uppercase flex-1 text-cement">
                          {m.label}
                        </span>
                        <span className="font-mono text-[10px] tracking-wider text-ash">
                          {counts[t]} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Session log ───────────────────────────────────────── */}
        {sessions.length > 0 && (
          <div>
            <p className="section-label mb-6">Session Log</p>
            <div className="rounded overflow-hidden border border-pitch">
              {/* Table header */}
              <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-obsidian border-b border-pitch">
                {['Date', 'Score', 'SG', 'Tier', ''].map((h, i) => (
                  <span key={i} className="font-mono text-[9px] tracking-[0.2em] uppercase text-ash">
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {sessions.map((s, i) => {
                const m = TIER_META[s.tier];
                const isConfirming = confirmDelete === s.id;
                return (
                  <div
                    key={s.id}
                    className={`grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 px-5 py-3 items-center ${i < sessions.length - 1 ? 'border-b border-pitch' : ''} ${i % 2 === 0 ? 'bg-shadow' : 'bg-obsidian'}`}
                  >
                    <span className="font-mono text-[10px] tracking-wider text-ash">
                      {formatDate(s.date)}
                    </span>
                    <span className="font-display font-bold text-sm text-chalk">
                      {s.score}/18
                    </span>
                    <span className={`font-mono text-[11px] tracking-wider ${m.textClass}`}>
                      {formatSG(s.sg)}
                    </span>
                    <span className={`font-mono text-[10px] tracking-wider uppercase ${m.textClass}`}>
                      {m.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {isConfirming ? (
                        <>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="font-mono text-[10px] tracking-wider px-2 py-1 rounded text-double border border-double transition-opacity hover:opacity-70"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="font-mono text-[10px] tracking-wider px-2 py-1 rounded text-ash border border-pitch transition-opacity hover:opacity-70"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(s.id)}
                          aria-label="Delete session"
                          className="p-1 rounded text-ash transition-opacity hover:opacity-70"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Avg5 footnote */}
        {sessions.length > 0 && avg5 !== null && (
          <p className="font-mono text-[9px] tracking-wider text-center text-ash">
            Current tier based on last-5-session average score ({avg5.toFixed(1)}/18).
            SG values are estimates — true SG depends on which specific distances were made.
          </p>
        )}
      </div>
    </div>
  );
}
