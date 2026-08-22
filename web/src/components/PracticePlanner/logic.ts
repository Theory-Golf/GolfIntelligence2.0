import { activityById, isBuilt } from '@/data/practiceActivities';
import {
  WEDGE_DISTANCE_POOL,
  todayISO,
  uid,
} from './defaults';
import type {
  Block,
  Checkpoint,
  Direction,
  HistoryEntry,
  PracticeGate,
  Session,
  SessionRecord,
  StatusKey,
  WedgeShot,
  WeekConfig,
} from './types';

export const STATUS: Record<StatusKey, { key: StatusKey; label: string; desc: string }> = {
  new: { key: 'new', label: 'New', desc: 'No data yet' },
  building: { key: 'building', label: 'Building', desc: '0–2 of 5 — keep working' },
  acquiring: { key: 'acquiring', label: 'Acquiring', desc: '3 of 5 — closing in' },
  stable: { key: 'stable', label: 'Stable', desc: '4/5 across 2 sessions — earned a transfer test' },
  mastered: {
    key: 'mastered',
    label: 'Mastered',
    desc: '5/5 across 2 sessions — move to maintenance cadence',
  },
};

export function getElementStatus(history: HistoryEntry[], elementId: string): StatusKey {
  const tech = history.filter((h) => h.elementId === elementId && h.kind === 'technical');
  if (tech.length === 0) return 'new';
  const latest = tech[tech.length - 1];
  const prev = tech.length >= 2 ? tech[tech.length - 2] : null;
  const ls = latest.score ?? 0;
  const ps = prev?.score ?? 0;
  if (ls === 5 && prev && ps === 5) return 'mastered';
  if (ls >= 4 && prev && ps >= 4) return 'stable';
  if (ls >= 3) return 'acquiring';
  return 'building';
}

export function getMesocycleWeek(weekConfig: WeekConfig | null): number {
  if (!weekConfig) return 1;
  const startISO = weekConfig.startDate || weekConfig.date || todayISO();
  const startDate = new Date(startISO + 'T12:00:00');
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(6, Math.max(1, Math.floor(diffDays / 7) + 1));
}

export type Phase = {
  phase: string;
  desc: string;
  mode: 'technical' | 'mixed' | 'transfer';
};

export function getMesocyclePhase(week: number): Phase {
  if (week <= 2) return { phase: 'Technical', desc: 'Pattern building, full feedback', mode: 'technical' };
  if (week <= 4)
    return {
      phase: 'Technical / Transfer',
      desc: 'Test patterns under light constraints',
      mode: 'mixed',
    };
  return {
    phase: 'Transfer / Execution',
    desc: 'Course-like conditions, minimal feedback',
    mode: 'transfer',
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateWedgeDistances(numShots: number, seedStr: string): number[] {
  const pool = WEDGE_DISTANCE_POOL.slice();
  const result: number[] = [];
  let rng = hashCode(seedStr) || Date.now();
  const next = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (let i = 0; i < numShots; i++) {
    let pick = pool[i % pool.length];
    if (result.length > 0 && result[result.length - 1] === pick) {
      pick = pool[(i + 1) % pool.length];
    }
    result.push(pick);
  }
  return result;
}

/** Shots reserved per assessment block. */
const ASSESSMENT_SHOTS = 10;

/**
 * Which assessment games a session should include, given the mesocycle phase.
 *
 * Only ever returns activities with a built tool — a block pointing at an
 * in-development game would be a dead end mid-session. Ordered by leverage:
 * approach first (the highest-leverage pillar), then whatever else the
 * session is already touching.
 */
function pickAssessments(
  mode: Phase['mode'],
  opts: { hasDriver: boolean; hasIrons: boolean },
): string[] {
  if (mode === 'technical') return []; // weeks 1–2: pattern building only

  const candidates: string[] = [];
  if (opts.hasIrons) candidates.push('approach-standard');
  candidates.push('wedge-standard'); // wedges are in every session
  if (opts.hasDriver) candidates.push('driver-standard');
  if (opts.hasIrons) candidates.push('line-test');

  const built = candidates.filter((id) => isBuilt(id));
  // Weeks 3–4 test one thing; weeks 5–6 test two.
  return built.slice(0, mode === 'mixed' ? 1 : 2);
}

export function buildSessionBlocks(
  weekConfig: WeekConfig,
  shotBudget: number,
  includeDriver: 'auto' | 'yes' | 'no',
  ironFocusId: string,
): Block[] {
  const week = getMesocycleWeek(weekConfig);
  const phase = getMesocyclePhase(week);

  const blocks: Block[] = [];
  let remaining = shotBudget;

  const warmupShots = shotBudget < 75 ? 6 : 10;
  blocks.push({
    id: 'warmup',
    name: 'Warm-Up',
    type: 'warmup',
    shots: warmupShots,
    instructions:
      'Easy half swings, gradually building. No technical focus, no targets. Just move and feel.',
    completed: false,
  });
  remaining -= warmupShots;

  const wedgeWarmupShots = 5;
  blocks.push({
    id: 'wedges_warmup',
    name: 'Wedge Activation',
    type: 'wedge-distance',
    subtype: 'warmup',
    shots: wedgeWarmupShots,
    instructions:
      'Five shots to switch into testing mindset. Use any wedge — the tool will prompt a target distance for each shot. Log ball speed and judge direction (Left / On Target / Right). On-target = within 2–3 yards left or right of the line.',
    distanceTest: { mode: 'prompted', shots: [] },
    completed: false,
  });
  remaining -= wedgeWarmupShots;

  const driverElements = weekConfig.driverElements || [];
  const hasDriverElement = driverElements.length > 0 && !!driverElements[0].name;
  const wantDriver =
    includeDriver === 'yes' || (includeDriver === 'auto' && shotBudget >= 75);
  let driverShots = 0;
  if (wantDriver && hasDriverElement) {
    driverShots = shotBudget < 75 ? 5 : 10;
  }

  const wedgeEndShots = 10;
  remaining -= wedgeEndShots;
  remaining -= driverShots;
  const cooldownShots = 5;
  remaining -= cooldownShots;

  // Assessment work scales with the mesocycle: none while the pattern is
  // still being built, one test once it's transferring, two once the point
  // of the block is execution under pressure. Shots come out of the iron
  // allocation so the budget still balances.
  const assessments = pickAssessments(phase.mode, {
    hasDriver: driverShots > 0,
    hasIrons: weekConfig.ironElements.some((e) => e.name),
  });
  const assessmentShots = assessments.length * ASSESSMENT_SHOTS;
  remaining -= assessmentShots;

  const ironShots = Math.max(20, remaining);

  let elementsToWork = weekConfig.ironElements.filter((e) => e.name);
  if (ironFocusId && ironFocusId !== 'all') {
    elementsToWork = elementsToWork.filter((e) => e.id === ironFocusId);
  }
  if (elementsToWork.length === 0 && weekConfig.ironElements.length > 0) {
    elementsToWork = weekConfig.ironElements;
  }

  const numElements = Math.max(1, elementsToWork.length);
  const shotsPerElement = Math.floor(ironShots / numElements);
  const checkpointsPerElement =
    phase.mode === 'technical'
      ? shotsPerElement >= 18
        ? 3
        : shotsPerElement >= 12
        ? 2
        : 1
      : shotsPerElement >= 15
      ? 2
      : 1;

  elementsToWork.forEach((el, idx) => {
    const checkpoints: Checkpoint[] = [];
    for (let i = 0; i < checkpointsPerElement; i++) {
      checkpoints.push({
        id: `cp_${el.id}_${i}_${Date.now()}_${idx}`,
        elementId: el.id,
        swings: [null, null, null, null, null],
      });
    }
    const practiceGates: PracticeGate[] = [];
    for (let i = 0; i < checkpointsPerElement - 1; i++) {
      practiceGates.push({
        id: `gate_${el.id}_${i}_${Date.now()}_${idx}`,
        afterCheckpointIdx: i,
        intent: null,
      });
    }
    blocks.push({
      id: `iron_${el.id}`,
      name: `Irons · ${el.name || `Element ${idx + 1}`}`,
      type: 'iron-technical',
      elementId: el.id,
      elementName: el.name,
      cue: el.cue,
      shots: shotsPerElement,
      checkpoints,
      practiceGates,
      practiceCount: shotsPerElement - checkpointsPerElement * 5,
      instructions:
        phase.mode === 'technical'
          ? `${checkpointsPerElement} checkpoint set${
              checkpointsPerElement > 1 ? 's' : ''
            } of 5 swings, with practice swings between. Review video on every swing during checkpoints. Self-score each swing as did/didn’t achieve the change.`
          : `Mix of technical reps and target-based shots. Use ${checkpointsPerElement} checkpoint set${
              checkpointsPerElement > 1 ? 's' : ''
            } to verify the pattern, then hit shots to varied iron targets.`,
      completed: false,
    });
  });

  blocks.push({
    id: 'wedges',
    name: 'Distance Wedges',
    type: 'wedge-distance',
    subtype: 'end',
    shots: wedgeEndShots,
    instructions:
      'Ten shots, prompted distances. Log ball speed and direction (Left / On Target / Right). Watch tracer for actual flight — over time, the system will surface trends in distance bands.',
    distanceTest: { mode: 'prompted', shots: [] },
    completed: false,
  });

  if (driverShots > 0) {
    const d = driverElements[0];
    blocks.push({
      id: 'driver',
      name: `Driver · ${d.name || 'Pattern Work'}`,
      type: 'driver',
      shots: driverShots,
      cue: d.cue || '',
      elementName: d.name,
      elementId: d.id,
      instructions:
        'Half technical, half outcome. First half: focus on the technical cue, no concern for ball flight. Second half: pick a target and try to start it on line with reasonable dispersion (~60y wide window).',
      checkpoints: [
        {
          id: `cp_driver_${Date.now()}`,
          elementId: d.id,
          swings: [null, null, null, null, null],
        },
      ],
      completed: false,
    });
  }

  // Assessments sit after the technical work and before the cool-down: the
  // pattern has been rehearsed, and now it gets tested cold.
  assessments.forEach((activityId) => {
    const activity = activityById(activityId);
    blocks.push({
      id: `assessment_${activityId}`,
      name: `Test · ${activity?.name ?? activityId}`,
      type: 'assessment',
      activityId,
      shots: ASSESSMENT_SHOTS,
      instructions:
        activity?.description ??
        'Run the assessment and log your result. The game scores itself and keeps its own history.',
      completed: false,
    });
  });

  blocks.push({
    id: 'cooldown',
    name: 'Cool-Down',
    type: 'cooldown',
    shots: cooldownShots,
    instructions: 'Free swings. No focus, no analysis. Clear the deck.',
    completed: false,
  });

  return blocks;
}

export type Recommendation = {
  tone: 'caution' | 'info' | 'positive';
  title: string;
  message: string;
};

export function getCheckpointRecommendation(
  history: HistoryEntry[],
  elementId: string,
  currentScore: number,
): Recommendation | null {
  if (currentScore <= 1) {
    return {
      tone: 'caution',
      title: 'Reduce Difficulty',
      message:
        'Task is too hard at full speed. Reduce swing speed to 50–70% or shorten the swing length until you can hit 3+ of 5. The technical change must come first; speed and length come back later.',
    };
  }
  if (currentScore === 2) {
    return {
      tone: 'caution',
      title: 'Reinforce The Pattern',
      message:
        'Borderline. Stay at current speed but add 2–3 exaggerated reps before the next checkpoint set — overdo the change so the new pattern is unmistakable.',
    };
  }
  if (currentScore >= 4) {
    const recent = history
      .filter((h) => h.elementId === elementId && h.kind === 'technical')
      .slice(-3);
    const strongCount = recent.filter((h) => (h.score ?? 0) >= 4).length;
    if (recent.length >= 3 && strongCount >= 3) {
      return {
        tone: 'positive',
        title: 'Add Light Interference',
        message:
          'Three+ checkpoints at 4/5 or better. The pattern is holding. Consider adding solid contact as a secondary success criterion on your next set — both the technical change AND clean contact must be present to count as a success.',
      };
    }
  }
  return null;
}

export function stddev(arr: number[]): number | null {
  if (arr.length < 2) return null;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

// Date formatting lives in lib/playerpath/format — re-exported so the
// planner's existing call sites keep working.
export { fmtDate, fmtDateShort } from '@/lib/playerpath/format';

export function newCheckpointId(): string {
  return uid('cp');
}

export function isSessionEmpty(s: Session | null): boolean {
  return !s || s.blocks.length === 0;
}

/* ================================================================
   Session mutations — pure. Each returns the next session plus the
   history entries the change earned, so the caller can commit both
   in one go instead of nesting one state update inside another.
   ================================================================ */

export type SessionMutation = { session: Session; entries: HistoryEntry[] };

/** Log a checkpoint set: freeze its score and write it to history. */
export function logCheckpoint(session: Session, blockId: string, cpId: string): SessionMutation {
  const entries: HistoryEntry[] = [];
  const blocks = session.blocks.map((b) => {
    if (b.id !== blockId || !b.checkpoints) return b;
    const checkpoints = b.checkpoints.map((cp) => {
      if (cp.id !== cpId || cp.logged) return cp;
      const score = countSuccesses(cp);
      entries.push({
        date: session.date,
        timestamp: new Date().toISOString(),
        elementId: cp.elementId,
        elementName: b.elementName || b.name,
        score,
        total: 5,
        kind: 'technical',
        blockType: b.type,
      });
      return { ...cp, logged: true, score };
    });
    const completed = checkpoints.every((c) => c.logged) ? true : b.completed;
    return { ...b, checkpoints, completed };
  });
  return { session: { ...session, blocks }, entries };
}

/** Record the wedge shot in progress; auto-completes the block on the last shot. */
export function recordWedgeShot(session: Session, blockId: string): SessionMutation {
  let entries: HistoryEntry[] = [];
  const blocks = session.blocks.map((b) => {
    if (b.id !== blockId || !b.distanceTest) return b;
    const cs = b.distanceTest.currentShot ?? { ballSpeed: '', direction: null as Direction };
    const distances = b.distanceTest.distances ?? [];
    const recordedCount = b.distanceTest.shots.filter((s) => s.recorded).length;
    const shots: WedgeShot[] = [
      ...b.distanceTest.shots,
      {
        target: distances[recordedCount] ?? 0,
        ballSpeed: cs.ballSpeed || '',
        direction: cs.direction ?? null,
        recorded: true,
        timestamp: new Date().toISOString(),
      },
    ];
    const distanceTest = {
      ...b.distanceTest,
      shots,
      currentShot: { ballSpeed: '', direction: null as Direction },
    };
    if (shots.filter((s) => s.recorded).length >= b.shots) {
      entries = buildWedgeHistory(b, shots, session.date);
      return { ...b, distanceTest, completed: true };
    }
    return { ...b, distanceTest };
  });
  return { session: { ...session, blocks }, entries };
}

/** Complete a wedge block early, keeping whatever shots were recorded. */
export function completeWedgeBlock(session: Session, blockId: string): SessionMutation {
  let entries: HistoryEntry[] = [];
  const blocks = session.blocks.map((b) => {
    if (b.id !== blockId || b.completed || !b.distanceTest) return b;
    entries = buildWedgeHistory(b, b.distanceTest.shots, session.date);
    return { ...b, completed: true };
  });
  return { session: { ...session, blocks }, entries };
}

/** Per-shot entries plus a block summary for a wedge distance test. */
export function buildWedgeHistory(
  block: Block,
  shots: WedgeShot[],
  date: string,
): HistoryEntry[] {
  const valid = shots.filter((s) => s.recorded && s.ballSpeed);
  if (valid.length === 0) return [];
  const ballSpeeds = valid
    .map((s) => parseFloat(s.ballSpeed))
    .filter((n) => !isNaN(n));
  const avg = ballSpeeds.length
    ? ballSpeeds.reduce((a, b) => a + b, 0) / ballSpeeds.length
    : null;
  const entries: HistoryEntry[] = valid.map((s) => ({
    date,
    timestamp: s.timestamp,
    elementId: 'wedge_distance',
    elementName: 'Distance Wedges',
    kind: 'wedge_shot',
    blockType: block.type,
    blockSubtype: block.subtype,
    target: s.target,
    ballSpeed: parseFloat(s.ballSpeed) || null,
    direction: s.direction,
  }));
  entries.push({
    date,
    timestamp: new Date().toISOString(),
    elementId: 'wedge_distance',
    elementName: 'Distance Wedges',
    kind: 'distance',
    blockType: 'wedge-distance',
    blockSubtype: block.subtype,
    score: valid.length,
    total: block.shots,
    avgBallSpeed: avg,
  });
  return entries;
}

/**
 * Close out a session: build the record that gets saved, and flush any work
 * the player did but never logged — part-finished checkpoint sets and wedge
 * blocks left short of their shot count. Without this, that work is lost the
 * moment the session ends.
 */
export function summarizeSession(
  session: Session,
  weekConfig: WeekConfig | null,
): { record: SessionRecord; flushEntries: HistoryEntry[] } {
  const week = getMesocycleWeek(weekConfig);
  const phase = getMesocyclePhase(week);
  const flushEntries: HistoryEntry[] = [];
  const checkpoints: SessionRecord['checkpoints'] = [];
  const wedgeSpeeds: number[] = [];
  let wedgeShots = 0;

  session.blocks.forEach((b) => {
    b.checkpoints?.forEach((cp) => {
      const attempted = cp.logged || cp.swings.some((s) => s !== null);
      if (!attempted) return;
      const score = cp.logged ? cp.score ?? 0 : countSuccesses(cp);
      checkpoints.push({
        elementId: cp.elementId,
        elementName: b.elementName || b.name,
        score,
        total: 5,
      });
      if (!cp.logged) {
        flushEntries.push({
          date: session.date,
          timestamp: new Date().toISOString(),
          elementId: cp.elementId,
          elementName: b.elementName || b.name,
          score,
          total: 5,
          kind: 'technical',
          blockType: b.type,
        });
      }
    });

    if (b.distanceTest) {
      const recorded = b.distanceTest.shots.filter((s) => s.recorded);
      wedgeShots += recorded.length;
      recorded.forEach((s) => {
        const n = parseFloat(s.ballSpeed);
        if (!isNaN(n)) wedgeSpeeds.push(n);
      });
      // Completed blocks already wrote their entries when they completed
      if (!b.completed) {
        flushEntries.push(...buildWedgeHistory(b, b.distanceTest.shots, session.date));
      }
    }
  });

  const record: SessionRecord = {
    id: uid('sess'),
    date: session.date,
    completedAt: new Date().toISOString(),
    week,
    phase: phase.phase,
    phaseDesc: phase.desc,
    shotBudget: session.shotBudget,
    plannedShots: session.blocks.reduce((sum, b) => sum + b.shots, 0),
    blocksCompleted: session.blocks.filter((b) => b.completed).length,
    blocksTotal: session.blocks.length,
    blocks: session.blocks.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      shots: b.shots,
      completed: b.completed,
    })),
    checkpoints,
    wedgeShots,
    avgBallSpeed: wedgeSpeeds.length
      ? wedgeSpeeds.reduce((a, b) => a + b, 0) / wedgeSpeeds.length
      : null,
    // Which assessments the session sent the player to, and whether they came
    // back and marked them done. Never a score — the game owns that, and it is
    // already in drill_sessions under its own drill_type.
    assessments: session.blocks
      .filter((b) => b.type === 'assessment')
      .map((b) => ({
        activityId: b.activityId ?? b.id,
        name: b.name,
        completed: b.completed,
      })),
  };

  return { record, flushEntries };
}

function countSuccesses(cp: Checkpoint): number {
  return cp.swings.filter((s) => s === true).length;
}
