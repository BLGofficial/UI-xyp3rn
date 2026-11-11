import type { Bounds, Point } from './types';

export type Size = { width: number; height: number };
export type Camera = { x: number; y: number; zoom: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Largest scale at which `bounds` fits inside `box`, capped so small trees are not blown up.
 * @param bounds world-space bounds
 * @param box available screen box
 * @param cap upper limit for the scale
 */
export function fitScale(bounds: Bounds, box: Size, cap: number): number {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  return Math.min(cap, box.width / width, box.height / height);
}

/**
 * Keeps at least `margin` px of the tree on screen. Screen x = origin.x + pan.x + zoom * worldX.
 * @param pan requested pan
 * @param zoom camera zoom
 * @param bounds world-space bounds of the tree
 * @param viewport screen size
 * @param origin screen position of world (0,0) at zero pan
 * @param margin how much of the tree must stay visible
 */
export function clampPan(
  pan: Point,
  zoom: number,
  bounds: Bounds,
  viewport: Size,
  origin: Point,
  margin: number,
): Point {
  return {
    x: clamp(pan.x, margin - origin.x - zoom * bounds.maxX, viewport.width - margin - origin.x - zoom * bounds.minX),
    y: clamp(pan.y, margin - origin.y - zoom * bounds.maxY, viewport.height - margin - origin.y - zoom * bounds.minY),
  };
}

/**
 * Zooms by `factor` while keeping the world point under the pointer fixed on screen.
 * @param camera current camera
 * @param pointer screen position to zoom around
 * @param factor multiplier applied to the zoom
 * @param origin screen position of world (0,0) at zero pan
 * @param min minimum zoom
 * @param max maximum zoom
 */
export function zoomAt(camera: Camera, pointer: Point, factor: number, origin: Point, min: number, max: number): Camera {
  const zoom = clamp(camera.zoom * factor, min, max);
  const worldX = (pointer.x - origin.x - camera.x) / camera.zoom;
  const worldY = (pointer.y - origin.y - camera.y) / camera.zoom;
  return { zoom, x: pointer.x - origin.x - zoom * worldX, y: pointer.y - origin.y - zoom * worldY };
}
