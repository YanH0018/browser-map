/**
 * Multi-window badges (M4 item 3 — see docs/DECISIONS.md D11).
 *
 * Tabs from every window appear on the canvas; a small badge on each card
 * tells which window it belongs to. Badges are derived, never stored:
 * labels W1..Wn are assigned by ascending windowId (deterministic,
 * independent of tab order), and each window gets a stable hue. With only
 * one known window no badges are shown — the label would be pure noise.
 */

/** Per-window display info for one card's badge. */
export interface WindowBadge {
  windowId: number;
  /** Stable ordinal label, e.g. "W2". */
  label: string;
  /** Deterministic hue (0-360) for the badge color. */
  hue: number;
}

/** Structural subset of WorkspaceTab that the badge math needs. */
export interface WindowedTabLike {
  windowId: number;
}

/** Deterministic hue (0-360) derived from a window id. */
export function windowHue(windowId: number): number {
  const s = String(windowId);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/**
 * Compute badges for the windows present in `tabs`.
 * Returns an empty map when fewer than two distinct known windows exist.
 */
export function windowBadges(tabs: readonly WindowedTabLike[]): Map<number, WindowBadge> {
  const ids = new Set<number>();
  for (const tab of tabs) {
    if (tab.windowId >= 0) ids.add(tab.windowId);
  }
  const out = new Map<number, WindowBadge>();
  if (ids.size < 2) return out; // Single window: badges would be noise.

  const sorted = [...ids].sort((a, b) => a - b);
  sorted.forEach((windowId, i) => {
    out.set(windowId, { windowId, label: `W${i + 1}`, hue: windowHue(windowId) });
  });
  return out;
}
