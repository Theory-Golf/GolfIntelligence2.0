export type FocusElement = {
  id: string;
  name: string;
  cue: string;
};

export type WeekConfig = {
  date: string;
  startDate: string;
  ironElements: FocusElement[];
  driverElements: FocusElement[];
};

export type Swing = true | false | null;

export type Checkpoint = {
  id: string;
  elementId: string;
  swings: Swing[];
  logged?: boolean;
  score?: number;
};

export type PracticeIntent =
  | 'slow_mo'
  | 'exaggerated'
  | 'external'
  | 'internal'
  | 'cue_rep';

export type PracticeGate = {
  id: string;
  afterCheckpointIdx: number;
  intent: PracticeIntent | null;
};

export type Direction = 'L' | 'O' | 'R' | null;

export type WedgeShot = {
  target: number;
  ballSpeed: string;
  direction: Direction;
  recorded: boolean;
  timestamp: string;
};

export type DistanceTest = {
  mode: 'prompted';
  shots: WedgeShot[];
  distances?: number[];
  currentShot?: { ballSpeed: string; direction: Direction };
  showAllShots?: boolean;
};

export type BlockType =
  | 'warmup'
  | 'wedge-distance'
  | 'iron-technical'
  | 'driver'
  | 'assessment'
  | 'cooldown';

export type Block = {
  id: string;
  name: string;
  type: BlockType;
  subtype?: 'warmup' | 'end';
  shots: number;
  instructions: string;
  cue?: string;
  elementId?: string;
  elementName?: string;
  checkpoints?: Checkpoint[];
  practiceGates?: PracticeGate[];
  practiceCount?: number;
  distanceTest?: DistanceTest;
  /**
   * For `assessment` blocks: the catalog activity to run, which is also its
   * `drill_type` in `drill_sessions`. The game records its own score there —
   * the session only tracks that the test was run.
   */
  activityId?: string;
  completed: boolean;
};

export type Session = {
  date: string;
  shotBudget: number;
  includeDriver: 'auto' | 'yes' | 'no';
  ironFocusId: string;
  blocks: Block[];
};

export type HistoryKind = 'technical' | 'wedge_shot' | 'distance';

export type HistoryEntry = {
  date: string;
  timestamp: string;
  elementId: string;
  elementName: string;
  kind: HistoryKind;
  blockType?: BlockType;
  blockSubtype?: 'warmup' | 'end';
  // technical / distance summary
  score?: number;
  total?: number;
  avgBallSpeed?: number | null;
  // per-shot wedge
  target?: number;
  ballSpeed?: number | null;
  direction?: Direction;
  // Reserved for future integrations
  playerId?: string;
  activityId?: string;
};

/** A finished session, saved when the player completes it. */
export type SessionRecord = {
  id: string;
  date: string;
  completedAt: string;
  /** Mesocycle stage at the moment the session was completed */
  week: number;
  phase: string;
  phaseDesc: string;
  shotBudget: number;
  plannedShots: number;
  blocksCompleted: number;
  blocksTotal: number;
  blocks: {
    id: string;
    name: string;
    type: BlockType;
    shots: number;
    completed: boolean;
  }[];
  checkpoints: {
    elementId: string;
    elementName: string;
    score: number;
    total: number;
  }[];
  wedgeShots: number;
  avgBallSpeed: number | null;
  /**
   * Assessments the session prescribed. Records only that the test was run —
   * the game writes its own score to `drill_sessions`, and duplicating it
   * here would create two numbers for one attempt that could disagree.
   * Optional: sessions saved before assessment blocks existed lack it.
   */
  assessments?: {
    activityId: string;
    name: string;
    completed: boolean;
  }[];
};

export type PlannerExport = {
  exportDate: string;
  version: number;
  weekConfig: WeekConfig | null;
  currentSession: Session | null;
  history: HistoryEntry[];
  /** Added in version 2 — absent in older backups */
  sessions?: SessionRecord[];
};

export type StatusKey = 'new' | 'building' | 'acquiring' | 'stable' | 'mastered';
