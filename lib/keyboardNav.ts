import type { WorkspaceTab } from './types';

/**
 * Keyboard navigation between tab cards (M5 item 1 — see docs/DECISIONS.md
 * D12). Pure geometry: given the visible tabs, the current selection and an
 * arrow direction, returns the tabId that should become selected. The UI
 * layer (useKeyboardNav) wires this to key events; Enter/Escape live there
 * because they touch the browser adapter / store, not geometry.
 */

export type NavDirection = 'up' | 'down' | 'left' | 'right';

/** Unit direction vectors in flow coordinates (y grows downward). */
const DIRECTIONS: Record<NavDirection, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Numerical slop for float comparisons (positions are user-dragged floats). */
const EPS = 1e-9;

/**
 * Next selection for an arrow-key press (spatial-nearest rule, D12).
 *
 * From the current card, candidates are cards whose position lies in front
 * of the arrow (positive projection onto the direction vector). Among them,
 * the one minimizing `distance × (1 + |perpendicular| / forward)` wins:
 * cards straight ahead beat closer-but-drifting ones. Ties break on the
 * smaller tabId so navigation is deterministic.
 *
 * - No visible tabs → null.
 * - Nothing (visible) selected → the first visible tab in list order.
 * - No candidate in that direction → selection stays put (no wrap-around).
 *
 * Cards are uniform-sized, so top-left positions give the same relative
 * vectors as center-to-center math.
 */
export function nextSelectedTabId(
  tabs: readonly WorkspaceTab[],
  selectedTabIds: readonly number[],
  direction: NavDirection,
): number | null {
  if (tabs.length === 0) return null;

  const current = tabs.find((t) => t.tabId === selectedTabIds[0]);
  if (!current) return tabs[0]!.tabId;

  const [dx, dy] = DIRECTIONS[direction];
  let best: WorkspaceTab | undefined;
  let bestScore = Infinity;

  for (const tab of tabs) {
    if (tab.tabId === current.tabId) continue;
    const vx = tab.position.x - current.position.x;
    const vy = tab.position.y - current.position.y;
    const forward = vx * dx + vy * dy; // > 0: in front of the arrow
    if (forward <= EPS) continue;
    const perp = Math.abs(vx * dy - vy * dx); // sideways drift (dir is unit)
    const dist = Math.hypot(vx, vy);
    const score = dist * (1 + perp / forward);
    if (
      score < bestScore - EPS ||
      (score <= bestScore + EPS && tab.tabId < (best?.tabId ?? Infinity))
    ) {
      best = tab;
      bestScore = score;
    }
  }

  return best?.tabId ?? current.tabId; // no candidate → stay put
}
