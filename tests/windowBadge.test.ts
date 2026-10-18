import { describe, expect, it } from 'vitest';
import { windowBadges, windowHue, type WindowedTabLike } from '../lib/windowBadge';

/** Build a minimal windowed tab for badge tests. */
function tab(windowId: number): WindowedTabLike {
  return { windowId };
}

describe('windowBadges', () => {
  it('returns an empty map for a single window (no badge noise)', () => {
    const tabs = [tab(1), tab(1), tab(1)];
    expect(windowBadges(tabs).size).toBe(0);
  });

  it('returns an empty map for no tabs', () => {
    expect(windowBadges([]).size).toBe(0);
  });

  it('labels two windows W1/W2 by ascending windowId, not tab order', () => {
    // Tab order puts the higher window id first; labels must not follow it.
    const tabs = [tab(42), tab(7), tab(42)];
    const badges = windowBadges(tabs);

    expect(badges.size).toBe(2);
    expect(badges.get(7)?.label).toBe('W1');
    expect(badges.get(42)?.label).toBe('W2');
  });

  it('assigns a stable hue per window id in [0, 360)', () => {
    const badges = windowBadges([tab(7), tab(42)]);
    for (const badge of badges.values()) {
      expect(badge.hue).toBeGreaterThanOrEqual(0);
      expect(badge.hue).toBeLessThan(360);
    }
    // Deterministic: same input, same output.
    const again = windowBadges([tab(42), tab(7)]);
    expect(badges.get(7)?.hue).toBe(again.get(7)?.hue);
    expect(badges.get(42)?.hue).toBe(again.get(42)?.hue);
  });

  it('ignores unknown window ids (-1) when computing the set', () => {
    // One known window + unknowns → still single-window mode, no badges.
    expect(windowBadges([tab(1), tab(-1)]).size).toBe(0);
    // All unknown → no badges.
    expect(windowBadges([tab(-1), tab(-1)]).size).toBe(0);
  });

  it('keeps unknown-window tabs badge-less while known windows get badges', () => {
    const badges = windowBadges([tab(1), tab(2), tab(-1)]);
    expect(badges.size).toBe(2);
    expect(badges.get(-1)).toBeUndefined();
  });

  it('renumbers deterministically when a window disappears', () => {
    const withThree = windowBadges([tab(1), tab(2), tab(3)]);
    expect(withThree.get(3)?.label).toBe('W3');

    const afterClose = windowBadges([tab(1), tab(2)]);
    expect(afterClose.get(1)?.label).toBe('W1');
    expect(afterClose.get(2)?.label).toBe('W2');
  });

  it('windowHue is stable and distinct for common window ids', () => {
    expect(windowHue(1)).toBe(windowHue(1));
    // A handful of real-ish ids should not all collide on one hue.
    const hues = new Set([1, 2, 3, 42, 987654].map(windowHue));
    expect(hues.size).toBeGreaterThan(1);
  });
});
