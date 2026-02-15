import type { FireLevelMultipliers, FireLevel } from './animation-constants.js';
import { PULSE_DURATION, PULSE_RADIUS_MULT, SPARK_ARC_HEIGHT } from './animation-constants.js';
import type { PulseRing } from './fire-state.js';

// Low-level pixel art drawing helpers

export const PIXEL_SCALE = 3;
export const GROUND_COLOR = '#1a2018';
export const GRASS_COLORS = ['#1e2a1c', '#1c261a', '#22301e', '#1a2418'];
export const PATH_COLOR = '#2a2820';
export const TREE_TRUNK = '#3a2a1a';
export const TREE_LEAVES = ['#2a4a22', '#1e3a18', '#325828'];

// Team colors assigned by index
export const TEAM_COLORS = [
  '#f97316',
  '#60a5fa',
  '#a78bfa',
  '#4ade80',
  '#f472b6',
  '#facc15',
  '#34d399',
  '#fb923c',
];

export function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.floor(x * PIXEL_SCALE),
    Math.floor(y * PIXEL_SCALE),
    w * PIXEL_SCALE,
    h * PIXEL_SCALE,
  );
}

export function darken(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

export function drawCampfire(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  teamColor: string,
  time: number,
  glowMultiplier: number = 1.0,
  fireMultipliers?: FireLevelMultipliers,
): void {
  const fm = fireMultipliers || { height: 1, sparks: 1, flicker: 1, glow: 1, embers: 1, flames: 1 };
  const baseR = size * 5 + 4;

  // Stone ring
  for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
    const r = baseR + Math.sin(angle * 3) * 1.5;
    px(ctx, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.5, 2, 2, '#3a3830');
  }

  // Logs
  px(ctx, cx - 3, cy + 1, 6, 1, '#4a3020');
  px(ctx, cx - 2, cy - 1, 5, 1, '#3a2818');
  if (size > 1) {
    px(ctx, cx - 4, cy, 3, 1, '#4a3020');
    px(ctx, cx + 2, cy + 2, 3, 1, '#3a2818');
  }

  // Embers (scaled by fire multiplier)
  const emberCount = Math.round((size * 3 + 2) * fm.embers);
  for (let i = 0; i < emberCount; i++) {
    const angle = (i / emberCount) * Math.PI * 2 + time * 0.5;
    const r = 2 + Math.sin(time * 3 + i) * 1.5;
    const ex = cx + Math.cos(angle) * r;
    const ey = cy + Math.sin(angle) * r * 0.4;
    px(ctx, ex, ey, 1, 1, Math.random() > 0.3 ? '#f06020' : '#f0a030');
  }

  // Fire (height and flame count scaled)
  const fireHeight = Math.round((size * 4 + 3) * fm.height);
  const flames = Math.round((size * 2 + 2) * (fm.flames || 1));
  const flickerSpeed = 8 * fm.flicker;
  for (let f = 0; f < flames; f++) {
    const fx = cx - size + f * ((size * 2) / flames);
    for (let fy = 0; fy < fireHeight; fy++) {
      const t = fy / fireHeight;
      const flicker = Math.sin(time * flickerSpeed + f * 2 + fy * 0.5) * (1 + t * 2);
      const width = (1 - t) * (size + 1) + flicker * 0.3;
      if (width > 0.3) {
        let color: string;
        if (t < 0.3) color = '#f0e8a0';
        else if (t < 0.5) color = '#f0c040';
        else if (t < 0.7) color = '#f08020';
        else color = teamColor;
        px(ctx, fx + flicker * 0.5, cy - fy - 2, Math.max(1, width), 1, color);
      }
    }
  }

  // Sparks (count scaled)
  const sparkCount = Math.round(size * fm.sparks);
  if (sparkCount >= 1) {
    for (let s = 0; s < sparkCount; s++) {
      const sparkT = (time * 2 + s * 1.7) % 3;
      if (sparkT < 2) {
        const sparkSpread = (3 + size) * fm.sparks;
        const sx = cx + Math.sin(time * 3 + s * 5) * sparkSpread;
        const sy = cy - fireHeight - sparkT * 8;
        px(ctx, sx, sy, 1, 1, Math.random() > 0.5 ? '#f0c040' : '#f0e8a0');
      }
    }
  }

  // Glow on ground (scaled by fire glow multiplier)
  const effectiveGlow = glowMultiplier * fm.glow;
  const glowR = (baseR + size * 4) * effectiveGlow;
  ctx.save();
  const gradient = ctx.createRadialGradient(
    cx * PIXEL_SCALE,
    cy * PIXEL_SCALE,
    0,
    cx * PIXEL_SCALE,
    cy * PIXEL_SCALE,
    glowR * PIXEL_SCALE,
  );
  const glowAlpha = Math.min(0xff, Math.round(0x18 * effectiveGlow));
  const midAlpha = Math.min(0xff, Math.round(0x08 * effectiveGlow));
  gradient.addColorStop(0, teamColor + glowAlpha.toString(16).padStart(2, '0'));
  gradient.addColorStop(0.5, teamColor + midAlpha.toString(16).padStart(2, '0'));
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(
    (cx - glowR) * PIXEL_SCALE,
    (cy - glowR) * PIXEL_SCALE,
    glowR * 2 * PIXEL_SCALE,
    glowR * 2 * PIXEL_SCALE,
  );
  ctx.restore();
}

export function drawTeamLabel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  name: string,
  fireSize: number,
): void {
  ctx.save();
  ctx.font = '10px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5a6a4aaa';
  ctx.fillText(name, cx * PIXEL_SCALE, (cy + fireSize * 6 + 14) * PIXEL_SCALE);
  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    width * 0.3,
    width / 2,
    height / 2,
    width * 0.7,
  );
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, '#0a0e0a88');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// ============================================
// Day/Night Cycle (120-second period)
// ============================================

const DAY_NIGHT_PERIOD = 120; // seconds

export interface DayNightState {
  phase: 'night' | 'dawn' | 'day' | 'dusk';
  ambientAlpha: number;
  ambientColor: string;
  glowMultiplier: number;
}

function lerpHexColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

export function computeDayNight(time: number): DayNightState {
  const cycle = ((time % DAY_NIGHT_PERIOD) + DAY_NIGHT_PERIOD) % DAY_NIGHT_PERIOD;
  const t = cycle / DAY_NIGHT_PERIOD; // 0..1

  const nightColor = '#0a1030';
  const dawnColor = '#c09040';
  const dayColor = '#d0c090';

  if (t < 0.2) {
    // Night
    return { phase: 'night', ambientAlpha: 0.35, ambientColor: nightColor, glowMultiplier: 2.0 };
  } else if (t < 0.3) {
    // Dawn: night → day
    const dt = (t - 0.2) / 0.1;
    return {
      phase: 'dawn',
      ambientAlpha: 0.35 + (0.05 - 0.35) * dt,
      ambientColor: lerpHexColor(nightColor, dawnColor, dt),
      glowMultiplier: 2.0 + (1.0 - 2.0) * dt,
    };
  } else if (t < 0.7) {
    // Day
    return { phase: 'day', ambientAlpha: 0.05, ambientColor: dayColor, glowMultiplier: 1.0 };
  } else if (t < 0.8) {
    // Dusk: day → night
    const dt = (t - 0.7) / 0.1;
    return {
      phase: 'dusk',
      ambientAlpha: 0.05 + (0.35 - 0.05) * dt,
      ambientColor: lerpHexColor(dawnColor, nightColor, dt),
      glowMultiplier: 1.0 + (2.0 - 1.0) * dt,
    };
  } else {
    // Night
    return { phase: 'night', ambientAlpha: 0.35, ambientColor: nightColor, glowMultiplier: 2.0 };
  }
}

export function drawDayNightOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: DayNightState,
): void {
  if (state.ambientAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = state.ambientAlpha;
  ctx.fillStyle = state.ambientColor;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Draw deterministic twinkling stars during night and dusk phases */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  mapWidth: number,
  mapHeight: number,
  state: DayNightState,
  time: number,
): void {
  if (state.phase !== 'night' && state.phase !== 'dusk') return;

  const starAlpha = state.phase === 'night' ? 1.0 : state.glowMultiplier - 1.0; // fade in during dusk
  if (starAlpha <= 0) return;

  ctx.save();
  const upperBound = mapHeight * 0.4;

  for (let i = 0; i < 60; i++) {
    // Deterministic positions using seed
    const seed = i * 7919;
    const sx = ((seed * 13) % (mapWidth * 100)) / 100;
    const sy = ((seed * 17) % (upperBound * 100)) / 100;

    // Twinkle
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * (1.5 + (i % 5) * 0.3) + seed));
    const alpha = starAlpha * twinkle;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = i % 7 === 0 ? '#a0c0f0' : '#e0e0d0';
    ctx.fillRect(
      Math.floor(sx * PIXEL_SCALE),
      Math.floor(sy * PIXEL_SCALE),
      PIXEL_SCALE,
      PIXEL_SCALE,
    );
  }
  ctx.restore();
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function drawPulseRing(
  ctx: CanvasRenderingContext2D,
  ring: PulseRing,
  time: number,
  teamColor: string,
  fireLevel: FireLevel,
  fireSize: number,
): void {
  const elapsed = time - ring.startTime;
  if (elapsed >= PULSE_DURATION) return;

  const progress = elapsed / PULSE_DURATION;
  const maxRadius = (fireSize * 5 + 4) * PULSE_RADIUS_MULT[fireLevel];
  const radius = maxRadius * progress;
  const alpha = (1 - progress) * 0.3;

  ctx.save();
  ctx.beginPath();
  ctx.arc(ring.x * PIXEL_SCALE, ring.y * PIXEL_SCALE, radius * PIXEL_SCALE, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(teamColor, alpha);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// ============================================
// Spark Arc Drawing
// ============================================

const SPARK_COLOR = '#fbbf24'; // amber

/** Quadratic bezier point at parameter t */
function bezierPoint(
  t: number,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
    y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
  };
}

export function drawSparkArc(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  progress: number,
  time: number,
): void {
  // Bezier control point at elevated midpoint
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2 - SPARK_ARC_HEIGHT;

  // Opacity: fade in 0-0.2, hold 0.2-0.7, fade out 0.7-1.0
  let opacity: number;
  if (progress < 0.2) opacity = progress / 0.2;
  else if (progress < 0.7) opacity = 1.0;
  else opacity = 1.0 - (progress - 0.7) / 0.3;

  ctx.save();
  ctx.globalAlpha = opacity * 0.7;

  // Draw dashed arc line
  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.moveTo(fromX * PIXEL_SCALE, fromY * PIXEL_SCALE);
  ctx.quadraticCurveTo(
    midX * PIXEL_SCALE,
    midY * PIXEL_SCALE,
    toX * PIXEL_SCALE,
    toY * PIXEL_SCALE,
  );
  ctx.strokeStyle = SPARK_COLOR;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw ember particles traveling along the bezier
  const particleCount = 4;
  for (let i = 0; i < particleCount; i++) {
    const t = (progress * 2 + i / particleCount) % 1;
    if (t > progress * 1.5) continue; // particles appear progressively
    const pt = bezierPoint(t, fromX, fromY, midX, midY, toX, toY);
    const size = 1 + Math.sin(time * 5 + i * 2) * 0.5;
    const pAlpha = opacity * (0.6 + 0.4 * Math.sin(time * 8 + i * 3));
    ctx.globalAlpha = pAlpha;
    px(ctx, pt.x - size / 2, pt.y - size / 2, Math.ceil(size), Math.ceil(size), SPARK_COLOR);
  }

  // Flash at destination when progress > 0.8
  if (progress > 0.8) {
    const flashAlpha = (1 - (progress - 0.8) / 0.2) * 0.5;
    ctx.globalAlpha = flashAlpha;
    const flashR = 4 * PIXEL_SCALE;
    const gradient = ctx.createRadialGradient(
      toX * PIXEL_SCALE,
      toY * PIXEL_SCALE,
      0,
      toX * PIXEL_SCALE,
      toY * PIXEL_SCALE,
      flashR,
    );
    gradient.addColorStop(0, SPARK_COLOR);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(
      (toX - 4) * PIXEL_SCALE,
      (toY - 4) * PIXEL_SCALE,
      8 * PIXEL_SCALE,
      8 * PIXEL_SCALE,
    );
  }

  ctx.restore();
}

export function drawSparkBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  fireSize: number,
  elapsed: number,
): void {
  // Pulse opacity between 0.6 and 1.0
  const pulseAlpha = 0.6 + 0.4 * Math.abs(Math.sin(elapsed * 2));

  ctx.save();
  ctx.globalAlpha = pulseAlpha;

  // Lightning bolt glyph above team label
  const bx = cx + fireSize * 3 + 6;
  const by = cy + fireSize * 6 + 8;

  // Pixel-art lightning bolt (3x5 px)
  px(ctx, bx + 1, by, 2, 1, SPARK_COLOR);
  px(ctx, bx, by + 1, 2, 1, SPARK_COLOR);
  px(ctx, bx - 1, by + 2, 3, 1, SPARK_COLOR);
  px(ctx, bx, by + 3, 2, 1, SPARK_COLOR);
  px(ctx, bx - 1, by + 4, 2, 1, SPARK_COLOR);

  ctx.restore();
}
