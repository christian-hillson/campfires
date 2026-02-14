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
  const glowR = baseR + size * 4;
  ctx.save();
  const gradient = ctx.createRadialGradient(
    cx * PIXEL_SCALE,
    cy * PIXEL_SCALE,
    0,
    cx * PIXEL_SCALE,
    cy * PIXEL_SCALE,
    glowR * PIXEL_SCALE,
  );
  gradient.addColorStop(0, teamColor + '18');
  gradient.addColorStop(0.5, teamColor + '08');
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
