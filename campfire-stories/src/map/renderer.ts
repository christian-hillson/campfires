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
): void {
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

  // Embers
  const emberCount = size * 3 + 2;
  for (let i = 0; i < emberCount; i++) {
    const angle = (i / emberCount) * Math.PI * 2 + time * 0.5;
    const r = 2 + Math.sin(time * 3 + i) * 1.5;
    const ex = cx + Math.cos(angle) * r;
    const ey = cy + Math.sin(angle) * r * 0.4;
    px(ctx, ex, ey, 1, 1, Math.random() > 0.3 ? '#f06020' : '#f0a030');
  }

  // Fire
  const fireHeight = size * 4 + 3;
  const flames = size * 2 + 2;
  for (let f = 0; f < flames; f++) {
    const fx = cx - size + f * ((size * 2) / flames);
    for (let fy = 0; fy < fireHeight; fy++) {
      const t = fy / fireHeight;
      const flicker = Math.sin(time * 8 + f * 2 + fy * 0.5) * (1 + t * 2);
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

  // Sparks
  if (size >= 2) {
    for (let s = 0; s < size; s++) {
      const sparkT = (time * 2 + s * 1.7) % 3;
      if (sparkT < 2) {
        const sx = cx + Math.sin(time * 3 + s * 5) * (3 + size);
        const sy = cy - fireHeight - sparkT * 8;
        px(ctx, sx, sy, 1, 1, Math.random() > 0.5 ? '#f0c040' : '#f0e8a0');
      }
    }
  }

  // Glow on ground
  const glowR = (baseR + size * 4) * glowMultiplier;
  ctx.save();
  const gradient = ctx.createRadialGradient(
    cx * PIXEL_SCALE,
    cy * PIXEL_SCALE,
    0,
    cx * PIXEL_SCALE,
    cy * PIXEL_SCALE,
    glowR * PIXEL_SCALE,
  );
  const glowAlpha = Math.min(0xff, Math.round(0x18 * glowMultiplier));
  const midAlpha = Math.min(0xff, Math.round(0x08 * glowMultiplier));
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
