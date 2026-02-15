import type { SpriteData, SpriteStatus, SpriteTask } from './layout.js';
import type { CampfirePosition } from './layout.js';

// ── Animation types ──

export interface WalkAnim {
  type: 'walk';
  duration: number;
  elapsed: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
  onComplete?: () => void;
}

export interface FileSaveStrikeAnim {
  type: 'file_save_strike';
  duration: number;
  elapsed: number;
}

export interface CommitTossAnim {
  type: 'commit_toss';
  duration: number;
  elapsed: number;
  message: string;
}

export interface GolemSpawnAnim {
  type: 'golem_spawn';
  duration: number;
  elapsed: number;
  fireX: number;
  fireY: number;
  targetX: number;
  targetY: number;
  ownerX: number;
  ownerY: number;
}

export interface GolemDespawnAnim {
  type: 'golem_despawn';
  duration: number;
  elapsed: number;
  fireX: number;
  fireY: number;
}

export type SpriteAnimation =
  | WalkAnim
  | FileSaveStrikeAnim
  | CommitTossAnim
  | GolemSpawnAnim
  | GolemDespawnAnim;

export interface AnimatedSprite {
  // Static identity (from SpriteData)
  userId: string;
  name: string;
  type: 'human' | 'agent';
  color: string;
  teamName: string;
  file: string;
  parentName: string | null;
  // Mutable position/state
  homeX: number;
  homeY: number;
  status: SpriteStatus;
  defaultTask: SpriteTask;
  visible: boolean;
  opacity: number;
  // Animation
  animQueue: SpriteAnimation[];
  currentAnim: SpriteAnimation | null;
  // Campfire reference
  campfireIndex: number;
  // Spawn state (PR2)
  isSpawning: boolean;
}

export interface SpriteRenderState {
  x: number;
  y: number;
  task: SpriteTask;
  opacity: number;
  animProgress: number; // 0..1 progress of current animation (for drawing functions)
  animMessage: string; // commit message for toss animation
  // Golem spawn render data
  spawnPhase: string; // '' | 'spark_detach' | 'casting' | 'descent' | 'formation' | 'activation'
  spawnFireX: number;
  spawnFireY: number;
  spawnOwnerX: number;
  spawnOwnerY: number;
  // Despawn render data
  despawnFireX: number;
  despawnFireY: number;
}

// ── Tick / advance ──

export function tickSprite(sprite: AnimatedSprite, dt: number): void {
  if (!sprite.currentAnim && sprite.animQueue.length > 0) {
    sprite.currentAnim = sprite.animQueue.shift()!;
  }

  if (!sprite.currentAnim) return;

  sprite.currentAnim.elapsed += dt;

  if (sprite.currentAnim.elapsed >= sprite.currentAnim.duration) {
    const finished = sprite.currentAnim;
    sprite.currentAnim = null;

    if (finished.type === 'walk' && finished.onComplete) {
      finished.onComplete();
    }

    // Start next anim immediately if queued
    if (sprite.animQueue.length > 0) {
      sprite.currentAnim = sprite.animQueue.shift()!;
    }
  }
}

// ── Render state computation ──

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function getSpriteRenderState(sprite: AnimatedSprite): SpriteRenderState {
  const base: SpriteRenderState = {
    x: sprite.homeX,
    y: sprite.homeY,
    task: sprite.defaultTask,
    opacity: sprite.opacity,
    animProgress: 0,
    animMessage: '',
    spawnPhase: '',
    spawnFireX: 0,
    spawnFireY: 0,
    spawnOwnerX: 0,
    spawnOwnerY: 0,
    despawnFireX: 0,
    despawnFireY: 0,
  };

  const anim = sprite.currentAnim;
  if (!anim) return base;

  const progress = Math.min(1, anim.elapsed / anim.duration);

  if (anim.type === 'walk') {
    const t = easeInOut(progress);
    base.x = anim.startX + (anim.endX - anim.startX) * t;
    base.y = anim.startY + (anim.endY - anim.startY) * t;
    base.task = 'walking';

    if (anim.fadeIn) {
      base.opacity = Math.min(1, progress * 3);
    }
    if (anim.fadeOut) {
      base.opacity = Math.max(0, 1 - (progress - 0.7) / 0.3);
    }
  } else if (anim.type === 'file_save_strike') {
    base.task = 'strike';
    base.animProgress = progress;
  } else if (anim.type === 'commit_toss') {
    base.task = 'toss';
    base.animProgress = progress;
    base.animMessage = anim.message;
  } else if (anim.type === 'golem_spawn') {
    base.animProgress = progress;
    base.spawnFireX = anim.fireX;
    base.spawnFireY = anim.fireY;
    base.spawnOwnerX = anim.ownerX;
    base.spawnOwnerY = anim.ownerY;

    // Determine phase from elapsed time using imported constants
    const elapsed = anim.elapsed;
    const { SPAWN_SPARK_DETACH, SPAWN_CASTING, SPAWN_DESCENT, SPAWN_FORMATION } = getSpawnDurations();
    if (elapsed < SPAWN_SPARK_DETACH) {
      base.spawnPhase = 'spark_detach';
      base.x = anim.fireX;
      base.y = anim.fireY;
      base.opacity = 0; // golem not visible yet
    } else if (elapsed < SPAWN_SPARK_DETACH + SPAWN_CASTING) {
      base.spawnPhase = 'casting';
      base.x = anim.fireX;
      base.y = anim.fireY - 14; // spark at top
      base.opacity = 0;
    } else if (elapsed < SPAWN_SPARK_DETACH + SPAWN_CASTING + SPAWN_DESCENT) {
      base.spawnPhase = 'descent';
      const dp = (elapsed - SPAWN_SPARK_DETACH - SPAWN_CASTING) / SPAWN_DESCENT;
      // Arc from spark position to target
      const arcX = anim.fireX + (anim.targetX - anim.fireX) * dp;
      const arcY = (anim.fireY - 14) + (anim.targetY - (anim.fireY - 14)) * dp - Math.sin(dp * Math.PI) * 10;
      base.x = arcX;
      base.y = arcY;
      base.opacity = 0;
    } else if (elapsed < SPAWN_SPARK_DETACH + SPAWN_CASTING + SPAWN_DESCENT + SPAWN_FORMATION) {
      base.spawnPhase = 'formation';
      const fp = (elapsed - SPAWN_SPARK_DETACH - SPAWN_CASTING - SPAWN_DESCENT) / SPAWN_FORMATION;
      base.x = anim.targetX;
      base.y = anim.targetY;
      base.opacity = fp > 0.5 ? (fp - 0.5) / 0.5 : 0;
      base.animProgress = fp;
    } else {
      base.spawnPhase = 'activation';
      const ap = (elapsed - SPAWN_SPARK_DETACH - SPAWN_CASTING - SPAWN_DESCENT - SPAWN_FORMATION) /
        (anim.duration - SPAWN_SPARK_DETACH - SPAWN_CASTING - SPAWN_DESCENT - SPAWN_FORMATION);
      base.x = anim.targetX;
      base.y = anim.targetY;
      base.opacity = 1;
      base.animProgress = ap;
    }
  } else if (anim.type === 'golem_despawn') {
    base.animProgress = progress;
    base.task = 'toss'; // reuse toss visual for dissolve
    base.despawnFireX = anim.fireX;
    base.despawnFireY = anim.fireY;
    base.opacity = 1 - progress;
  }

  return base;
}

// Lazy import helper to avoid circular dependency
function getSpawnDurations() {
  return {
    SPAWN_SPARK_DETACH: 0.5,
    SPAWN_CASTING: 0.3,
    SPAWN_DESCENT: 0.3,
    SPAWN_FORMATION: 1.0,
  };
}

// ── Reconcile sprites from layout data ──

export function reconcileSprites(
  existing: Map<string, AnimatedSprite>,
  newLayout: SpriteData[],
  _campfires: CampfirePosition[],
): Map<string, AnimatedSprite> {
  const result = new Map<string, AnimatedSprite>();
  const newIds = new Set<string>();

  for (const sd of newLayout) {
    newIds.add(sd.userId);
    const prev = existing.get(sd.userId);

    if (prev) {
      // Update static fields but preserve animation state
      prev.name = sd.name;
      prev.color = sd.color;
      prev.teamName = sd.teamName;
      prev.file = sd.file;
      prev.parentName = sd.parentName;
      prev.status = sd.status;
      prev.campfireIndex = sd.campfireIndex;

      // Only update home position if no animation is playing
      if (!prev.currentAnim && prev.animQueue.length === 0) {
        prev.homeX = sd.homeX;
        prev.homeY = sd.homeY;
        prev.defaultTask = sd.task;
      }

      prev.visible = true;
      prev.opacity = 1;
      result.set(sd.userId, prev);
    } else {
      // New sprite
      result.set(sd.userId, {
        userId: sd.userId,
        name: sd.name,
        type: sd.type,
        color: sd.color,
        teamName: sd.teamName,
        file: sd.file,
        parentName: sd.parentName,
        homeX: sd.homeX,
        homeY: sd.homeY,
        status: sd.status,
        defaultTask: sd.task,
        visible: true,
        opacity: 1,
        animQueue: [],
        currentAnim: null,
        campfireIndex: sd.campfireIndex,
        isSpawning: false,
      });
    }
  }

  // Sprites that disappeared — mark invisible (keep briefly for fade-out in PR2)
  for (const [id, sprite] of existing) {
    if (!newIds.has(id)) {
      sprite.visible = false;
    }
  }

  return result;
}
