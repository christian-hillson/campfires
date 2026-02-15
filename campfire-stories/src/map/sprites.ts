import { px, darken, PIXEL_SCALE } from './renderer.js';
import type { SpriteData } from './layout.js';
import {
  FLOATING_TEXT_DURATION,
  SPAWN_SPARK_DETACH,
  SPAWN_CASTING,
  SPAWN_DESCENT,
  SPAWN_FORMATION,
  SPAWN_TOTAL,
  AFTERIMAGE_DURATION,
  GOLEM_GLOW_WINDOW,
  MILESTONE_PARTICLE_DURATION,
  MILESTONE_JUMP_DURATION,
} from './animation-constants.js';

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  startTime: number;
  color: string;
}

export function drawHumanSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteData,
  time: number,
): void {
  const { px: x, py: y, color, status, task } = sprite;
  const bobY = status === 'active' ? Math.sin(time * 4) * 0.5 : 0;
  const bY = y + bobY;

  if (status === 'draft') {
    // Tent shape
    px(ctx, x - 3, bY - 1, 7, 4, '#3a3830');
    px(ctx, x - 2, bY - 3, 5, 2, '#4a4840');
    px(ctx, x, bY - 4, 1, 1, '#5a5850');
    // Person peeking
    px(ctx, x, bY, 2, 1, color);
    px(ctx, x, bY - 1, 2, 1, '#e0d8c8');
    return;
  }

  if (status === 'visitor') {
    // Sitting visitor sprite with walking stick
    px(ctx, x, bY + 1, 3, 1, color);
    px(ctx, x, bY, 2, 1, color);
    px(ctx, x, bY - 1, 2, 1, '#e0d8c8');
    // Walking stick
    px(ctx, x + 3, bY - 2, 1, 4, '#8a7a5a');
    px(ctx, x + 3, bY - 3, 1, 1, '#a09070');
    return;
  }

  if (status === 'idle') {
    // Sitting sprite
    px(ctx, x, bY + 1, 3, 1, color);
    px(ctx, x, bY, 2, 1, color);
    px(ctx, x, bY - 1, 2, 1, '#e0d8c8');
    // Zzz
    const zOff = Math.sin(time * 2) * 0.5;
    ctx.save();
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#5a6a6a88';
    ctx.fillText('z', (x + 3 + zOff) * 3, (bY - 3) * 3);
    ctx.fillText('z', (x + 5 + zOff * 1.3) * 3, (bY - 5) * 3);
    ctx.restore();
    return;
  }

  // Active sprite base
  px(ctx, x, bY + 2, 1, 1, '#2a2020');
  px(ctx, x + 1, bY + 2, 1, 1, '#2a2020');
  px(ctx, x, bY, 2, 2, color);
  px(ctx, x, bY - 1, 2, 1, '#e0d8c8');

  // Task-specific animations
  if (task === 'smithing') {
    const hammerUp = Math.sin(time * 6) > 0;
    px(ctx, x + 2, bY + (hammerUp ? -1 : 1), 1, 1, '#888');
    px(ctx, x + 2, bY, 1, 1, '#5a4030');
    px(ctx, x + 4, bY + 1, 3, 2, '#555');
    px(ctx, x + 4, bY, 3, 1, '#666');
    if (!hammerUp) {
      px(ctx, x + 4 + Math.random() * 3, bY - 1 - Math.random() * 2, 1, 1, '#f0c040');
      px(ctx, x + 5 + Math.random() * 2, bY - Math.random() * 2, 1, 1, '#f08020');
    }
  } else if (task === 'scribing') {
    px(ctx, x + 3, bY + 1, 4, 1, '#4a3828');
    px(ctx, x + 3, bY + 2, 1, 2, '#3a2818');
    px(ctx, x + 6, bY + 2, 1, 2, '#3a2818');
    px(ctx, x + 3, bY, 3, 1, '#e8e0d0');
    const qx = x + 4 + Math.sin(time * 5) * 0.8;
    px(ctx, qx, bY - 1, 1, 1, '#2a2020');
    if (Math.sin(time * 3) > 0) {
      px(ctx, x + 3 + ((time * 2) % 3), bY, 1, 1, '#3a3020');
    }
  } else if (task === 'mining') {
    const swingAngle = Math.sin(time * 5);
    px(ctx, x - 2 + swingAngle, bY - 1 + Math.abs(swingAngle), 1, 1, '#888');
    px(ctx, x - 1, bY, 1, 1, '#5a4030');
    px(ctx, x - 4, bY + 1, 3, 2, '#5a5a60');
    px(ctx, x - 3, bY, 2, 1, '#6a6a70');
    if (swingAngle < -0.5) {
      px(ctx, x - 4 + Math.random() * 2, bY - 1 - Math.random() * 2, 1, 1, '#8a8a90');
    }
  }
}

export function drawGolemSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteData,
  time: number,
): void {
  const { px: x, py: y, color, task } = sprite;
  const bobY = y + Math.sin(time * 3 + 1) * 0.3;

  // Feet
  px(ctx, x, bobY + 3, 1, 1, '#3a3a40');
  px(ctx, x + 2, bobY + 3, 1, 1, '#3a3a40');
  // Legs
  px(ctx, x, bobY + 2, 1, 1, darken(color, 0.5));
  px(ctx, x + 2, bobY + 2, 1, 1, darken(color, 0.5));
  // Body
  px(ctx, x - 1, bobY, 4, 2, darken(color, 0.7));
  px(ctx, x, bobY, 2, 1, color);
  // Head
  px(ctx, x, bobY - 1, 2, 1, '#6a6a70');
  // Glowing eyes
  const eyeGlow = Math.sin(time * 4) > 0 ? '#80f0f0' : '#50c0c0';
  px(ctx, x, bobY - 1, 1, 1, eyeGlow);
  px(ctx, x + 1, bobY - 1, 1, 1, eyeGlow);
  // Rune mark
  px(ctx, x + 0.5, bobY + 1, 1, 1, color);

  // Task animations
  if (task === 'chopping') {
    const swing = Math.sin(time * 6);
    px(ctx, x + 3, bobY + (swing > 0 ? -1 : 1), 1, 1, '#aaa');
    px(ctx, x + 3, bobY, 1, 1, '#5a4030');
    px(ctx, x + 5, bobY + 2, 2, 2, '#5a3820');
    px(ctx, x + 5, bobY + 1, 2, 1, '#6a4830');
    if (swing < -0.5) {
      px(ctx, x + 5 + Math.random() * 3, bobY - Math.random() * 2, 1, 1, '#8a6840');
    }
  } else if (task === 'carrying') {
    px(ctx, x, bobY - 3, 3, 2, '#6a5830');
    px(ctx, x, bobY - 2, 3, 1, '#7a6840');
    const trail = Math.floor(time * 3) % 3;
    px(ctx, x - 2 - trail, bobY + 3, 1, 1, '#2a2820');
  } else if (task === 'mining') {
    const swing = Math.sin(time * 5.5);
    px(ctx, x - 2 + swing, bobY - 1 + Math.abs(swing), 1, 1, '#999');
    px(ctx, x - 1, bobY, 1, 1, '#5a4030');
    px(ctx, x - 4, bobY + 1, 3, 2, '#4a4a50');
    if (swing < -0.5) {
      px(ctx, x - 4 + Math.random() * 2, bobY - 1 - Math.random() * 2, 1, 1, '#7a7a80');
    }
  }
}

/** Draw a file-save "strike" micro-animation */
export function drawStrikeSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  progress: number,
  time: number,
): void {
  const bobY = y;

  // Base body
  px(ctx, x, bobY + 2, 1, 1, '#2a2020');
  px(ctx, x + 1, bobY + 2, 1, 1, '#2a2020');
  px(ctx, x, bobY, 2, 2, color);
  px(ctx, x, bobY - 1, 2, 1, '#e0d8c8');

  if (progress < 0.5) {
    // Arm up with tool
    px(ctx, x + 2, bobY - 2, 1, 1, '#888');
    px(ctx, x + 2, bobY - 1, 1, 1, '#5a4030');
  } else {
    // Arm down + sparks
    px(ctx, x + 2, bobY + 1, 1, 1, '#888');
    px(ctx, x + 2, bobY, 1, 1, '#5a4030');
    // Sparks
    const sparkIntensity = 1 - (progress - 0.5) / 0.5;
    for (let i = 0; i < 3; i++) {
      const sx = x + 2 + Math.sin(time * 10 + i * 2) * 2 * sparkIntensity;
      const sy = bobY - 1 - Math.random() * 3 * sparkIntensity;
      px(ctx, sx, sy, 1, 1, i % 2 === 0 ? '#f0c040' : '#f08020');
    }
  }
}

/** Draw a commit "toss" animation */
export function drawTossSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  progress: number,
  _time: number,
): void {
  const bobY = y;

  // Base body
  px(ctx, x, bobY + 2, 1, 1, '#2a2020');
  px(ctx, x + 1, bobY + 2, 1, 1, '#2a2020');
  px(ctx, x, bobY, 2, 2, color);
  px(ctx, x, bobY - 1, 2, 1, '#e0d8c8');

  if (progress < 0.4) {
    // Arm raised with offering (glowing orb)
    px(ctx, x + 2, bobY - 2, 1, 1, color);
    px(ctx, x + 2, bobY - 3, 1, 1, '#f0e8a0');
  } else if (progress < 0.7) {
    // Arm extended, releasing
    px(ctx, x + 3, bobY - 1, 1, 1, color);
    // Orb flying
    const flyT = (progress - 0.4) / 0.3;
    const orbY = bobY - 3 - flyT * 4;
    px(ctx, x + 2, orbY, 1, 1, '#f0e8a0');
    px(ctx, x + 2, orbY + 1, 1, 1, '#f0c040');
  } else {
    // Follow through — arms lowered
    px(ctx, x + 2, bobY, 1, 1, color);
  }
}

/** Draw floating text that rises and fades */
export function drawFloatingText(
  ctx: CanvasRenderingContext2D,
  ft: FloatingText,
  time: number,
): void {
  const elapsed = time - ft.startTime;
  if (elapsed >= FLOATING_TEXT_DURATION) return;

  const progress = elapsed / FLOATING_TEXT_DURATION;
  const alpha = 1 - progress;
  const riseY = progress * 20; // rise 20 pixel-art units

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '8px "Silkscreen", monospace';
  ctx.fillStyle = ft.color || '#f0e8c0';
  ctx.textAlign = 'center';
  ctx.fillText(ft.text, ft.x * PIXEL_SCALE, (ft.y - riseY) * PIXEL_SCALE);
  ctx.restore();
}

/** Remove expired floating texts in-place */
export function cleanupFloatingTexts(texts: FloatingText[], time: number): void {
  for (let i = texts.length - 1; i >= 0; i--) {
    if (time - texts[i].startTime >= FLOATING_TEXT_DURATION) {
      texts.splice(i, 1);
    }
  }
}

// ── PR2: Golem Spawn Drawing ──

/** Draw the golem spawn sequence (5 phases) */
export function drawGolemSpawn(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  fireX: number,
  fireY: number,
  targetX: number,
  targetY: number,
  ownerX: number,
  ownerY: number,
  color: string,
  time: number,
): void {
  if (elapsed < SPAWN_SPARK_DETACH) {
    // Phase 1: Spark rises from fire
    const p = elapsed / SPAWN_SPARK_DETACH;
    const sparkY = fireY - p * 14;
    const sparkSize = 1 + p * 2 + Math.sin(p * Math.PI * 3) * 0.5;

    // Radial glow
    ctx.save();
    const grad = ctx.createRadialGradient(
      fireX * PIXEL_SCALE, sparkY * PIXEL_SCALE, 0,
      fireX * PIXEL_SCALE, sparkY * PIXEL_SCALE, sparkSize * 2 * PIXEL_SCALE,
    );
    grad.addColorStop(0, 'rgba(255,240,180,0.3)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(
      (fireX - sparkSize * 2) * PIXEL_SCALE,
      (sparkY - sparkSize * 2) * PIXEL_SCALE,
      sparkSize * 4 * PIXEL_SCALE,
      sparkSize * 4 * PIXEL_SCALE,
    );
    ctx.restore();

    // Spark
    const brightness = 0.6 + p * 0.4;
    ctx.save();
    ctx.globalAlpha = brightness;
    px(ctx, fireX - sparkSize / 2, sparkY - sparkSize / 2, Math.ceil(sparkSize), Math.ceil(sparkSize), '#f0e8a0');
    ctx.restore();
  } else if (elapsed < SPAWN_SPARK_DETACH + SPAWN_CASTING) {
    // Phase 2: Human casting, particles flow to spark
    const sparkX = fireX;
    const sparkY = fireY - 14;

    // Spark holds
    px(ctx, sparkX - 1, sparkY - 1, 3, 3, '#f0e8a0');

    // Particle lines from owner to spark
    for (let i = 0; i < 6; i++) {
      const pt = ((time * 2 + i * 0.15) % 1);
      const pxPos = ownerX + (sparkX - ownerX) * pt;
      const pyPos = ownerY + (sparkY - ownerY) * pt;
      ctx.save();
      ctx.globalAlpha = 0.3 + pt * 0.5;
      px(ctx, pxPos, pyPos, 1, 1, '#f0c040');
      ctx.restore();
    }
  } else if (elapsed < SPAWN_SPARK_DETACH + SPAWN_CASTING + SPAWN_DESCENT) {
    // Phase 3: Spark descends in arc to target
    const p = (elapsed - SPAWN_SPARK_DETACH - SPAWN_CASTING) / SPAWN_DESCENT;
    const startY = fireY - 14;
    const arcX = fireX + (targetX - fireX) * p;
    const arcY = startY + (targetY - startY) * p - Math.sin(p * Math.PI) * 10;

    px(ctx, arcX - 1, arcY - 1, 3, 3, '#f0e8a0');

    // Impact flash at end
    if (p > 0.9) {
      ctx.save();
      const flashR = 5;
      const grad = ctx.createRadialGradient(
        targetX * PIXEL_SCALE, targetY * PIXEL_SCALE, 0,
        targetX * PIXEL_SCALE, targetY * PIXEL_SCALE, flashR * PIXEL_SCALE,
      );
      grad.addColorStop(0, 'rgba(255,255,220,0.9)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(
        (targetX - flashR) * PIXEL_SCALE,
        (targetY - flashR) * PIXEL_SCALE,
        flashR * 2 * PIXEL_SCALE,
        flashR * 2 * PIXEL_SCALE,
      );
      ctx.restore();
    }
  } else if (elapsed < SPAWN_SPARK_DETACH + SPAWN_CASTING + SPAWN_DESCENT + SPAWN_FORMATION) {
    // Phase 4: Formation — spark expands, takes golem shape
    const p = (elapsed - SPAWN_SPARK_DETACH - SPAWN_CASTING - SPAWN_DESCENT) / SPAWN_FORMATION;

    if (p < 0.25) {
      // Expanding spark
      const size = 2 + p * 8;
      px(ctx, targetX - size / 2, targetY - size / 2, Math.ceil(size), Math.ceil(size), '#f0e8a0');
    } else {
      // Taking golem shape — draw bright then transition to color
      const formColor = p < 0.4 ? '#f0e8a0' : color;
      px(ctx, targetX - 1, targetY, 4, 2, formColor);
      px(ctx, targetX, targetY, 2, 1, formColor);
      px(ctx, targetX, targetY - 1, 2, 1, '#6a6a70');

      // Bright overlay fading out
      if (p < 1) {
        const colorLerp = p >= 0.5 ? (p - 0.5) / 0.5 : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - colorLerp * 2);
        px(ctx, targetX - 1, targetY, 4, 2, '#f0e8a0');
        ctx.restore();
      }
    }

    // Cooling sparks
    if (p > 0.2) {
      const sparkCount = Math.floor((1 - p) * 6);
      for (let i = 0; i < sparkCount; i++) {
        const dist = 3 + p * 8;
        const angle = (i / sparkCount) * Math.PI * 2 + time * 2;
        const sx = targetX + Math.cos(angle) * dist;
        const sy = targetY + Math.sin(angle) * dist * 0.5;
        ctx.save();
        ctx.globalAlpha = (1 - p) * 0.8;
        px(ctx, sx, sy, 1, 1, i % 2 === 0 ? '#f0c040' : '#f0e8a0');
        ctx.restore();
      }
    }
  } else {
    // Phase 5: Activation — full golem, eyes glow up
    const p = (elapsed - SPAWN_SPARK_DETACH - SPAWN_CASTING - SPAWN_DESCENT - SPAWN_FORMATION) /
      (SPAWN_TOTAL - SPAWN_SPARK_DETACH - SPAWN_CASTING - SPAWN_DESCENT - SPAWN_FORMATION);

    // Draw golem body
    px(ctx, targetX, targetY + 3, 1, 1, '#3a3a40');
    px(ctx, targetX + 2, targetY + 3, 1, 1, '#3a3a40');
    px(ctx, targetX - 1, targetY, 4, 2, darken(color, 0.7));
    px(ctx, targetX, targetY, 2, 1, color);
    px(ctx, targetX, targetY - 1, 2, 1, '#6a6a70');

    // Eyes glow ramp
    const eyeColor = p < 0.5 ? '#806020' : '#d0a040';
    px(ctx, targetX, targetY - 1, 1, 1, eyeColor);
    px(ctx, targetX + 1, targetY - 1, 1, 1, eyeColor);
  }
}

/** Draw despawn dissolve particles */
export function drawDespawnParticles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fireX: number,
  fireY: number,
  color: string,
  progress: number,
  time: number,
): void {
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + time;
    const scatter = (1 - progress) * 3;
    const pxPos = x + (fireX - x) * progress + Math.cos(angle) * scatter;
    const pyPos = y + (fireY - y) * progress + Math.sin(angle) * scatter - progress * 10;
    const alpha = 1 - progress;

    ctx.save();
    ctx.globalAlpha = alpha;
    px(ctx, pxPos, pyPos, 1, 1, i % 2 === 0 ? color : '#f0c040');
    ctx.restore();
  }
}

// ── PR2: Human casting pose ──

/** Draw human in casting pose (arm raised toward spark during golem spawn) */
export function drawCastingSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteData,
  time: number,
): void {
  const { px: x, py: y, color } = sprite;
  const bobY = y + Math.sin(time * 4) * 0.5;

  // Base body
  px(ctx, x, bobY + 2, 1, 1, '#2a2020');
  px(ctx, x + 1, bobY + 2, 1, 1, '#2a2020');
  px(ctx, x, bobY, 2, 2, color);
  px(ctx, x, bobY - 1, 2, 1, '#e0d8c8');

  // Raised arm toward spark
  px(ctx, x + 2, bobY - 2, 1, 1, color);
  px(ctx, x + 2, bobY - 3, 1, 1, '#e0d8c8');

  // Glow at fingertip
  const glowAlpha = 0.5 + Math.sin(time * 8) * 0.3;
  ctx.save();
  ctx.globalAlpha = glowAlpha;
  px(ctx, x + 2, bobY - 4, 1, 1, '#f0e8a0');
  ctx.restore();
}

// ── PR3: Golem Behaviors ──

/** Draw activity glow aura around a golem */
export function drawActivityGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  recentEventTimes: number[],
  time: number,
): void {
  // Prune events outside window
  const cutoff = time - GOLEM_GLOW_WINDOW;
  const recentCount = recentEventTimes.filter((t) => t >= cutoff).length;
  const glowIntensity = Math.min(1, recentCount / 8);

  if (glowIntensity <= 0.05) return;

  const glowRadius = 8 + glowIntensity * 6;
  const centerAlpha = 0.08 + glowIntensity * 0.12;

  ctx.save();
  const grad = ctx.createRadialGradient(
    x * PIXEL_SCALE, y * PIXEL_SCALE, 0,
    x * PIXEL_SCALE, y * PIXEL_SCALE, glowRadius * PIXEL_SCALE,
  );
  grad.addColorStop(0, `rgba(255,180,60,${centerAlpha})`);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(
    (x - glowRadius) * PIXEL_SCALE,
    (y - glowRadius) * PIXEL_SCALE,
    glowRadius * 2 * PIXEL_SCALE,
    glowRadius * 2 * PIXEL_SCALE,
  );
  ctx.restore();
}

/** Draw afterimage trail for walking sprites */
export function drawAfterimages(
  ctx: CanvasRenderingContext2D,
  afterimages: { x: number; y: number; time: number }[],
  color: string,
  time: number,
): void {
  for (const ai of afterimages) {
    const age = time - ai.time;
    if (age >= AFTERIMAGE_DURATION) continue;
    const alpha = 0.25 * (1 - age / AFTERIMAGE_DURATION);
    ctx.save();
    ctx.globalAlpha = alpha;
    // Simplified ghost body
    px(ctx, ai.x, ai.y, 2, 2, color);
    px(ctx, ai.x, ai.y - 1, 2, 1, '#6a6a70');
    ctx.restore();
  }
}

/** Draw carrying orb above golem head */
export function drawCarryingOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orbBrightness: number,
  orbSaveCount: number,
): void {
  if (orbSaveCount <= 0) return;

  const orbSize = 1 + Math.min(1, orbSaveCount / 6);
  const orbAlpha = 0.3 + orbBrightness * 0.7;
  const r = 255;
  const g = Math.round(200 + orbBrightness * 55);
  const b = Math.round(100 + orbBrightness * 80);

  ctx.save();
  ctx.globalAlpha = orbAlpha;
  px(ctx, x + 0.5, y - 3, Math.ceil(orbSize), Math.ceil(orbSize), `rgb(${r},${g},${b})`);

  // Glow
  if (orbBrightness > 0.3) {
    const glowR = 2 + orbBrightness * 2;
    const grad = ctx.createRadialGradient(
      (x + 0.5) * PIXEL_SCALE, (y - 3) * PIXEL_SCALE, 0,
      (x + 0.5) * PIXEL_SCALE, (y - 3) * PIXEL_SCALE, glowR * PIXEL_SCALE,
    );
    grad.addColorStop(0, `rgba(255,200,100,${0.15 * orbBrightness})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(
      (x + 0.5 - glowR) * PIXEL_SCALE,
      (y - 3 - glowR) * PIXEL_SCALE,
      glowR * 2 * PIXEL_SCALE,
      glowR * 2 * PIXEL_SCALE,
    );
  }
  ctx.restore();
}

/** Draw idle standby golem (dimmed) */
export function drawGolemIdle(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteData,
  time: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.5;
  drawGolemSprite(ctx, sprite, time);
  ctx.restore();
}

// ── PR3: Milestone Celebrations ──

export interface MilestoneParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  startTime: number;
  color: string;
}

export interface MilestoneCelebration {
  teamX: number;
  teamY: number;
  fireSize: number;
  teamColor: string;
  startTime: number;
  particles: MilestoneParticle[];
}

/** Create a milestone celebration with particle burst */
export function createMilestoneCelebration(
  teamX: number,
  teamY: number,
  fireSize: number,
  teamColor: string,
  time: number,
): MilestoneCelebration {
  const particles: MilestoneParticle[] = [];
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    particles.push({
      x: teamX,
      y: teamY - 10,
      vx: Math.cos(angle) * (15 + Math.random() * 10),
      vy: -20 - Math.random() * 15,
      startTime: time,
      color: Math.random() > 0.5 ? '#f0e8a0' : '#ffffff',
    });
  }
  return { teamX, teamY, fireSize, teamColor, startTime: time, particles };
}

/** Draw milestone celebration (jumping sprites handled separately) */
export function drawMilestoneCelebration(
  ctx: CanvasRenderingContext2D,
  celebration: MilestoneCelebration,
  time: number,
): void {
  const elapsed = time - celebration.startTime;

  // Flag
  if (elapsed < MILESTONE_JUMP_DURATION + 2.0) {
    const flagX = celebration.teamX + celebration.fireSize * 5 + 8;
    const flagY = celebration.teamY - 2;
    // Pole
    px(ctx, flagX, flagY - 6, 1, 6, '#5a4a3a');
    // Flag
    px(ctx, flagX + 1, flagY - 6, 4, 2, celebration.teamColor);
    px(ctx, flagX + 1, flagY - 5, 3, 1, darken(celebration.teamColor, 0.7));
  }

  // Particles with gravity
  for (const p of celebration.particles) {
    const pe = time - p.startTime;
    if (pe >= MILESTONE_PARTICLE_DURATION) continue;
    const progress = pe / MILESTONE_PARTICLE_DURATION;
    const alpha = 1 - progress;
    const gravity = 20 * pe * pe;
    const pxPos = p.x + p.vx * pe;
    const pyPos = p.y + p.vy * pe + gravity;

    ctx.save();
    ctx.globalAlpha = alpha;
    px(ctx, pxPos, pyPos, 1, 1, p.color);
    ctx.restore();
  }
}

/** Check if milestone celebration is expired */
export function isMilestoneExpired(celebration: MilestoneCelebration, time: number): boolean {
  return time - celebration.startTime >= MILESTONE_PARTICLE_DURATION + 1.0;
}
