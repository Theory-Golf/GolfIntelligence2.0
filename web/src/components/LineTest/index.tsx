'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { CLUB_OPTIONS, DEFAULT_CLUBS } from '@/components/WeatherYardageCard/StepMyBag';
import { LS_CLUBS, LS_LINE_TEST_SESSIONS } from '@/lib/constants';
import { useDrillHistory } from '@/lib/golf/useDrillHistory';

// ── Domain ───────────────────────────────────────────────────────────

type BandId = 'short' | 'mid' | 'long';
type Mode = 'manual' | 'radar';
type OrderMode = 'progressive' | 'random';
type Direction = 'left' | 'right' | 'center';
type TierName = 'TOUR' | 'ELITE' | 'COMPETITIVE' | 'DEVELOPING' | 'FOUNDATION';

interface TierBand {
  t: TierName;
  max: number;
}

interface Anchor {
  label: string;
  value: number;
}

interface BandConfig {
  id: BandId;
  label: string;
  name: string;
  range: [number, number];
  upper: number;
  tiers: TierBand[];
  anchors: Anchor[];
}

const TIER_ORDER: TierName[] = ['TOUR', 'ELITE', 'COMPETITIVE', 'DEVELOPING', 'FOUNDATION'];

const BANDS: Record<BandId, BandConfig> = {
  short: {
    id: 'short',
    label: 'Wedges',
    name: 'Short',
    range: [75, 125],
    upper: 125,
    tiers: [
      { t: 'TOUR', max: 22 },
      { t: 'ELITE', max: 31 },
      { t: 'COMPETITIVE', max: 37 },
      { t: 'DEVELOPING', max: 50 },
      { t: 'FOUNDATION', max: Infinity },
    ],
    anchors: [
      { label: 'World #1 amateur (scaled)', value: 31 },
      { label: 'D1 All-American median', value: 31 },
      { label: 'Top-25 college median', value: 34 },
    ],
  },
  mid: {
    id: 'mid',
    label: 'Mid Irons',
    name: 'Mid',
    range: [125, 175],
    upper: 175,
    tiers: [
      { t: 'TOUR', max: 41 },
      { t: 'ELITE', max: 55 },
      { t: 'COMPETITIVE', max: 73 },
      { t: 'DEVELOPING', max: 95 },
      { t: 'FOUNDATION', max: Infinity },
    ],
    anchors: [
      { label: 'World #1 amateur 2-yr avg', value: 55 },
      { label: 'Top-25 college median', value: 64 },
      { label: 'D1 All-American floor', value: 73 },
    ],
  },
  long: {
    id: 'long',
    label: 'Long Irons',
    name: 'Long',
    range: [175, 225],
    upper: 225,
    tiers: [
      { t: 'TOUR', max: 55 },
      { t: 'ELITE', max: 73 },
      { t: 'COMPETITIVE', max: 97 },
      { t: 'DEVELOPING', max: 126 },
      { t: 'FOUNDATION', max: Infinity },
    ],
    anchors: [
      { label: 'World #1 amateur (scaled)', value: 73 },
      { label: 'Top-25 college median', value: 85 },
      { label: 'D1 All-American floor', value: 97 },
    ],
  },
};

const TIER_DESC: Record<TierName, string> = {
  TOUR: 'Approaching the best players in the world.',
  ELITE: 'High-end collegiate player.',
  COMPETITIVE: 'Strong college player, competitive amateur.',
  DEVELOPING: 'Continue to improve approach skill.',
  FOUNDATION: 'Entry level for competitive amateur play; building approach skill.',
};

const tierClass: Record<TierName, string> = {
  TOUR: 'text-sg-strong',
  ELITE: 'text-sg-gain',
  COMPETITIVE: 'text-c1',
  DEVELOPING: 'text-sg-loss',
  FOUNDATION: 'text-sg-weak',
};
const tierBorder: Record<TierName, string> = {
  TOUR: 'border-sg-strong',
  ELITE: 'border-sg-gain',
  COMPETITIVE: 'border-c1',
  DEVELOPING: 'border-sg-loss',
  FOUNDATION: 'border-sg-weak',
};

// ── Carry profile (shared across PlayerPath via yc4_clubs) ────────────

interface ProfileClub {
  id: string;
  name: string;
  carry: number;
}

const clubName = (id: string) => CLUB_OPTIONS.find((o) => o.id === id)?.name ?? id;

const loadProfile = (): ProfileClub[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_CLUBS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { id: string; dist: number }[];
    return parsed
      .filter((c) => c.id && c.dist > 0)
      .map((c) => ({ id: c.id, name: clubName(c.id), carry: c.dist }));
  } catch {
    return [];
  }
};

const saveProfile = (clubs: { id: string; dist: number }[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_CLUBS, JSON.stringify(clubs));
  } catch {}
};

const hasProfile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LS_CLUBS) !== null;
};

/**
 * Pick the club closest to the band's upper bound, then the three next
 * shorter clubs. Bands are guidance — always returns exactly 4 clubs
 * (ordered shortest → longest), or null if the bag has fewer than 4.
 */
function selectClubs(profile: ProfileClub[], upper: number): ProfileClub[] | null {
  const valid = [...profile].sort((a, b) => b.carry - a.carry); // longest → shortest
  if (valid.length < 4) return null;
  let anchor = 0;
  let bestGap = Infinity;
  valid.forEach((c, i) => {
    const gap = Math.abs(c.carry - upper);
    if (gap < bestGap) {
      bestGap = gap;
      anchor = i;
    }
  });
  let start = anchor;
  if (start + 4 > valid.length) start = valid.length - 4;
  if (start < 0) start = 0;
  const chosen = valid.slice(start, start + 4); // longest → shortest
  return chosen.reverse(); // shortest → longest
}

// ── Sighting math (AimPoint, 2° per finger) ──────────────────────────

const fingerYards = (carry: number, fingers: number) =>
  Math.round(carry * 0.035 * fingers);

// ── Shot order ───────────────────────────────────────────────────────

function buildOrder(mode: OrderMode): number[] {
  // indices 0..3, 0 = shortest club. 5 of each = 20 shots.
  if (mode === 'progressive') {
    const seq: number[] = [];
    for (let cycle = 0; cycle < 5; cycle++) {
      for (let i = 0; i < 4; i++) seq.push(i);
    }
    return seq;
  }
  for (let attempt = 0; attempt < 2000; attempt++) {
    const counts = [5, 5, 5, 5];
    const seq: number[] = [];
    let ok = true;
    for (let s = 0; s < 20; s++) {
      const last = seq[seq.length - 1];
      const pool: number[] = [];
      for (let i = 0; i < 4; i++) {
        if (counts[i] > 0 && i !== last) pool.push(i);
      }
      if (pool.length === 0) {
        ok = false;
        break;
      }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      seq.push(pick);
      counts[pick]--;
    }
    if (ok) return seq;
  }
  // Deterministic fallback (also satisfies no-consecutive-repeat).
  return buildOrder('progressive');
}

// ── Scoring ──────────────────────────────────────────────────────────

interface RawShot {
  clubIdx: number;
  lateral: number;
  direction: Direction;
}

interface ShotRecord {
  shot_number: number;
  club: string;
  lateral_yards: number;
  direction: Direction;
  is_dropped: boolean;
}

interface PerClub {
  total: number;
  avg: number;
  max: number;
}

interface SessionResult {
  session_id: string;
  timestamp: string;
  test_band: BandId;
  mode: Mode;
  order_mode: OrderMode;
  clubs_used: string[];
  club_carries: number[];
  shots: ShotRecord[];
  total_score: number;
  best_shot_dropped: number;
  worst_shot_dropped: number;
  tier: TierName;
  points_to_next_tier: number;
  next_tier: TierName | null;
  miss_left_count: number;
  miss_right_count: number;
  center_count: number;
  per_club_dispersion: Record<string, PerClub>;
  stddev_scoring: number;
}

function computeTier(band: BandConfig, score: number): { tier: TierName; idx: number } {
  for (let i = 0; i < band.tiers.length; i++) {
    if (score <= band.tiers[i].max) return { tier: band.tiers[i].t, idx: i };
  }
  return { tier: 'FOUNDATION', idx: band.tiers.length - 1 };
}

function pointsToNext(
  band: BandConfig,
  score: number,
  idx: number,
): { points: number; nextTier: TierName | null } {
  if (idx === 0) return { points: 0, nextTier: null };
  const nextMax = band.tiers[idx - 1].max;
  return { points: Math.max(0, score - nextMax), nextTier: band.tiers[idx - 1].t };
}

function buildSession(
  band: BandConfig,
  mode: Mode,
  orderMode: OrderMode,
  clubs: ProfileClub[],
  raw: RawShot[],
): SessionResult {
  const lats = raw.map((s) => s.lateral);
  const minVal = Math.min(...lats);
  const maxVal = Math.max(...lats);
  let bestIdx = lats.indexOf(minVal);
  let worstIdx = lats.lastIndexOf(maxVal);
  if (bestIdx === worstIdx) {
    worstIdx = bestIdx === lats.length - 1 ? 0 : lats.length - 1;
  }
  const dropped = new Set([bestIdx, worstIdx]);

  const shots: ShotRecord[] = raw.map((s, i) => ({
    shot_number: i + 1,
    club: clubs[s.clubIdx].id,
    lateral_yards: s.lateral,
    direction: s.direction,
    is_dropped: dropped.has(i),
  }));

  let total = 0;
  const scoringLats: number[] = [];
  raw.forEach((s, i) => {
    if (!dropped.has(i)) {
      total += s.lateral;
      scoringLats.push(s.lateral);
    }
  });

  const mean = scoringLats.reduce((a, b) => a + b, 0) / scoringLats.length;
  const variance =
    scoringLats.reduce((a, b) => a + (b - mean) ** 2, 0) / scoringLats.length;
  const stddev = Math.sqrt(variance);

  const perClub: Record<string, PerClub> = {};
  clubs.forEach((c, ci) => {
    const cl = raw.filter((s) => s.clubIdx === ci).map((s) => s.lateral);
    const t = cl.reduce((a, b) => a + b, 0);
    perClub[c.id] = {
      total: t,
      avg: cl.length ? Math.round((t / cl.length) * 10) / 10 : 0,
      max: cl.length ? Math.max(...cl) : 0,
    };
  });

  let missLeft = 0;
  let missRight = 0;
  let center = 0;
  raw.forEach((s) => {
    if (s.direction === 'left') missLeft++;
    else if (s.direction === 'right') missRight++;
    else center++;
  });

  const { tier, idx } = computeTier(band, total);
  const { points, nextTier } = pointsToNext(band, total, idx);

  return {
    session_id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `lt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    test_band: band.id,
    mode,
    order_mode: orderMode,
    clubs_used: clubs.map((c) => c.id),
    club_carries: clubs.map((c) => c.carry),
    shots,
    total_score: total,
    best_shot_dropped: minVal,
    worst_shot_dropped: lats[worstIdx],
    tier,
    points_to_next_tier: points,
    next_tier: nextTier,
    miss_left_count: missLeft,
    miss_right_count: missRight,
    center_count: center,
    per_club_dispersion: perClub,
    stddev_scoring: Math.round(stddev * 10) / 10,
  };
}

const getSessionId = (s: SessionResult) => s.session_id;
const getSessionPlayedAt = (s: SessionResult) => s.timestamp;

// ── Insights ─────────────────────────────────────────────────────────

interface Insight {
  id: string;
  title: string;
  finding: string;
  prescription?: string;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function detectPatterns(bandSessions: SessionResult[], band: BandConfig): Insight[] {
  if (bandSessions.length < 5) return [];
  const out: Insight[] = [];
  const n = bandSessions.length;

  // 1 — Persistent miss direction
  const sumL = bandSessions.reduce((a, s) => a + s.miss_left_count, 0);
  const sumR = bandSessions.reduce((a, s) => a + s.miss_right_count, 0);
  const tot = sumL + sumR;
  if (tot > 0) {
    const dir = sumL >= sumR ? 'left' : 'right';
    const pct = Math.round((Math.max(sumL, sumR) / tot) * 100);
    if (pct >= 60) {
      out.push({
        id: 'persistent-miss',
        title: 'Persistent miss direction',
        finding: `You miss ${dir} ${pct}% of the time in the ${band.name} band across ${n} sessions. This is a one-way miss pattern.`,
        prescription: `A one-way miss usually points to a setup or face-control habit. Build an alignment-stick station and bias your aim until the pattern centers.`,
      });
    }
  }

  // 2 — Club-specific weakness
  const agg: Record<string, { total: number; shots: number }> = {};
  bandSessions.forEach((s) => {
    Object.entries(s.per_club_dispersion).forEach(([id, pc]) => {
      if (!agg[id]) agg[id] = { total: 0, shots: 0 };
      agg[id].total += pc.total;
      agg[id].shots += 5;
    });
  });
  const clubAvgs = Object.entries(agg).map(([id, v]) => ({
    id,
    avg: v.shots ? v.total / v.shots : 0,
  }));
  if (clubAvgs.length >= 2) {
    const worst = clubAvgs.reduce((a, b) => (b.avg > a.avg ? b : a));
    const others = clubAvgs.filter((c) => c.id !== worst.id);
    const othersMean = others.reduce((a, b) => a + b.avg, 0) / others.length;
    if (othersMean > 0 && worst.avg >= othersMean * 1.4) {
      out.push({
        id: 'club-weakness',
        title: 'Club-specific weakness',
        finding: `Your ${clubName(worst.id)} is consistently your highest-dispersion club, averaging ${worst.avg.toFixed(
          1,
        )} yd offline vs. ${othersMean.toFixed(1)} yd for your other ${band.name}-band clubs.`,
        prescription: `Dedicate a block of practice to ${clubName(
          worst.id,
        )} alone before your next test — isolated reps close club-specific gaps fastest.`,
      });
    }
  }

  // 5 — Consistency vs. accuracy split
  const avgStd =
    bandSessions.reduce((a, s) => a + s.stddev_scoring, 0) / n;
  let signedSum = 0;
  let signedCount = 0;
  bandSessions.forEach((s) => {
    s.shots.forEach((sh) => {
      if (sh.is_dropped) return;
      if (sh.direction === 'left') signedSum -= sh.lateral_yards;
      else if (sh.direction === 'right') signedSum += sh.lateral_yards;
      signedCount++;
    });
  });
  const meanOffset = signedCount ? signedSum / signedCount : 0;
  if (Math.abs(meanOffset) >= 4 && avgStd <= Math.abs(meanOffset)) {
    const side = meanOffset < 0 ? 'left' : 'right';
    out.push({
      id: 'face-angle',
      title: 'Tightly grouped but offset',
      finding: `Your shots are tightly grouped (low variance, ~${avgStd.toFixed(
        1,
      )} yd) but consistently ${Math.abs(meanOffset).toFixed(
        1,
      )} yd ${side} of target. This is a face-angle issue, not a swing-path issue.`,
      prescription: `Don't chase consistency — you already have it. Work face alignment at address and impact to shift the whole group onto the line.`,
    });
  } else if (avgStd >= band.tiers[1].max / 4) {
    out.push({
      id: 'scattered',
      title: 'Scatter, not offset',
      finding: `Your scoring shots are scattered (variance ~${avgStd.toFixed(
        1,
      )} yd) rather than offset to one side. This is a swing-path/contact repeatability problem, not an aim problem.`,
      prescription: `Prioritize strike and path repeatability drills over alignment work until the group tightens.`,
    });
  }

  // Guarantee at least one pattern surfaces at >=5 sessions.
  if (out.length === 0 && tot > 0) {
    const dir = sumL >= sumR ? 'left' : 'right';
    const pct = Math.round((Math.max(sumL, sumR) / tot) * 100);
    out.push({
      id: 'miss-tendency',
      title: 'Miss tendency',
      finding: `Across ${n} ${band.name}-band sessions your dominant miss is ${dir} (${pct}% of misses). No single dominant pattern yet — keep logging sessions to sharpen the read.`,
    });
  }

  return out;
}

function crossBandDiagnosis(all: SessionResult[]): Insight[] {
  const byBand: Record<BandId, SessionResult[]> = { short: [], mid: [], long: [] };
  all.forEach((s) => byBand[s.test_band].push(s));
  const qualifying = (Object.keys(byBand) as BandId[]).filter(
    (b) => byBand[b].length >= 3,
  );
  if (qualifying.length < 2) return [];

  const out: Insight[] = [];
  const repTier: Record<string, { tier: TierName; idx: number; name: string }> = {};
  qualifying.forEach((b) => {
    const sessions = byBand[b];
    const last3 = sessions.slice(-3);
    const avgScore = Math.round(
      last3.reduce((a, s) => a + s.total_score, 0) / last3.length,
    );
    const { tier, idx } = computeTier(BANDS[b], avgScore);
    repTier[b] = { tier, idx, name: BANDS[b].name };
  });

  const idxs = qualifying.map((b) => repTier[b].idx);
  const spread = Math.max(...idxs) - Math.min(...idxs);
  if (spread >= 1) {
    const weakest = qualifying.reduce((a, b) =>
      repTier[b].idx > repTier[a].idx ? b : a,
    );
    const strongest = qualifying.reduce((a, b) =>
      repTier[b].idx < repTier[a].idx ? b : a,
    );
    out.push({
      id: 'cross-band-gap',
      title: 'Band-specific weakness',
      finding: `You're ${repTier[strongest].tier} in the ${repTier[strongest].name} band but ${repTier[weakest].tier} in the ${repTier[weakest].name} band. ${repTier[weakest].name}-band face control is your biggest gap.`,
      prescription: `Weight your practice toward the ${repTier[weakest].name} band until the tier gap closes.`,
    });
  } else {
    out.push({
      id: 'cross-band-balanced',
      title: 'Balanced ball-striker',
      finding: `Your tier is consistent across the bands you've tested — you're a balanced ball-striker.`,
      prescription: `Focus practice on the band closest to your scoring weakness on the course.`,
    });
  }

  // 4 — Direction shift across bands (short vs long)
  const domDir = (b: BandId): Direction | null => {
    if (byBand[b].length < 3) return null;
    const l = byBand[b].reduce((a, s) => a + s.miss_left_count, 0);
    const r = byBand[b].reduce((a, s) => a + s.miss_right_count, 0);
    if (l + r === 0) return null;
    return l > r ? 'left' : 'right';
  };
  const ds = domDir('short');
  const dl = domDir('long');
  if (ds && dl && ds !== dl) {
    out.push({
      id: 'direction-shift',
      title: 'Direction shift across bands',
      finding: `Your miss tendency shifts from ${ds} at Short to ${dl} at Long across your sessions. This may indicate a setup or release-timing issue worth reviewing with your coach.`,
    });
  }

  return out;
}

// ── Atoms (Tailwind only) ────────────────────────────────────────────

const Eyebrow = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`font-mono text-label tracking-[0.28em] uppercase text-primary ${className}`}>{children}</p>
);

const Mono = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`font-mono text-label tracking-[0.18em] uppercase text-muted-foreground ${className}`}>{children}</span>
);

const PrimaryButton = ({
  children, onClick, disabled = false, className = '',
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full px-6 py-4 font-display text-sm font-bold tracking-[0.16em] uppercase transition-colors duration-150
      ${disabled
        ? 'bg-pitch text-muted-foreground cursor-not-allowed'
        : 'bg-primary text-primary-foreground hover:bg-scarlet-glow cursor-pointer'} ${className}`}
  >
    {children}
  </button>
);

const SecondaryButton = ({
  children, onClick, className = '',
}: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full px-6 py-[15px] font-display text-sm font-bold tracking-[0.16em] uppercase
      bg-transparent text-foreground border border-border hover:border-cement transition-colors duration-150 cursor-pointer ${className}`}
  >
    {children}
  </button>
);

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 font-mono text-label tracking-[0.2em] uppercase text-muted-foreground hover:text-primary transition-colors self-start"
  >
    <ArrowLeft className="size-3" /> Back
  </button>
);

const Attribution = () => (
  <div className="border-t border-border pt-4">
    <Mono className="block mb-2">Attribution &amp; lineage</Mono>
    <p className="font-body text-label-sm text-muted-foreground leading-relaxed">
      The Line Test is inspired by the dispersion benchmark protocol developed
      by Chris Zambri (USC 2006–2020, Pepperdine 2020–2023; currently head
      coach, U.S. National Development Program / U.S. Junior National Team,
      USGA). The protocol structure is Zambri&rsquo;s. Player Path&rsquo;s
      distance ranges, finger-width sighting method, and scoring scale are
      adaptations. Tier thresholds are v1 calibrations.
    </p>
  </div>
);

// ── Screens ──────────────────────────────────────────────────────────

function HomeScreen({
  onBegin, onHistory, hasSessions,
}: { onBegin: () => void; onHistory: () => void; hasSessions: boolean }) {
  return (
    <div className="flex flex-col gap-10 max-w-xl mx-auto">
      <div className="space-y-6">
        <Eyebrow>Player Path Standard</Eyebrow>
        <div className="font-display font-extrabold leading-[0.9] tracking-tight uppercase text-foreground text-[clamp(48px,9vw,80px)]">
          <div>The</div>
          <div className="italic text-primary">Line</div>
          <div className="text-transparent [-webkit-text-stroke:2px_var(--foreground)]">Test</div>
        </div>
        <p className="font-body text-base text-muted-foreground max-w-md leading-relaxed">
          A dispersion benchmark for directional control. Twenty shots across
          four clubs in one distance band, scored on lateral dispersion over
          your best 18. One number, placed on a five-tier ladder anchored to
          college, amateur, and tour reference populations.
        </p>
      </div>

      <div className="border-t border-border pt-6 flex gap-12">
        <div>
          <Mono className="text-primary">Bands</Mono>
          <div className="font-display text-3xl font-bold mt-1 text-foreground">3</div>
        </div>
        <div>
          <Mono className="text-primary">Tiers</Mono>
          <div className="font-display text-3xl font-bold mt-1 text-foreground">5</div>
        </div>
        <div>
          <Mono className="text-primary">Session</Mono>
          <div className="font-display text-3xl font-bold mt-1 text-foreground">
            20<span className="text-base text-muted-foreground ml-1">SHOTS</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={onBegin}>Begin</PrimaryButton>
        {hasSessions && (
          <button
            type="button"
            onClick={onHistory}
            className="font-mono text-label tracking-[0.2em] uppercase text-muted-foreground hover:text-primary transition-colors text-center mt-1"
          >
            View history
          </button>
        )}
      </div>

      <Attribution />
    </div>
  );
}

function ProfileScreen({
  onSaved, onBack,
}: { onSaved: () => void; onBack: () => void }) {
  const initial = useMemo(() => {
    const existing = loadProfile();
    if (existing.length) {
      return existing.map((c) => ({ id: c.id, dist: String(c.carry) }));
    }
    return DEFAULT_CLUBS.map((c) => ({ id: c.id, dist: String(c.dist) }));
  }, []);
  const [rows, setRows] = useState(initial);

  const update = (i: number, field: 'id' | 'dist', value: string) => {
    setRows((prev) =>
      prev.map((r, ix) => {
        if (ix !== i) return r;
        if (field === 'id') {
          const opt = CLUB_OPTIONS.find((o) => o.id === value);
          return { id: value, dist: value ? String(opt?.def ?? r.dist) : '' };
        }
        return { ...r, dist: value };
      }),
    );
  };

  const addRow = () => setRows((prev) => [...prev, { id: '', dist: '' }]);
  const removeRow = (i: number) =>
    setRows((prev) => prev.filter((_, ix) => ix !== i));

  const cleaned = rows
    .filter((r) => r.id && Number(r.dist) > 0)
    .map((r) => ({ id: r.id, dist: Math.round(Number(r.dist)) }));
  const canSave = cleaned.length >= 4;

  const save = () => {
    saveProfile(cleaned);
    onSaved();
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <BackButton onClick={onBack} />
      <div>
        <Eyebrow>One-time setup</Eyebrow>
        <h2 className="font-display font-extrabold text-4xl mt-2 text-foreground uppercase tracking-tight">
          Carry profile
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-3 max-w-md leading-relaxed">
          Enter the carry distance for each club in your bag (yards, at 70°F,
          no wind). This profile is shared across Player Path and is used to
          pick the four clubs for each test. Minimum four clubs.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={r.id}
              onChange={(e) => update(i, 'id', e.target.value)}
              className="flex-1 bg-surface border border-border text-foreground font-body text-sm px-3 py-2.5 focus:border-primary outline-none"
            >
              {CLUB_OPTIONS.map((o) => (
                <option key={o.id || 'empty'} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              value={r.dist}
              onChange={(e) => update(i, 'dist', e.target.value)}
              placeholder="yds"
              className="w-24 bg-surface border border-border text-foreground font-mono text-sm px-3 py-2.5 focus:border-primary outline-none"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-muted-foreground hover:text-primary transition-colors p-2"
              aria-label="Remove club"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="font-mono text-label tracking-[0.2em] uppercase text-muted-foreground hover:text-primary transition-colors self-start"
      >
        + Add club
      </button>

      <PrimaryButton onClick={save} disabled={!canSave}>
        {canSave ? 'Save profile' : 'Add at least 4 clubs'}
      </PrimaryButton>
    </div>
  );
}

function SetupScreen({
  onStart, onEditProfile, onBack,
}: {
  onStart: (cfg: {
    band: BandId;
    mode: Mode;
    orderMode: OrderMode;
    clubs: ProfileClub[];
  }) => void;
  onEditProfile: () => void;
  onBack: () => void;
}) {
  const profile = useMemo(() => loadProfile(), []);
  const [band, setBand] = useState<BandId>('mid');
  const [mode, setMode] = useState<Mode>('manual');
  const [orderMode, setOrderMode] = useState<OrderMode>('progressive');

  const autoClubs = useMemo(
    () => selectClubs(profile, BANDS[band].upper),
    [profile, band],
  );
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  // Reset overrides when band changes.
  useEffect(() => setOverrides({}), [band]);

  const resolvedClubs: ProfileClub[] | null = useMemo(() => {
    if (!autoClubs) return null;
    return autoClubs.map((c, i) => {
      const ov = overrides[i];
      if (ov) {
        const found = profile.find((p) => p.id === ov);
        if (found) return found;
      }
      return c;
    });
  }, [autoClubs, overrides, profile]);

  const bandCfg = BANDS[band];

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-7">
      <BackButton onClick={onBack} />
      <div>
        <Eyebrow>Session Setup</Eyebrow>
        <h2 className="font-display font-extrabold text-4xl mt-2 text-foreground uppercase tracking-tight">Ready?</h2>
      </div>

      {/* Test selection */}
      <div>
        <Mono className="block mb-2.5">Test</Mono>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(BANDS) as BandId[]).map((b) => {
            const cfg = BANDS[b];
            const active = band === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setBand(b)}
                className={`text-left p-3.5 transition-colors duration-150
                  ${active ? 'bg-accent border border-primary' : 'bg-surface border border-border hover:border-cement'}`}
              >
                <div className={`font-display text-base font-bold uppercase tracking-tight ${active ? 'text-primary' : 'text-foreground'}`}>
                  {cfg.label}
                </div>
                <p className="font-mono text-label tracking-[0.12em] text-muted-foreground mt-1">
                  {cfg.range[0]}–{cfg.range[1]} yd
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode toggle */}
      <div>
        <Mono className="block mb-2.5">Mode</Mono>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'manual' as const, label: 'Manual', sub: 'Finger-width sighting' },
            { id: 'radar' as const, label: 'Radar', sub: 'Launch monitor reading' },
          ]).map((o) => {
            const active = mode === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setMode(o.id)}
                className={`text-left p-3.5 transition-colors duration-150
                  ${active ? 'bg-accent border border-primary' : 'bg-surface border border-border hover:border-cement'}`}
              >
                <div className={`font-display text-base font-bold uppercase tracking-tight ${active ? 'text-primary' : 'text-foreground'}`}>
                  {o.label}
                </div>
                <p className="font-body text-label-sm text-muted-foreground mt-1">{o.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Order toggle */}
      <div>
        <Mono className="block mb-2.5">Shot order</Mono>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'progressive' as const, label: 'Progressive', sub: 'Shortest → longest, cycling' },
            { id: 'random' as const, label: 'Random', sub: 'Randomized, no repeats' },
          ]).map((o) => {
            const active = orderMode === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setOrderMode(o.id)}
                className={`text-left p-3.5 transition-colors duration-150
                  ${active ? 'bg-accent border border-primary' : 'bg-surface border border-border hover:border-cement'}`}
              >
                <div className={`font-display text-base font-bold uppercase tracking-tight ${active ? 'text-primary' : 'text-foreground'}`}>
                  {o.label}
                </div>
                <p className="font-body text-label-sm text-muted-foreground mt-1">{o.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected clubs */}
      <div>
        <Mono className="block mb-2.5">Selected clubs ({bandCfg.range[0]}–{bandCfg.range[1]} yd)</Mono>
        {!resolvedClubs ? (
          <div className="bg-surface border border-border border-l-[3px] border-l-primary p-4">
            <p className="font-body text-sm text-foreground">
              Your carry profile needs at least four clubs before this test can
              run.
            </p>
            <button
              type="button"
              onClick={onEditProfile}
              className="font-mono text-label tracking-[0.2em] uppercase text-primary hover:text-scarlet-glow transition-colors mt-3"
            >
              Set up carry profile →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {resolvedClubs.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 bg-surface border border-border p-3"
              >
                <div>
                  <Mono className="block">Club {i + 1}{i === 0 ? ' · shortest' : i === 3 ? ' · longest' : ''}</Mono>
                  <span className="font-display text-lg font-bold uppercase text-foreground">
                    {c.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground">{c.carry} yd</span>
                  <select
                    value={c.id}
                    onChange={(e) =>
                      setOverrides((p) => ({ ...p, [i]: e.target.value }))
                    }
                    className="bg-surface border border-border text-foreground font-body text-caption px-2 py-1.5 focus:border-primary outline-none"
                    aria-label={`Substitute club ${i + 1}`}
                  >
                    {profile
                      .slice()
                      .sort((a, b) => a.carry - b.carry)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.carry}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={onEditProfile}
              className="font-mono text-label tracking-[0.2em] uppercase text-muted-foreground hover:text-primary transition-colors self-start mt-1"
            >
              Edit carry profile
            </button>
          </div>
        )}
      </div>

      {/* Aiming instruction */}
      <div className="bg-accent border border-border border-l-[3px] border-l-primary p-4">
        <Mono className="text-primary block mb-2">Before you start</Mono>
        <p className="font-body text-sm text-foreground leading-relaxed">
          Identify a target line on the range for each of your four clubs, near
          the carry distance of that club. You&rsquo;ll aim at the same target
          every time you cycle back to the same club. Targets are sticky per
          club for the whole test.
        </p>
      </div>

      <PrimaryButton
        onClick={() =>
          resolvedClubs &&
          onStart({ band, mode, orderMode, clubs: resolvedClubs })
        }
        disabled={!resolvedClubs}
      >
        Start test
      </PrimaryButton>

      <Attribution />
    </div>
  );
}

function ShotScreen({
  shotNum, clubIdx, clubs, mode, onLog, onAbandon,
}: {
  shotNum: number;
  clubIdx: number;
  clubs: ProfileClub[];
  mode: Mode;
  onLog: (lateral: number, direction: Direction) => void;
  onAbandon: () => void;
}) {
  const club = clubs[clubIdx];
  const [yards, setYards] = useState('');
  const [dir, setDir] = useState<Direction | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Reset entry when the shot changes.
  useEffect(() => {
    setYards('');
    setDir(null);
    setConfirming(false);
  }, [shotNum]);

  const numYards = Math.round(Number(yards));
  const validYards = yards !== '' && !Number.isNaN(numYards) && numYards >= 0;
  const effectiveDir: Direction | null =
    validYards && numYards === 0 ? 'center' : dir;
  const canConfirm = validYards && effectiveDir !== null;

  const setFromFingers = (f: number) =>
    setYards(String(fingerYards(club.carry, f)));

  if (confirming && canConfirm) {
    return (
      <div className="max-w-xl mx-auto flex flex-col gap-7">
        <div className="flex justify-between items-center">
          <div className="w-5" />
          <div className="text-center">
            <Mono className="block">Confirm</Mono>
            <div className="font-display text-xl font-bold mt-0.5 text-foreground">
              Shot {shotNum} / 20
            </div>
          </div>
          <div className="w-5" />
        </div>

        <div className="bg-surface border border-border p-6 text-center">
          <Mono className="block mb-3">{club.name}</Mono>
          <div className="font-display text-7xl font-extrabold text-foreground leading-none">
            {numYards}
            <span className="text-2xl text-muted-foreground ml-2">YD</span>
          </div>
          <div className="font-display text-2xl font-bold uppercase italic text-primary mt-3">
            {effectiveDir}
          </div>
        </div>

        <p className="font-body text-caption text-muted-foreground text-center">
          Confirm this entry, or edit before the next shot.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton onClick={() => setConfirming(false)}>
            Edit
          </SecondaryButton>
          <PrimaryButton
            onClick={() => onLog(numYards, effectiveDir as Direction)}
          >
            {shotNum >= 20 ? 'Finish' : 'Next shot'}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-7">
      {/* Top bar */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={onAbandon}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="End test"
        >
          <X className="size-5" />
        </button>
        <div className="text-center">
          <Mono className="block">Shot</Mono>
          <div className="font-display text-xl font-bold mt-0.5 text-foreground">{shotNum} / 20</div>
        </div>
        <div className="w-5" />
      </div>

      {/* Club */}
      <div className="flex flex-col items-center justify-center py-4">
        <Mono className="block mb-3">Club to hit</Mono>
        <span className="font-display text-7xl font-extrabold uppercase leading-none text-foreground">
          {club.name}
        </span>
        <p className="font-body text-sm text-muted-foreground mt-3">
          Aim at this club&rsquo;s target line (~{club.carry} yd)
        </p>
      </div>

      {/* Helper text — manual mode */}
      {mode === 'manual' && (
        <div className="bg-surface border border-border p-4">
          <Mono className="block mb-3">Finger-width sighting</Mono>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((f) => (
              <div key={f} className="text-center">
                <div className="font-display text-2xl font-extrabold text-foreground">
                  {fingerYards(club.carry, f)}
                </div>
                <Mono className="block mt-0.5">{f} {f === 1 ? 'fngr' : 'fngrs'}</Mono>
              </div>
            ))}
          </div>
          <div className="h-px bg-border my-3" />
          <Mono className="block mb-2">Quick entry (yards)</Mono>
          <div className="flex flex-wrap gap-1.5">
            {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFromFingers(f)}
                className="px-2.5 py-1.5 bg-surface border border-border hover:border-primary text-foreground font-mono text-label transition-colors"
              >
                {f}f → {fingerYards(club.carry, f)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Entry */}
      <div>
        <Mono className="block mb-2.5">Yards offline</Mono>
        <input
          type="number"
          inputMode="numeric"
          value={yards}
          onChange={(e) => setYards(e.target.value)}
          placeholder={mode === 'radar' ? 'Lateral yards from radar' : 'Whole yards'}
          className="w-full bg-surface border border-border text-foreground font-display text-3xl font-bold px-4 py-4 focus:border-primary outline-none"
        />
      </div>

      <div>
        <Mono className="block mb-2.5">Direction</Mono>
        <div className="grid grid-cols-3 gap-2">
          {(['left', 'center', 'right'] as Direction[]).map((d) => {
            const active = effectiveDir === d;
            const forced = validYards && numYards === 0;
            return (
              <button
                key={d}
                type="button"
                disabled={forced && d !== 'center'}
                onClick={() => setDir(d)}
                className={`p-3.5 font-display text-base font-bold uppercase tracking-tight transition-colors duration-150
                  ${active
                    ? 'bg-accent border border-primary text-primary'
                    : 'bg-surface border border-border text-foreground hover:border-cement'}
                  ${forced && d !== 'center' ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {d}
              </button>
            );
          })}
        </div>
        {validYards && numYards === 0 && (
          <p className="font-body text-label-sm text-muted-foreground mt-2">
            0 yards offline is logged as center.
          </p>
        )}
      </div>

      <PrimaryButton
        onClick={() => setConfirming(true)}
        disabled={!canConfirm}
      >
        Review entry
      </PrimaryButton>
    </div>
  );
}

function ReferenceBar({ band, score }: { band: BandConfig; score: number }) {
  const scaleMax = Math.round(band.tiers[3].max * 1.3);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / scaleMax) * 100));
  const boundaries = band.tiers.slice(0, 4); // TOUR..DEVELOPING upper bounds

  return (
    <div className="bg-surface border border-border p-5">
      <Mono className="block mb-4">Where you sit</Mono>
      <div className="relative h-2 bg-pitch mt-2">
        {/* tier boundary ticks */}
        {boundaries.map((b) => (
          <div
            key={b.t}
            className="absolute -top-1 w-px h-4 bg-cement"
            style={{ left: `${pct(b.max)}%` }}
          />
        ))}
        {/* anchors */}
        {band.anchors.map((a, i) => (
          <div
            key={i}
            className="absolute -top-[3px] size-2 rounded-full bg-c1 -translate-x-1/2"
            style={{ left: `${pct(a.value)}%` }}
            title={`${a.label} · ${a.value}`}
          />
        ))}
        {/* score marker */}
        <div
          className="absolute -top-2 w-[3px] h-6 bg-primary -translate-x-1/2"
          style={{ left: `${pct(score)}%` }}
        />
      </div>
      <div className="flex justify-between mt-3">
        <Mono>Tighter</Mono>
        <Mono>Wider</Mono>
      </div>
      <div className="h-px bg-border my-3" />
      <div className="flex flex-col gap-1.5">
        {band.anchors.map((a, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="font-body text-caption text-muted-foreground">
              <span className="inline-block size-2 rounded-full bg-c1 mr-2 align-middle" />
              {a.label}
            </span>
            <span className="font-mono text-label text-foreground">{a.value}</span>
          </div>
        ))}
        <div className="flex justify-between items-center">
          <span className="font-body text-caption text-foreground">
            <span className="inline-block w-[3px] h-3 bg-primary mr-2 align-middle" />
            Your score
          </span>
          <span className="font-mono text-label text-primary">{score}</span>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  session, clubs, onContinue,
}: { session: SessionResult; clubs: ProfileClub[]; onContinue: () => void }) {
  const band = BANDS[session.test_band];
  const perClubEntries = clubs.map((c) => ({
    name: c.name,
    id: c.id,
    ...session.per_club_dispersion[c.id],
  }));
  const sortedByAvg = [...perClubEntries].sort((a, b) => a.avg - b.avg);
  const bestClub = sortedByAvg[0];
  const worstClub = sortedByAvg[sortedByAvg.length - 1];
  const missDirDominant =
    session.miss_right_count >= session.miss_left_count ? 'right' : 'left';
  const missDirCount = Math.max(
    session.miss_left_count,
    session.miss_right_count,
  );

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4">
      <Eyebrow>{band.label} · {band.range[0]}–{band.range[1]} yd</Eyebrow>

      {/* Score + tier */}
      <div className="bg-surface border border-border border-t-[3px] border-t-primary p-6 text-center">
        <Mono className="block mb-2">Score (best 18)</Mono>
        <div className="font-display text-8xl font-extrabold text-foreground leading-none">
          {session.total_score}
        </div>
        <div
          className={`inline-flex items-center gap-2 mt-4 px-4 py-1.5 border rounded-full ${tierBorder[session.tier]}`}
        >
          <span className={`font-mono text-label tracking-[0.2em] uppercase ${tierClass[session.tier]}`}>
            {session.tier}
          </span>
        </div>
        <p className="font-body text-caption text-muted-foreground mt-3 max-w-xs mx-auto">
          {TIER_DESC[session.tier]}
        </p>
        <div className="h-px bg-border my-4" />
        {session.next_tier ? (
          <p className="font-body text-sm text-foreground">
            <span className="font-display text-2xl font-bold text-primary">
              {session.points_to_next_tier}
            </span>{' '}
            points from <span className="font-bold">{session.next_tier}</span>
          </p>
        ) : (
          <p className="font-body text-sm text-sg-strong">
            Top tier — Tour standard. Keep it here.
          </p>
        )}
      </div>

      <ReferenceBar band={band} score={session.total_score} />

      {/* Dropped shots */}
      <div className="bg-surface border border-border p-4">
        <Mono className="block mb-2">Dropped shots</Mono>
        <p className="font-body text-sm text-foreground">
          Your best shot ({session.best_shot_dropped} yd) and worst shot (
          {session.worst_shot_dropped} yd) were dropped from scoring.
        </p>
      </div>

      {/* Miss direction */}
      <div className="bg-surface border border-border p-4">
        <Mono className="block mb-3">Miss direction</Mono>
        <div className="grid grid-cols-3 gap-2 text-center">
          {([
            ['Left', session.miss_left_count],
            ['Center', session.center_count],
            ['Right', session.miss_right_count],
          ] as [string, number][]).map(([label, count]) => (
            <div key={label} className="bg-shadow p-3">
              <div className="font-display text-2xl font-extrabold text-foreground">{count}</div>
              <Mono className="block mt-0.5">{label}</Mono>
            </div>
          ))}
        </div>
        {missDirCount > 0 && (
          <p className="font-body text-caption text-muted-foreground mt-3">
            You missed {missDirDominant} {missDirCount} of 20 shots.
          </p>
        )}
      </div>

      {/* Per-club breakdown */}
      <div className="bg-surface border border-border p-4">
        <Mono className="block mb-3">Per-club dispersion</Mono>
        <div className="flex flex-col gap-2">
          {perClubEntries.map((c) => {
            const isBest = c.id === bestClub.id;
            const isWorst = c.id === worstClub.id && worstClub.id !== bestClub.id;
            return (
              <div
                key={c.id}
                className={`flex justify-between items-center bg-shadow p-3 border-l-[3px]
                  ${isBest ? 'border-l-sg-strong' : isWorst ? 'border-l-sg-weak' : 'border-l-border'}`}
              >
                <div>
                  <span className="font-display text-base font-bold uppercase text-foreground">
                    {c.name}
                  </span>
                  {isBest && (
                    <span className="font-mono text-label tracking-[0.15em] uppercase text-sg-strong ml-2">
                      Most consistent
                    </span>
                  )}
                  {isWorst && (
                    <span className="font-mono text-label tracking-[0.15em] uppercase text-sg-weak ml-2">
                      Least consistent
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-bold text-foreground">
                    {c.total}<span className="text-caption text-muted-foreground ml-0.5">yd</span>
                  </div>
                  <Mono className="block mt-0.5">avg {c.avg} · max {c.max}</Mono>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="bg-surface border border-border border-l-[3px] border-l-primary p-4">
      <Mono className="text-primary block mb-2">{insight.title}</Mono>
      <p className="font-body text-caption text-foreground">{insight.finding}</p>
      {insight.prescription && (
        <>
          <div className="h-px bg-border my-2.5" />
          <Mono className="block mb-1.5">Prescription</Mono>
          <p className="font-body text-caption text-muted-foreground">{insight.prescription}</p>
        </>
      )}
    </div>
  );
}

function HistoryScreen({
  sessions, onBack,
}: { sessions: SessionResult[]; onBack: () => void }) {
  const latestBand = sessions.length
    ? sessions[sessions.length - 1].test_band
    : 'mid';
  const [band, setBand] = useState<BandId>(latestBand);

  const bandSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.test_band === band)
        .slice()
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        ),
    [sessions, band],
  );

  const trends = useMemo(() => {
    if (bandSessions.length < 3) return null;
    const scores = bandSessions.map((s) => s.total_score);
    const personalBest = Math.min(...scores);
    const last3 = scores.slice(-3);
    const rolling3 = Math.round(
      last3.reduce((a, b) => a + b, 0) / last3.length,
    );
    const crossovers: { date: string; from: TierName; to: TierName }[] = [];
    for (let i = 1; i < bandSessions.length; i++) {
      const prev = bandSessions[i - 1].tier;
      const cur = bandSessions[i].tier;
      if (prev !== cur) {
        crossovers.push({
          date: fmtDate(bandSessions[i].timestamp),
          from: prev,
          to: cur,
        });
      }
    }
    const freq: Record<string, number> = {};
    bandSessions.forEach((s) => {
      freq[s.tier] = (freq[s.tier] ?? 0) + 1;
    });
    return {
      last10: scores.slice(-10),
      personalBest,
      rolling3,
      crossovers: crossovers.slice(-4),
      freq,
    };
  }, [bandSessions]);

  const patterns = useMemo(
    () => detectPatterns(bandSessions, BANDS[band]),
    [bandSessions, band],
  );
  const crossBand = useMemo(() => crossBandDiagnosis(sessions), [sessions]);

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-5">
      <BackButton onClick={onBack} />
      <div>
        <Eyebrow>History</Eyebrow>
        <h2 className="font-display font-extrabold text-4xl mt-1 text-foreground uppercase tracking-tight">
          Sessions
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(BANDS) as BandId[]).map((b) => {
          const active = band === b;
          const count = sessions.filter((s) => s.test_band === b).length;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBand(b)}
              className={`p-3 text-left transition-colors duration-150
                ${active ? 'bg-accent border border-primary' : 'bg-surface border border-border hover:border-cement'}`}
            >
              <div className={`font-display text-sm font-bold uppercase ${active ? 'text-primary' : 'text-foreground'}`}>
                {BANDS[b].label}
              </div>
              <Mono className="block mt-0.5">{count} {count === 1 ? 'session' : 'sessions'}</Mono>
            </button>
          );
        })}
      </div>

      {bandSessions.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">
          No sessions logged in this band yet.
        </p>
      ) : (
        <>
          {/* Trends */}
          {trends ? (
            <div className="bg-surface border border-border p-4 flex flex-col gap-4">
              <Mono className="text-primary block">Trends · last 10</Mono>
              <div className="flex items-end gap-1.5 h-20">
                {trends.last10.map((sc, i) => {
                  const max = Math.max(...trends.last10);
                  const h = max ? Math.max(6, (sc / max) * 100) : 6;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1">
                      <div
                        className="w-full bg-primary"
                        style={{ height: `${h}%` }}
                        title={`${sc}`}
                      />
                      <span className="font-mono text-label text-muted-foreground">{sc}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between gap-4">
                <div>
                  <Mono className="block">Personal best</Mono>
                  <p className="font-display text-xl font-bold text-sg-strong mt-0.5">
                    {trends.personalBest}
                  </p>
                </div>
                <div>
                  <Mono className="block">Rolling 3-avg</Mono>
                  <p className="font-display text-xl font-bold text-foreground mt-0.5">
                    {trends.rolling3}
                  </p>
                </div>
                <div>
                  <Mono className="block">Tier mix</Mono>
                  <p className="font-body text-caption text-foreground mt-1">
                    {TIER_ORDER.filter((t) => trends.freq[t]).map((t) => (
                      <span key={t} className={`mr-2 ${tierClass[t]}`}>
                        {t[0]}×{trends.freq[t]}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
              {trends.crossovers.length > 0 && (
                <div>
                  <div className="h-px bg-border my-1" />
                  <Mono className="block mb-1.5">Tier crossovers</Mono>
                  {trends.crossovers.map((c, i) => (
                    <p key={i} className="font-body text-caption text-muted-foreground">
                      {c.date}: {c.from} → <span className={tierClass[c.to]}>{c.to}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="font-body text-caption text-muted-foreground">
              Log {3 - bandSessions.length} more session
              {3 - bandSessions.length === 1 ? '' : 's'} in this band to unlock
              trend analysis.
            </p>
          )}

          {/* Patterns */}
          {patterns.length > 0 && (
            <div className="flex flex-col gap-2">
              <Mono className="text-primary block">Pattern detection</Mono>
              {patterns.map((p) => (
                <InsightCard key={p.id} insight={p} />
              ))}
            </div>
          )}
          {bandSessions.length >= 3 && bandSessions.length < 5 && (
            <p className="font-body text-caption text-muted-foreground">
              Log {5 - bandSessions.length} more session
              {5 - bandSessions.length === 1 ? '' : 's'} in this band to unlock
              pattern detection.
            </p>
          )}

          {/* Cross-band */}
          {crossBand.length > 0 && (
            <div className="flex flex-col gap-2">
              <Mono className="text-primary block">Cross-band diagnosis</Mono>
              {crossBand.map((p) => (
                <InsightCard key={p.id} insight={p} />
              ))}
            </div>
          )}

          {/* Session list */}
          <div className="flex flex-col gap-1.5">
            <Mono className="block">All {BANDS[band].label} sessions</Mono>
            {[...bandSessions].reverse().map((s) => (
              <div
                key={s.session_id}
                className={`bg-surface border border-border border-l-[3px] ${tierBorder[s.tier]} p-3`}
              >
                <div className="flex justify-between items-baseline">
                  <div>
                    <Mono className={`block ${tierClass[s.tier]}`}>
                      {s.tier}
                    </Mono>
                    <p className="font-body text-caption text-muted-foreground mt-1">
                      {fmtDate(s.timestamp)} · {s.mode} · {s.order_mode}
                    </p>
                  </div>
                  <div className={`font-display text-xl font-bold ${tierClass[s.tier]}`}>
                    {s.total_score}
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

// ── Orchestrator ─────────────────────────────────────────────────────

type Screen = 'home' | 'profile' | 'setup' | 'shot' | 'result' | 'history';

interface ActiveSession {
  band: BandId;
  mode: Mode;
  orderMode: OrderMode;
  clubs: ProfileClub[];
  order: number[];
  shots: RawShot[];
}

interface LineTestProps {
  onScreenChange?: (screen: Screen) => void;
}

export default function LineTest({ onScreenChange }: LineTestProps = {}) {
  const [screen, setScreen] = useState<Screen>('home');
  const { sessions, record } = useDrillHistory<SessionResult>({
    drillType: 'line-test',
    lsKey: LS_LINE_TEST_SESSIONS,
    getId: getSessionId,
    getPlayedAt: getSessionPlayedAt,
  });
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);

  useEffect(() => {
    onScreenChange?.(screen);
  }, [screen, onScreenChange]);

  const beginFlow = () => {
    setScreen(hasProfile() ? 'setup' : 'profile');
  };

  const handleStart = (cfg: {
    band: BandId;
    mode: Mode;
    orderMode: OrderMode;
    clubs: ProfileClub[];
  }) => {
    setActive({
      ...cfg,
      order: buildOrder(cfg.orderMode),
      shots: [],
    });
    setScreen('shot');
  };

  const handleLog = (lateral: number, direction: Direction) => {
    if (!active) return;
    const idx = active.shots.length;
    const clubIdx = active.order[idx];
    const shots = [...active.shots, { clubIdx, lateral, direction }];

    if (shots.length >= 20) {
      const result = buildSession(
        BANDS[active.band],
        active.mode,
        active.orderMode,
        active.clubs,
        shots,
      );
      record(result);
      setLastResult(result);
      setActive(null);
      setScreen('result');
    } else {
      setActive({ ...active, shots });
    }
  };

  const handleAbandon = () => {
    if (
      window.confirm(
        'End test? This session will be discarded and will not be scored.',
      )
    ) {
      setActive(null);
      setScreen('home');
    }
  };

  return (
    <section className="px-6 pb-16">
      <div className="max-w-xl mx-auto">
        {screen === 'home' && (
          <HomeScreen
            onBegin={beginFlow}
            onHistory={() => setScreen('history')}
            hasSessions={sessions.length > 0}
          />
        )}

        {screen === 'profile' && (
          <ProfileScreen
            onSaved={() => setScreen('setup')}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'setup' && (
          <SetupScreen
            onStart={handleStart}
            onEditProfile={() => setScreen('profile')}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'shot' && active && (
          <ShotScreen
            shotNum={active.shots.length + 1}
            clubIdx={active.order[active.shots.length]}
            clubs={active.clubs}
            mode={active.mode}
            onLog={handleLog}
            onAbandon={handleAbandon}
          />
        )}

        {screen === 'result' && lastResult && (
          <ResultScreen
            session={lastResult}
            clubs={lastResult.clubs_used.map((id, i) => ({
              id,
              name: clubName(id),
              carry: lastResult.club_carries[i],
            }))}
            onContinue={() => setScreen('history')}
          />
        )}

        {screen === 'history' && (
          <HistoryScreen
            sessions={sessions}
            onBack={() => setScreen('home')}
          />
        )}
      </div>
    </section>
  );
}
