import { px, darken } from './renderer.js';
import type { SpriteData } from './layout.js';

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
      px(ctx, x + 3 + (time * 2 % 3), bY, 1, 1, '#3a3020');
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
