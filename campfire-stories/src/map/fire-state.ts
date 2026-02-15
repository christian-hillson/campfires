import type { FireLevel, FireLevelMultipliers } from './animation-constants.js';
import {
  FIRE_LEVELS,
  FIRE_TRANSITION_DURATION,
  FIRE_FLARE_DURATION,
  PULSE_DURATION,
  PULSE_INTERVALS,
  FIRE_LEVEL_HIGH_THRESHOLD,
  FIRE_LEVEL_STEADY_THRESHOLD,
} from './animation-constants.js';
import type { CampfirePosition } from './layout.js';

// ── Types ──

export interface CampfireFireState {
  level: FireLevel;
  prevLevel: FireLevel;
  transitionProgress: number; // 0→1 over FIRE_TRANSITION_DURATION
}

export interface FireFlare {
  active: boolean;
  startTime: number;
  mult: number;
}

export interface PulseRing {
  startTime: number;
  x: number;
  y: number;
}

export interface PulseState {
  rings: PulseRing[];
  lastPulseTime: number;
}

// ── Initialization ──

export function createFireState(initialLevel: FireLevel = 'steady'): CampfireFireState {
  return { level: initialLevel, prevLevel: initialLevel, transitionProgress: 1 };
}

export function createFireFlare(): FireFlare {
  return { active: false, startTime: 0, mult: 1 };
}

export function createPulseState(): PulseState {
  return { rings: [], lastPulseTime: 0 };
}

// ── Fire level interpolation ──

function lerpMultipliers(
  a: FireLevelMultipliers,
  b: FireLevelMultipliers,
  t: number,
): FireLevelMultipliers {
  return {
    height: a.height + (b.height - a.height) * t,
    sparks: a.sparks + (b.sparks - a.sparks) * t,
    flicker: a.flicker + (b.flicker - a.flicker) * t,
    glow: a.glow + (b.glow - a.glow) * t,
    embers: a.embers + (b.embers - a.embers) * t,
    flames: a.flames + (b.flames - a.flames) * t,
  };
}

export function getFireMultipliers(
  state: CampfireFireState,
  flare: FireFlare,
  time: number,
): FireLevelMultipliers {
  const prev = FIRE_LEVELS[state.prevLevel];
  const curr = FIRE_LEVELS[state.level];
  const t = Math.min(1, state.transitionProgress);
  const base = lerpMultipliers(prev, curr, t);

  // Apply flare
  if (flare.active) {
    const flareElapsed = time - flare.startTime;
    if (flareElapsed < FIRE_FLARE_DURATION) {
      const flareT = flareElapsed / FIRE_FLARE_DURATION;
      // Quick rise, slow fall
      const flareIntensity = flareT < 0.3 ? flareT / 0.3 : 1 - (flareT - 0.3) / 0.7;
      const flareFactor = 1 + (flare.mult - 1) * flareIntensity;
      base.height *= flareFactor;
      base.sparks *= flareFactor;
      base.glow *= flareFactor;
    }
  }

  return base;
}

// ── Tick functions ──

export function tickFireState(
  states: CampfireFireState[],
  flares: FireFlare[],
  dt: number,
  time: number,
): void {
  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    if (state.transitionProgress < 1) {
      state.transitionProgress = Math.min(
        1,
        state.transitionProgress + dt / FIRE_TRANSITION_DURATION,
      );
    }

    // Decay flares
    const flare = flares[i];
    if (flare.active && time - flare.startTime >= FIRE_FLARE_DURATION) {
      flare.active = false;
    }
  }
}

export function tickPulses(
  pulseStates: PulseState[],
  fireStates: CampfireFireState[],
  campfires: CampfirePosition[],
  time: number,
): void {
  for (let i = 0; i < pulseStates.length; i++) {
    const ps = pulseStates[i];
    const fs = fireStates[i];
    const cf = campfires[i];
    if (!cf) continue;

    const interval = PULSE_INTERVALS[fs.level];

    // No pulses for cold fires
    if (interval <= 0) continue;

    // Emit new pulse if interval elapsed
    if (time - ps.lastPulseTime >= interval) {
      ps.rings.push({ startTime: time, x: cf.x, y: cf.y });
      ps.lastPulseTime = time;
    }

    // Remove expired rings
    ps.rings = ps.rings.filter((r) => time - r.startTime < PULSE_DURATION);
  }
}

// ── Triggers ──

export function triggerFireFlare(
  flares: FireFlare[],
  index: number,
  mult: number,
  time: number,
): void {
  if (index < flares.length) {
    flares[index].active = true;
    flares[index].startTime = time;
    flares[index].mult = mult;
  }
}

export function computeFireLevel(
  recentEventCount: number,
  onlineMemberCount: number = 1,
): FireLevel {
  if (onlineMemberCount === 0) return 'cold';
  if (recentEventCount === 0) return 'kindled';
  if (recentEventCount >= FIRE_LEVEL_HIGH_THRESHOLD) return 'roaring';
  if (recentEventCount >= FIRE_LEVEL_STEADY_THRESHOLD) return 'steady';
  return 'kindled';
}

export function setFireLevel(state: CampfireFireState, newLevel: FireLevel): void {
  if (state.level !== newLevel) {
    state.prevLevel = state.level;
    state.level = newLevel;
    state.transitionProgress = 0;
  }
}
