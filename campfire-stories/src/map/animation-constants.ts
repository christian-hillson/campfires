// Animation timing constants (seconds)
export const COMMIT_WALK_DURATION = 1.2;
export const COMMIT_TOSS_DURATION = 0.4;
export const FILE_SAVE_DURATION = 0.5;
export const BRANCH_WALK_DURATION = 1.5;
export const FIRE_FLARE_DURATION = 0.3;
export const FIRE_TRANSITION_DURATION = 1.0;
export const FLOATING_TEXT_DURATION = 2.5;
export const PULSE_DURATION = 2.0;

// Activity polling interval (ms)
export const ACTIVITY_POLL_INTERVAL = 5000;

// Fire level thresholds (events in last 5 minutes)
export const FIRE_LEVEL_HIGH_THRESHOLD = 10;
export const FIRE_LEVEL_STEADY_THRESHOLD = 3;
export const FIRE_LEVEL_WINDOW = 5 * 60 * 1000; // 5 minutes in ms

export type FireLevel = 'high' | 'steady' | 'low';

export interface FireLevelMultipliers {
  height: number;
  sparks: number;
  flicker: number;
  glow: number;
  embers: number;
  flames: number;
}

export const FIRE_LEVELS: Record<FireLevel, FireLevelMultipliers> = {
  high: { height: 1.5, sparks: 2.0, flicker: 1.5, glow: 1.3, embers: 1.5, flames: 1.0 },
  steady: { height: 1.0, sparks: 1.0, flicker: 1.0, glow: 1.0, embers: 1.0, flames: 1.0 },
  low: { height: 0.5, sparks: 0.3, flicker: 0.6, glow: 0.7, embers: 0.5, flames: 0.5 },
};

// Pulse ring intervals per fire level (seconds between pulses)
export const PULSE_INTERVALS: Record<FireLevel, number> = {
  high: 2,
  steady: 5,
  low: 10,
};

// Pulse ring max radius multiplier (relative to fire size)
export const PULSE_RADIUS_MULT: Record<FireLevel, number> = {
  high: 3,
  steady: 2,
  low: 1.5,
};

// Fire flare multiplier on commit
export const COMMIT_FLARE_MULT = 1.2;

// PR2: Session enter/exit
export const SESSION_ENTER_DURATION = 2.0;
export const SESSION_EXIT_DURATION = 2.0;

// PR2: Golem spawn phases (total = 2.4s)
export const SPAWN_SPARK_DETACH = 0.5;
export const SPAWN_CASTING = 0.3;
export const SPAWN_DESCENT = 0.3;
export const SPAWN_FORMATION = 1.0;
export const SPAWN_ACTIVATION = 0.3;
export const SPAWN_TOTAL =
  SPAWN_SPARK_DETACH + SPAWN_CASTING + SPAWN_DESCENT + SPAWN_FORMATION + SPAWN_ACTIVATION;

// PR2: Golem despawn
export const DESPAWN_WALK_DURATION = 0.6;
export const DESPAWN_DISSOLVE_DURATION = 0.5;
export const DESPAWN_FLARE_DURATION = 0.5;

// PR2: Golem speed multiplier
export const GOLEM_SPEED_MULT = 2;
