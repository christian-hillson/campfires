import { px, GROUND_COLOR, GRASS_COLORS, PATH_COLOR, TREE_TRUNK, TREE_LEAVES } from './renderer.js';
import type { CampfirePosition } from './layout.js';

interface GrassPatch {
  x: number;
  y: number;
  color: string;
  size: number;
}

interface Tree {
  x: number;
  y: number;
  size: number;
  leafColor: string;
  sway: number;
}

interface Decoration {
  x: number;
  y: number;
  type: 'woodpile' | 'barrel' | 'crates' | 'torch';
}

export interface EnvironmentData {
  grass: GrassPatch[];
  trees: Tree[];
  decorations: Decoration[];
}

export function generateEnvironment(
  mapWidth: number,
  mapHeight: number,
  campfires: CampfirePosition[],
): EnvironmentData {
  // Grass patches
  const grass: GrassPatch[] = [];
  for (let i = 0; i < 300; i++) {
    grass.push({
      x: Math.random() * mapWidth,
      y: Math.random() * mapHeight,
      color: GRASS_COLORS[Math.floor(Math.random() * GRASS_COLORS.length)],
      size: Math.random() > 0.7 ? 2 : 1,
    });
  }

  // Trees — avoid campfires
  const trees: Tree[] = [];
  for (let i = 0; i < 25; i++) {
    const tx = Math.random() * (mapWidth - 20) + 10;
    const ty = Math.random() * (mapHeight - 20) + 10;
    const tooClose = campfires.some((c) => Math.hypot(tx - c.x, ty - c.y) < 60);
    if (!tooClose) {
      trees.push({
        x: tx,
        y: ty,
        size: Math.random() * 2 + 2,
        leafColor: TREE_LEAVES[Math.floor(Math.random() * TREE_LEAVES.length)],
        sway: Math.random() * Math.PI * 2,
      });
    }
  }

  // Decorations around campfires
  const decorationTypes: Array<'woodpile' | 'barrel' | 'crates' | 'torch'> = [
    'woodpile',
    'barrel',
    'crates',
    'torch',
  ];
  const decorations: Decoration[] = [];
  for (const cf of campfires) {
    const count = Math.min(2 + cf.fireSize, 5);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 22 + cf.fireSize * 4 + Math.random() * 8;
      decorations.push({
        x: cf.x + Math.cos(angle) * dist,
        y: cf.y + Math.sin(angle) * dist * 0.6,
        type: decorationTypes[i % decorationTypes.length],
      });
    }
  }

  return { grass, trees, decorations };
}

export function drawGround(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grass: GrassPatch[],
): void {
  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  for (const g of grass) {
    px(ctx, g.x, g.y, g.size, g.size, g.color);
  }
}

export function drawPath(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t + Math.sin(t * 6) * 4;
    const y = y1 + (y2 - y1) * t + Math.cos(t * 4) * 3;
    px(ctx, x + Math.random() * 2, y + Math.random() * 2, 2, 1, PATH_COLOR);
    px(ctx, x + Math.random() * 2, y + 1 + Math.random(), 2, 1, '#252218');
  }
}

export function drawTree(ctx: CanvasRenderingContext2D, tree: Tree, time: number): void {
  const { x, y, size, leafColor, sway } = tree;
  const s = Math.sin(time * 0.8 + sway) * 0.3;

  // Trunk
  px(ctx, x, y - size * 2, 1, size * 3, TREE_TRUNK);
  px(ctx, x + 1, y - size * 2, 1, size * 3, '#4a3a2a');

  // Canopy
  for (let dy = -size * 2 - 3; dy < -size; dy++) {
    const w = Math.max(1, size * 2 - Math.abs(dy + size * 2));
    px(ctx, x - w / 2 + s, y + dy, w, 1, leafColor);
  }

  // Highlight
  px(ctx, x - 1 + s, y - size * 2 - 2, 2, 1, '#3a6830');
}

export function drawWorkstation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: string,
  time: number,
): void {
  if (type === 'woodpile') {
    for (let i = 0; i < 3; i++) {
      px(ctx, x + i * 2, y + 1, 2, 1, '#5a3820');
      px(ctx, x + i * 2, y, 2, 1, '#6a4830');
    }
    px(ctx, x, y + 2, 6, 1, '#4a2818');
  } else if (type === 'barrel') {
    px(ctx, x, y, 3, 3, '#5a4030');
    px(ctx, x, y, 3, 1, '#6a5040');
    px(ctx, x + 1, y + 1, 1, 1, '#7a6050');
  } else if (type === 'crates') {
    px(ctx, x, y, 2, 2, '#6a5830');
    px(ctx, x + 2, y + 1, 2, 2, '#5a4820');
    px(ctx, x + 1, y - 1, 2, 2, '#7a6840');
  } else if (type === 'torch') {
    px(ctx, x, y, 1, 3, '#4a3020');
    const flicker = Math.sin(time * 7) * 0.5;
    px(ctx, x + flicker, y - 2, 1, 1, '#f0a030');
    px(ctx, x + flicker, y - 1, 1, 1, '#f06020');
  }
}
