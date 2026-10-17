import { describe, expect, it } from 'vitest';
import { clusterRects, overlapArea, resolveClusterDrop } from '../lib/clusterDrop';
import type { ClusterRect } from '../lib/clusterDrop';

const card = (x: number, y: number) => ({ x, y, width: 240, height: 68 });

const cluster = (id: string, x: number, y: number, width = 360, height = 260): ClusterRect => ({
  id,
  x,
  y,
  width,
  height,
});

describe('overlapArea', () => {
  it('measures full containment', () => {
    expect(overlapArea(card(0, 0), cluster('a', -10, -10))).toBe(240 * 68);
  });

  it('measures partial overlap', () => {
    // Card (0,0,240x68) vs cluster starting at x=120: overlap 120 wide, 68 tall.
    expect(overlapArea(card(0, 0), cluster('a', 120, 0))).toBe(120 * 68);
  });

  it('is zero for disjoint and edge-touching rects', () => {
    expect(overlapArea(card(0, 0), cluster('a', 240, 0))).toBe(0); // touching edge
    expect(overlapArea(card(0, 0), cluster('a', 300, 300))).toBe(0);
    expect(overlapArea(card(0, 0), cluster('a', -500, -500))).toBe(0);
  });
});

describe('resolveClusterDrop', () => {
  it('assigns a card dropped inside a cluster', () => {
    expect(resolveClusterDrop(card(50, 50), [cluster('a', 0, 0)])).toBe('a');
  });

  it('unassigns a card dropped in open space', () => {
    expect(resolveClusterDrop(card(1000, 1000), [cluster('a', 0, 0)])).toBeUndefined();
    expect(resolveClusterDrop(card(50, 50), [])).toBeUndefined();
  });

  it('picks the largest overlap when several clusters intersect', () => {
    // Card overlaps both; cluster 'b' covers more of it.
    const clusters = [cluster('a', 0, 0), cluster('b', 100, 20)];
    expect(resolveClusterDrop(card(150, 30), clusters)).toBe('b');
  });

  it('ignores edge-touching contact (no strict intersection)', () => {
    expect(resolveClusterDrop(card(0, 0), [cluster('a', 240, 0)])).toBeUndefined();
    expect(resolveClusterDrop(card(0, 0), [cluster('a', 0, 68)])).toBeUndefined();
  });

  it('builds cluster rects from workspace state', () => {
    const rects = clusterRects([
      { id: 'c1', position: { x: 10, y: 20 }, size: { width: 360, height: 260 } },
    ]);
    expect(rects).toEqual([{ id: 'c1', x: 10, y: 20, width: 360, height: 260 }]);
    expect(resolveClusterDrop(card(15, 25), rects)).toBe('c1');
  });
});
