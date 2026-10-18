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

/**
 * Next cascade slot that no existing card occupies. Cards are uniform in
 * size, so a free position (no two cards sharing x/y) means no overlap.
 * Used when a live tab event creates a fresh card (M4 item 2).
 */
export function nextFreePositionFor(tabs: readonly { position: Position }[]): Position {
  const taken = new Set(tabs.map((t) => `${t.position.x}:${t.position.y}`));
  for (let index = tabs.length; ; index++) {
    const position = nextFreePosition(index);
    if (!taken.has(`${position.x}:${position.y}`)) return position;
  }
}
