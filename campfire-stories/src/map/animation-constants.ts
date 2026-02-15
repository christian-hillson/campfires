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

export type FireLevel = 'cold' | 'kindled' | 'steady' | 'roaring';

export interface FireLevelMultipliers {
  height: number;
  sparks: number;
  flicker: number;
  glow: number;
  embers: number;
  flames: number;
}

export const FIRE_LEVELS: Record<FireLevel, FireLevelMultipliers> = {
  cold: { height: 0, sparks: 0, flicker: 0, glow: 0, embers: 0, flames: 0 },
  kindled: { height: 0.3, sparks: 0.15, flicker: 0.4, glow: 0.5, embers: 0.3, flames: 0.3 },
  steady: { height: 1.0, sparks: 1.0, flicker: 1.0, glow: 1.0, embers: 1.0, flames: 1.0 },
  roaring: { height: 1.5, sparks: 2.0, flicker: 1.5, glow: 1.3, embers: 1.5, flames: 1.0 },
};

// Pulse ring intervals per fire level (seconds between pulses)
export const PULSE_INTERVALS: Record<FireLevel, number> = {
  cold: 0, // no pulses when cold
  kindled: 12,
  steady: 5,
  roaring: 2,
};

// Pulse ring max radius multiplier (relative to fire size)
export const PULSE_RADIUS_MULT: Record<FireLevel, number> = {
  cold: 0,
  kindled: 1,
  steady: 2,
  roaring: 3,
};

// Kindle animation
export const KINDLE_DURATION = 1.5;
export const KINDLE_STAGGER_DELAY = 0.25;

// Founder pig ceremony
export const FOUNDER_CEREMONY_DURATION = 4.0;

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

// PR3: Golem behaviors
export const GOLEM_GLOW_WINDOW = 30; // seconds
export const AFTERIMAGE_DURATION = 0.15; // seconds
export const ORB_DEPOSIT_DURATION = 0.3;

// PR3: Milestone celebrations
export const MILESTONE_JUMP_DURATION = 0.4;
export const MILESTONE_PARTICLE_DURATION = 1.0;
export const MILESTONE_GOLD_DURATION = 0.5;

// Sprint 12: Spark arcs
export const SPARK_ARC_DURATION = 3.0; // total animation time (seconds)
export const SPARK_ARC_HEIGHT = 40; // pixels above midpoint
export const SPARK_BADGE_PERSIST = 300; // seconds (5 min) badge visible after arc
