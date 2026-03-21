// @ts-nocheck
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  SKILLS,
  SHAPE_LABELS,
  bimodalWeight,
  sampleDisp,
  isInsideGreen,
  computeOptimalAim,
} from '@/utils/aimOptimizer';


const W = 500;
const H = 500;

function ryd(v) { return Math.round(v); }

function getPinYd(state) {
  const pf = Math.min(state.pinFront, state.gd);
  const pe = Math.min(state.pinEdge, state.gw);
  const normX = state.pinSide === 'left' ? pe / state.gw : 1 - pe / state.gw;
  return {
    x: (normX - 0.5) * state.gw,
    y: (0.5 - (1 - pf / state.gd)) * state.gd,
    normX,
  };
}

function getScale(gw, gd) {
  const m = 80;
  return Math.min((W - m * 2) / (gw + 20), (H - m * 2) / (gd + 20));
}

function yd2px(yx, yy, sc) {
  return { x: W / 2 + yx * sc, y: H / 2 - yy * sc };
}

// ── Canvas drawing ────────────────────────────────────────────
function drawGreen(canvas, state, hazards, isDark, opt) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const profile = SKILLS[state.skill];
  const sc = getScale(state.gw, state.gd);
  const sig1LatPx = state.dist * profile.latPct / 2 * sc;
  const sig1DepPx = state.dist * profile.depPct / 2 * sc;
  const rw = state.gw / 2 * sc;
  const rh = state.gd / 2 * sc;

  // Rough background
  ctx.fillStyle = isDark ? '#0e1e0e' : '#1e3e1e';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, W, H, 12);
  else ctx.rect(0, 0, W, H);
  ctx.fill();

  // Fringe
  ctx.save();
  ctx.fillStyle = isDark ? '#1a381a' : '#2e5e2e';
  ctx.strokeStyle = isDark ? '#243824' : '#3a7a3a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, rw + 10, rh + 10, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // Green surface
  ctx.save();
  ctx.fillStyle = isDark ? '#26542a' : '#3a8c3a';
  ctx.strokeStyle = isDark ? '#347034' : '#52b052';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // Mowing stripes
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, rw, rh, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const sw = sc * 3;
  for (let x = W / 2 - rw; x < W / 2 + rw; x += sw * 2) ctx.fillRect(x, H / 2 - rh, sw, rh * 2);
  ctx.restore();

  // Orientation labels
  ctx.font = '9px DM Mono,monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillText('BACK', W / 2, H / 2 - rh - 15);
  ctx.fillText('FRONT', W / 2, H / 2 + rh + 17);
  ctx.save(); ctx.translate(W / 2 - rw - 16, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('LEFT', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(W / 2 + rw + 16, H / 2); ctx.rotate(Math.PI / 2); ctx.fillText('RIGHT', 0, 0); ctx.restore();

  const pinYd = getPinYd(state);
  const pinPx = yd2px(pinYd.x, pinYd.y, sc);

  // Rulers
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pinPx.x, H / 2 + rh); ctx.lineTo(pinPx.x, pinPx.y); ctx.stroke();
  const rulerX = state.pinSide === 'left' ? W / 2 - rw : W / 2 + rw;
  ctx.beginPath(); ctx.moveTo(rulerX, pinPx.y); ctx.lineTo(pinPx.x, pinPx.y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.font = '9px DM Mono,monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  if (state.pinFront > 1) {
    ctx.textAlign = pinYd.normX > 0.5 ? 'right' : 'left';
    ctx.fillText(ryd(state.pinFront) + ' yd', pinYd.normX > 0.5 ? pinPx.x - 5 : pinPx.x + 5, (pinPx.y + H / 2 + rh) / 2 + 3);
  }
  if (state.pinEdge > 1) {
    ctx.textAlign = 'center';
    ctx.fillText(ryd(state.pinEdge) + ' yd', (rulerX + pinPx.x) / 2, pinPx.y - 6);
  }

  // ── Hazards ──
  if (hazards.has('bunker-front')) {
    ctx.fillStyle = isDark ? '#6a4a18' : '#c8a96e';
    ctx.beginPath(); ctx.ellipse(W / 2, H / 2 + rh + 13, rw * 0.28, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isDark ? '#8a6a30' : '#deb86a'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  if (hazards.has('bunker-right')) {
    const bx = pinYd.normX > 0.5 ? W / 2 + rw + 13 : W / 2 - rw - 13;
    ctx.fillStyle = isDark ? '#6a4a18' : '#c8a96e';
    ctx.beginPath(); ctx.ellipse(bx, H / 2, 11, rh * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isDark ? '#8a6a30' : '#deb86a'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  if (hazards.has('water-front')) {
    const wy = H / 2 + rh + 14;
    ctx.fillStyle = isDark ? '#1a3a6a' : '#2780ba';
    ctx.beginPath(); ctx.ellipse(W / 2, wy, rw * 0.55, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isDark ? '#2060a0' : '#5aaee0'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.75;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(W / 2 + i * 12, wy, rw * 0.17, 5, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.font = '8px DM Mono,monospace'; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'center';
    ctx.fillText('water', W / 2, wy + 3);
  }
  if (hazards.has('water-right')) {
    const wx = pinYd.normX > 0.5 ? W / 2 + rw + 14 : W / 2 - rw - 14;
    ctx.fillStyle = isDark ? '#1a3a6a' : '#2780ba';
    ctx.beginPath(); ctx.ellipse(wx, H / 2, 13, rh * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isDark ? '#2060a0' : '#5aaee0'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.75;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(wx, H / 2 + i * 10, 8, rh * 0.1, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.font = '8px DM Mono,monospace'; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'center';
    ctx.fillText('water', wx, H / 2 + 3);
  }

  if (!opt) return;

  const missOffset = -state.sliderBias;
  const aimPx = yd2px(opt.ax, opt.ay, sc);
  const missCenterPx = yd2px(opt.ax + missOffset, opt.ay, sc);
  const tiltRad = state.tiltDeg * Math.PI / 180;

  // Dispersion ellipse at miss center
  ctx.save();
  ctx.translate(missCenterPx.x, missCenterPx.y);
  ctx.rotate(+tiltRad);
  // 2σ fill + stroke
  ctx.beginPath(); ctx.ellipse(0, 0, sig1LatPx * 2, sig1DepPx * 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(232,32,42,0.09)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,61,71,0.65)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
  // 1σ
  ctx.beginPath(); ctx.ellipse(0, 0, sig1LatPx, sig1DepPx, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,61,71,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
  // Bimodal lobes
  const bw = bimodalWeight(state.dist);
  if (bw > 0.05) {
    ctx.globalAlpha = bw;
    ctx.fillStyle = 'rgba(232,32,42,0.07)';
    ctx.beginPath(); ctx.ellipse(-sig1LatPx * 0.55, 0, sig1LatPx * 0.6, sig1DepPx * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sig1LatPx * 0.55, 0, sig1LatPx * 0.6, sig1DepPx * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Bias line + miss center
  if (Math.abs(missOffset) > 0.3) {
    ctx.beginPath(); ctx.moveTo(aimPx.x, aimPx.y); ctx.lineTo(missCenterPx.x, missCenterPx.y);
    ctx.strokeStyle = 'rgba(245,149,32,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(245,149,32,0.88)'; ctx.beginPath(); ctx.arc(missCenterPx.x, missCenterPx.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '9px DM Mono,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(245,149,32,0.9)';
    ctx.fillText('miss center', missCenterPx.x, missCenterPx.y + (missOffset > 0 ? 15 : -11));
  }

  // Aim → flag dashed
  ctx.beginPath(); ctx.moveTo(aimPx.x, aimPx.y); ctx.lineTo(pinPx.x, pinPx.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);

  // Flagstick
  ctx.beginPath(); ctx.moveTo(pinPx.x, pinPx.y + 5); ctx.lineTo(pinPx.x, pinPx.y - 18);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#e84a2e';
  ctx.beginPath(); ctx.moveTo(pinPx.x, pinPx.y - 18); ctx.lineTo(pinPx.x + 11, pinPx.y - 13); ctx.lineTo(pinPx.x, pinPx.y - 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(pinPx.x, pinPx.y, 3.5, 0, Math.PI * 2); ctx.fill();

  // Aim point (Scarlet)
  ctx.fillStyle = '#E8202A'; ctx.beginPath(); ctx.arc(aimPx.x, aimPx.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(aimPx.x, aimPx.y, 3.5, 0, Math.PI * 2); ctx.fill();

  // Labels
  ctx.font = '500 10px DM Mono,monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText('AIM', aimPx.x, aimPx.y - 14);
  ctx.fillStyle = '#e8a22e'; ctx.fillText('FLAG', pinPx.x + (pinYd.normX > 0.65 ? -24 : 20), pinPx.y - 21);
  ctx.font = '9px DM Mono,monospace'; ctx.fillStyle = 'rgba(255,61,71,0.55)'; ctx.textAlign = 'left';
  ctx.fillText('2σ', missCenterPx.x + sig1LatPx * 2 + 4, missCenterPx.y + 3);
  ctx.fillText('1σ', missCenterPx.x + sig1LatPx + 4, missCenterPx.y + 3);
}

// ── Component ─────────────────────────────────────────────────
export default function ApproachAimOptimizer() {
  const canvasRef = useRef(null);

  const [skill, setSkillState] = useState('elite');
  const [dist, setDist] = useState(100);
  const [tiltDeg, setTiltDeg] = useState(20);
  const [gw, setGw] = useState(30);
  const [gd, setGd] = useState(25);
  const [pinFront, setPinFront] = useState(12);
  const [pinEdge, setPinEdge] = useState(8);
  const [pinSide, setPinSide] = useState('left');
  const [sliderBias, setSliderBias] = useState(0);
  const [hazards, setHazards] = useState(() => new Set(['bunker-front']));
  const [isDark, setIsDark] = useState(true);
  const [stats, setStats] = useState(null);

  // Track theme changes via MutationObserver
  useEffect(() => {
    function checkTheme() {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    }
    checkTheme();
    const obs = new MutationObserver(checkTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const state = { skill, dist, tiltDeg, gw, gd, pinFront, pinEdge, pinSide, sliderBias };

  // Recompute + redraw whenever anything changes
  useEffect(() => {
    const opt = computeOptimalAim(state, hazards, 1500);
    setStats(opt);
    const canvas = canvasRef.current;
    if (canvas) drawGreen(canvas, state, hazards, isDark, opt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, dist, tiltDeg, gw, gd, pinFront, pinEdge, pinSide, sliderBias, hazards, isDark]);

  function toggleHazard(key) {
    setHazards(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const profile = SKILLS[skill];
  const bw = bimodalWeight(dist);

  // Pin position validation
  const pinFrontWarn = pinFront > gd;
  const pinEdgeWarn = pinEdge > gw;

  // Aim offset label
  function aimLabel() {
    if (!stats) return '—';
    const pinYd = getPinYd(state);
    const dx = stats.ax - pinYd.x;
    const dy = stats.ay - pinYd.y;
    const latYds = Math.abs(dx);
    const depYds = Math.abs(dy);
    const thr = 0.5;
    if (latYds < thr && depYds < thr) return 'on flag';
    const parts = [];
    if (latYds >= thr) parts.push(`${ryd(latYds)} yd ${dx < 0 ? 'left' : 'right'}`);
    if (depYds >= thr) parts.push(`${ryd(depYds)} yd ${dy > 0 ? 'back' : 'front'}`);
    return parts.join(' · ');
  }

  return (
    <div className="aao-wrap">
      {/* Skill bar */}
      <div className="aao-skill-bar">
        {[
          { id: 'pga',   label: 'PGA Pro',        badge: '7% lat · 4% dep' },
          { id: 'elite', label: 'Elite Am',        badge: '10% lat · 6% dep' },
          { id: 'comp',  label: 'Competitive Am',  badge: '14% lat · 9% dep' },
        ].map(s => (
          <button
            key={s.id}
            className={`aao-skill-btn${skill === s.id ? ' is-active' : ''}`}
            onClick={() => setSkillState(s.id)}
          >
            {s.label}
            <span className="aao-skill-badge">{s.badge}</span>
          </button>
        ))}
      </div>

      {/* Dispersion strip */}
      <div className="aao-disp-strip">
        <div className="aao-disp-pill">
          <div className="aao-disp-val">±{ryd(dist * profile.latPct / 2)} yd</div>
          <div className="aao-disp-lbl">Lateral 2σ</div>
        </div>
        <div className="aao-disp-pill">
          <div className="aao-disp-val">±{ryd(dist * profile.depPct / 2)} yd</div>
          <div className="aao-disp-lbl">Depth 2σ</div>
        </div>
        <div className="aao-disp-pill">
          <div className="aao-disp-val">{tiltDeg}°</div>
          <div className="aao-disp-lbl">Tilt</div>
        </div>
        <div className="aao-disp-pill">
          <div className="aao-disp-val">{Math.round(bw * 100)}%</div>
          <div className="aao-disp-lbl">Bimodal</div>
        </div>
      </div>

      {/* Main layout */}
      <div className="aao-layout">
        {/* Controls */}
        <div className="aao-controls">

          {/* Shot distance */}
          <div className="aao-ctrl-group">
            <div className="aao-ctrl-label">Shot Distance</div>
            <div className="aao-slider-row">
              <span className="aao-ctrl-name">Distance</span>
              <input
                type="range" min={60} max={220} step={1} value={dist}
                onChange={e => setDist(+e.target.value)}
                className="aao-slider"
              />
              <span className="aao-ctrl-val">{dist} yd</span>
            </div>
          </div>

          {/* Dispersion tilt */}
          <div className="aao-ctrl-group">
            <div className="aao-ctrl-label">Dispersion Tilt</div>
            <div className="aao-slider-row">
              <span className="aao-ctrl-name">Rotation</span>
              <input
                type="range" min={-40} max={40} step={1} value={tiltDeg}
                onChange={e => setTiltDeg(+e.target.value)}
                className="aao-slider"
              />
              <span className="aao-ctrl-val">{tiltDeg}°</span>
            </div>
            <p className="aao-hint">RH fade/draw: +20° · LH: use negative</p>
          </div>

          {/* Green dimensions */}
          <div className="aao-ctrl-group">
            <div className="aao-ctrl-label">Green Dimensions</div>
            <div className="aao-num-row">
              <span className="aao-num-label">Width</span>
              <div className="aao-num-wrap">
                <input className="wyc-input aao-num-input" type="number" min={10} max={60} value={gw}
                  onChange={e => setGw(Math.max(10, Math.min(60, +e.target.value || 10)))} />
                <span className="aao-unit">yd</span>
              </div>
            </div>
            <div className="aao-num-row">
              <span className="aao-num-label">Depth</span>
              <div className="aao-num-wrap">
                <input className="wyc-input aao-num-input" type="number" min={10} max={60} value={gd}
                  onChange={e => setGd(Math.max(10, Math.min(60, +e.target.value || 10)))} />
                <span className="aao-unit">yd</span>
              </div>
            </div>
          </div>

          {/* Hazards */}
          <div className="aao-ctrl-group">
            <div className="aao-ctrl-label">Hazards</div>
            <p className="aao-hint" style={{ marginBottom: 8 }}>Tap to toggle on/off</p>
            <div className="aao-hazard-grid">
              {[
                { key: 'bunker-front', icon: '⛳', label: 'Bunker', sub: 'front',    type: 'bunker' },
                { key: 'bunker-right', icon: '⛳', label: 'Bunker', sub: 'pin side', type: 'bunker' },
                { key: 'water-front',  icon: '💧', label: 'Water',  sub: 'front (+1)', type: 'water' },
                { key: 'water-right',  icon: '💧', label: 'Water',  sub: 'pin side (+1)', type: 'water' },
              ].map(h => (
                <button
                  key={h.key}
                  className={`aao-haz-btn${hazards.has(h.key) ? ` is-${h.type}` : ''}`}
                  onClick={() => toggleHazard(h.key)}
                >
                  {h.icon} {h.label}<br />
                  <span className="aao-haz-sub">{h.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pin position */}
          <div className="aao-ctrl-group">
            <div className="aao-ctrl-label">Pin Position</div>
            <div className="aao-num-row">
              <span className="aao-num-label">From front</span>
              <div className="aao-num-wrap">
                <input className={`wyc-input aao-num-input${pinFrontWarn ? ' aao-input-warn' : ''}`} type="number" min={0} max={60} value={pinFront}
                  onChange={e => setPinFront(Math.max(0, +e.target.value || 0))} />
                <span className="aao-unit">yd</span>
              </div>
            </div>
            {pinFrontWarn && <p className="aao-warn">⚠ exceeds green depth</p>}
            <p className="aao-hint">0 = front edge</p>
            <div className="aao-num-row">
              <span className="aao-num-label">From edge</span>
              <div className="aao-num-wrap">
                <input className={`wyc-input aao-num-input${pinEdgeWarn ? ' aao-input-warn' : ''}`} type="number" min={0} max={60} value={pinEdge}
                  onChange={e => setPinEdge(Math.max(0, +e.target.value || 0))} />
                <span className="aao-unit">yd</span>
              </div>
            </div>
            {pinEdgeWarn && <p className="aao-warn">⚠ exceeds green width</p>}
            <p className="aao-hint">distance from left or right edge</p>
            <div className="aao-side-toggle">
              <button className={`aao-side-btn${pinSide === 'left' ? ' is-active' : ''}`} onClick={() => setPinSide('left')}>◀ left</button>
              <button className={`aao-side-btn${pinSide === 'right' ? ' is-active' : ''}`} onClick={() => setPinSide('right')}>right ▶</button>
            </div>
            <p className="aao-hint" style={{ marginTop: 6, marginBottom: 0 }}>
              Pin: {ryd(pinFront)} yd from front · {ryd(pinEdge)} yd from {pinSide} edge
            </p>
          </div>

          {/* Shot shape */}
          <div className="aao-ctrl-group">
            <div className="aao-ctrl-label">Shot Shape</div>
            <div className="aao-shape-toggle">
              {[
                { v: -4, label: 'Big\nFade' },
                { v: -2, label: 'Fade' },
                { v:  0, label: 'Straight' },
                { v:  2, label: 'Draw' },
                { v:  4, label: 'Big\nDraw' },
              ].map(s => (
                <button
                  key={s.v}
                  className={`aao-shape-btn${sliderBias === s.v ? ' is-active' : ''}`}
                  onClick={() => setSliderBias(s.v)}
                >
                  {s.label.split('\n').map((line, i) => <span key={i} style={i > 0 ? { display: 'block' } : {}}>{line}</span>)}
                </button>
              ))}
            </div>
            <p className="aao-shape-hint">{SHAPE_LABELS[String(sliderBias)]}</p>
          </div>
        </div>

        {/* Canvas */}
        <div className="aao-canvas-wrap">
          <canvas ref={canvasRef} width={W} height={H} className="aao-canvas" />
        </div>
      </div>

      {/* Stats */}
      <div className="aao-stats">
        <div className="aao-stat">
          <div className="aao-stat-val" style={{ color: 'var(--under)' }}>{stats ? Math.round(stats.gir * 100) + '%' : '—'}</div>
          <div className="aao-stat-lbl">GIR Probability</div>
        </div>
        <div className="aao-stat">
          <div className="aao-stat-val" style={{ color: 'var(--c1)' }}>{stats ? Math.round(stats.inside15 * 100) + '%' : '—'}</div>
          <div className="aao-stat-lbl">Inside 15 ft</div>
        </div>
        <div className="aao-stat">
          <div className="aao-stat-val">{stats ? Math.round(stats.proximity * 3) + ' ft' : '—'}</div>
          <div className="aao-stat-lbl">Expected Prox</div>
        </div>
        <div className="aao-stat">
          <div className="aao-stat-val" style={{ color: 'var(--bogey)', fontSize: 13 }}>{aimLabel()}</div>
          <div className="aao-stat-lbl">Aim Offset</div>
        </div>
      </div>

      {/* Legend */}
      <div className="aao-legend">
        <div className="aao-leg-item"><span className="aao-leg-dot" style={{ background: '#e84a2e' }} />Flag</div>
        <div className="aao-leg-item"><span className="aao-leg-dot" style={{ background: '#E8202A' }} />Optimal aim</div>
        <div className="aao-leg-item"><span className="aao-leg-dot" style={{ background: 'rgba(245,149,32,0.85)' }} />Miss center</div>
        <div className="aao-leg-item"><span className="aao-leg-dot" style={{ background: '#c8a96e', borderRadius: 2 }} />Bunker</div>
        <div className="aao-leg-item"><span className="aao-leg-dot" style={{ background: '#2780ba', borderRadius: 2 }} />Water (+1)</div>
      </div>

      <p className="aao-footer">Broadie strokes-gained · Pelz bimodal (fades at 125–150 yd) · 2σ rotated ellipse</p>
    </div>
  );
}
