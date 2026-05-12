import type { FocusElement, PracticeIntent, WeekConfig } from './types';

export const PRACTICE_INTENTS: { key: PracticeIntent; label: string; desc: string }[] = [
  { key: 'slow_mo', label: 'Slow-Motion (60–80%)', desc: 'Reduced speed reps to feel the pattern' },
  { key: 'exaggerated', label: 'Exaggerated', desc: 'Overdo the technical change so it’s unmistakable' },
  { key: 'external', label: 'External Focus', desc: 'Focus on the club, ball, or target effect' },
  { key: 'internal', label: 'Internal Focus', desc: 'Focus on a body position or movement' },
  { key: 'cue_rep', label: 'Cue Repetition', desc: 'Say the focus cue out loud before each rep' },
];

export const WEDGE_DISTANCE_POOL = [40, 50, 60, 70, 80, 90, 100];

export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function uid(prefix = 'el'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function seedElement(name: string, cue: string): FocusElement {
  return { id: uid('el'), name, cue };
}

export function seedWeekConfig(): WeekConfig {
  const date = todayISO();
  return {
    date,
    startDate: date,
    ironElements: [
      seedElement('Forward shaft lean at impact', 'Trap the ball against the turf'),
      seedElement('Steady lower body through impact', 'Quiet hips, post the lead leg'),
    ],
    driverElements: [
      seedElement('Shallow attack, ball-first contact', 'Sweep the ball off a high tee'),
    ],
  };
}
