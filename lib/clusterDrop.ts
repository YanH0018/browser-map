import type { Position, Size } from './types';

/** Axis-aligned rectangle in flow coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A cluster's drop target area, identified for assignment. */
export interface ClusterRect extends Rect {
  id: string;
}

/** Overlap area of two rects; 0 when they do not strictly intersect. */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Resolve which cluster a dropped tab card belongs to: the one with the
 * largest strict overlap. Returns undefined when the card lands outside
 * every cluster (i.e. it should be unassigned).
 */
export function resolveClusterDrop(dragged: Rect, clusters: ClusterRect[]): string | undefined {
  let bestId: string | undefined;
  let bestArea = 0;
  for (const cluster of clusters) {
    const area = overlapArea(dragged, cluster);
    if (area > bestArea) {
      bestArea = area;
      bestId = cluster.id;
    }
  }
  return bestId;
}

/** Build the drop-target rects for all clusters from workspace state. */
export function clusterRects(clusters: { id: string; position: Position; size: Size }[]): ClusterRect[] {
  return clusters.map((c) => ({
    id: c.id,
    x: c.position.x,
    y: c.position.y,
    width: c.size.width,
    height: c.size.height,
  }));
}
