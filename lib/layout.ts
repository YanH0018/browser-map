import type { Position } from './types';

/**
 * Placement for tabs that have no persisted position yet.
 * Simple cascade so first-run cards do not all stack at the origin;
 * real layout algorithms are a later milestone (M6).
 */
export function nextFreePosition(index: number): Position {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 80 + col * 280, y: 80 + row * 200 };
}
