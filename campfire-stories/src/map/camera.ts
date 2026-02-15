// Camera system for zoom & pan

export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 4.0;
export const ZOOM_SPEED = 0.1;

export interface Camera {
  x: number; // world-space center X
  y: number; // world-space center Y
  zoom: number;
}

export function createCamera(mapWidth: number, mapHeight: number): Camera {
  return {
    x: mapWidth / 2,
    y: mapHeight / 2,
    zoom: 1.0,
  };
}

/** Convert screen coordinates to world coordinates */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
  canvasW: number,
  canvasH: number,
  pixelScale: number,
): { wx: number; wy: number } {
  // Reverse the transform: translate to center, then scale
  const wx = (screenX - canvasW / 2) / (camera.zoom * pixelScale) + camera.x;
  const wy = (screenY - canvasH / 2) / (camera.zoom * pixelScale) + camera.y;
  return { wx, wy };
}

/** Clamp camera so the viewport stays within world bounds */
export function clampCamera(
  camera: Camera,
  mapWidth: number,
  mapHeight: number,
  canvasW: number,
  canvasH: number,
  pixelScale: number,
): Camera {
  const halfViewW = canvasW / (2 * camera.zoom * pixelScale);
  const halfViewH = canvasH / (2 * camera.zoom * pixelScale);

  const minX = halfViewW;
  const maxX = mapWidth - halfViewW;
  const minY = halfViewH;
  const maxY = mapHeight - halfViewH;

  return {
    x: maxX > minX ? Math.max(minX, Math.min(maxX, camera.x)) : mapWidth / 2,
    y: maxY > minY ? Math.max(minY, Math.min(maxY, camera.y)) : mapHeight / 2,
    zoom: camera.zoom,
  };
}

/** Apply camera transform to canvas context. Call ctx.restore() after drawing world-space content. */
export function applyCameraTransform(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasW: number,
  canvasH: number,
  pixelScale: number,
): void {
  ctx.save();
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x * pixelScale, -camera.y * pixelScale);
}

/** Smoothly interpolate camera toward target */
export function lerpCamera(
  camera: Camera,
  targetX: number,
  targetY: number,
  targetZoom: number,
  t: number,
): Camera {
  return {
    x: camera.x + (targetX - camera.x) * t,
    y: camera.y + (targetY - camera.y) * t,
    zoom: camera.zoom + (targetZoom - camera.zoom) * t,
  };
}
