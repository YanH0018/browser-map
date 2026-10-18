import { describe, expect, it } from 'vitest';
import { nextSelectedTabId, type NavDirection } from '../lib/keyboardNav';
import type { WorkspaceTab } from '../lib/types';

/** Minimal tab fixture: only identity + position matter to the reducer. */
function tab(tabId: number, x: number, y: number): WorkspaceTab {
  return {
    tabId,
    windowId: 1,
    title: `Tab ${tabId}`,
    url: `https://example.com/${tabId}`,
    domain: 'example.com',
    pinned: false,
    active: false,
    position: { x, y },
  };
}

describe('nextSelectedTabId (spatial-nearest arrow navigation, D12)', () => {
  it('returns null when there are no visible tabs', () => {
    for (const dir of ['up', 'down', 'left', 'right'] as NavDirection[]) {
      expect(nextSelectedTabId([], [], dir)).toBeNull();
    }
  });

  it('selects the first visible tab (list order) when nothing is selected', () => {
    const tabs = [tab(7, 500, 400), tab(3, 80, 80)];
    expect(nextSelectedTabId(tabs, [], 'right')).toBe(7);
  });

  it('treats a selection that is not in the visible list as unselected', () => {
    // E.g. the selected card was hidden by a search filter.
    const tabs = [tab(7, 500, 400), tab(3, 80, 80)];
    expect(nextSelectedTabId(tabs, [99], 'down')).toBe(7);
  });

  it('moves right to the nearest card in front, not a closer drifting one', () => {
    const current = tab(1, 0, 0);
    const drifting = tab(2, 100, 90); // closer but far off-axis
    const straight = tab(3, 200, 0); // farther but straight ahead
    expect(nextSelectedTabId([current, drifting, straight], [1], 'right')).toBe(3);
  });

  it('moves left / up / down symmetrically', () => {
    const current = tab(1, 200, 200);
    const left = tab(2, 40, 200);
    const up = tab(3, 200, 60);
    const down = tab(4, 200, 380);
    expect(nextSelectedTabId([current, left, up, down], [1], 'left')).toBe(2);
    expect(nextSelectedTabId([current, left, up, down], [1], 'up')).toBe(3);
    expect(nextSelectedTabId([current, left, up, down], [1], 'down')).toBe(4);
  });

  it('stays put when no card lies in the pressed direction', () => {
    const current = tab(1, 0, 0); // leftmost card
    const rightOfIt = tab(2, 300, 0);
    expect(nextSelectedTabId([current, rightOfIt], [1], 'left')).toBe(1);
    expect(nextSelectedTabId([current, rightOfIt], [1], 'up')).toBe(1);
  });

  it('ignores cards exactly on the perpendicular (zero forward projection)', () => {
    const current = tab(1, 0, 0);
    const directlyAbove = tab(2, 0, -150); // forward == 0 for "right"
    expect(nextSelectedTabId([current, directlyAbove], [1], 'right')).toBe(1);
  });

  it('prefers the straight-ahead card over a nearer diagonal one', () => {
    const current = tab(1, 0, 0);
    const diagonal = tab(2, 50, 60); // nearer but drifting
    const straight = tab(3, 0, 100); // straight down
    expect(nextSelectedTabId([current, diagonal, straight], [1], 'down')).toBe(3);
  });

  it('breaks exact score ties deterministically by smaller tabId', () => {
    const current = tab(1, 0, 0);
    const upper = tab(9, 100, -50); // symmetric scores for "right"
    const lower = tab(4, 100, 50);
    expect(nextSelectedTabId([current, upper, lower], [1], 'right')).toBe(4);
  });

  it('navigates across a scattered layout like a spatial canvas', () => {
    // Row 0: A(80,80) B(360,80); row 1: C(80,280) D(360,280).
    const a = tab(1, 80, 80);
    const b = tab(2, 360, 80);
    const c = tab(3, 80, 280);
    const d = tab(4, 360, 280);
    const tabs = [a, b, c, d];

    // From A: right → B (same row beats the diagonal C).
    expect(nextSelectedTabId(tabs, [1], 'right')).toBe(2);
    // From B: down → D (same column beats the diagonal A… i.e. C).
    expect(nextSelectedTabId(tabs, [2], 'down')).toBe(4);
    // From D: left → C.
    expect(nextSelectedTabId(tabs, [4], 'left')).toBe(3);
    // From C: up → A.
    expect(nextSelectedTabId(tabs, [3], 'up')).toBe(1);
  });

  it('handles float positions from user drags without NaN scores', () => {
    const current = tab(1, 80.3721, 280.914);
    const target = tab(2, 360.5, 281.0);
    expect(nextSelectedTabId([current, target], [1], 'right')).toBe(2);
  });
});
