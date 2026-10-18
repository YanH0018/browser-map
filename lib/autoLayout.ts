import type { Position, Size, WorkspaceCluster, WorkspaceTab } from './types';
import { overlapArea } from './clusterDrop';

/**
 * Pure automatic-layout algorithms (M6). Deterministic: same input →
 * same output, no Date.now/Math.random. The store applies the results;
 * UI only wires buttons to store actions (see docs/ARCHITECTURE.md).
 */

export interface TidyGridOptions {
  /** Cards per row. */
  columns: number;
  origin: Position;
  columnWidth: number;
  rowHeight: number;
}

/** Default grid geometry (matches the first-run cascade in lib/layout.ts). */
export const TIDY_GRID_DEFAULTS: TidyGridOptions = {
  columns: 4,
  origin: { x: 80, y: 80 },
  columnWidth: 280,
  rowHeight: 140,
};

/** Grid slot (row-major) for a linear index. */
export function gridSlot(index: number, opts: TidyGridOptions = TIDY_GRID_DEFAULTS): Position {
  const col = index % opts.columns;
  const row = Math.floor(index / opts.columns);
  return { x: opts.origin.x + col * opts.columnWidth, y: opts.origin.y + row * opts.rowHeight };
}

/**
 * Reading order of the current arrangement: sort by the grid cell each
 * card currently sits in (nearest-cell rounding), row-major. Ties break
 * on x, then y, then tabId — deterministic even when two cards share a
 * cell and independent of input array order.
 */
export function readingOrder(
  tabs: readonly WorkspaceTab[],
  opts: TidyGridOptions = TIDY_GRID_DEFAULTS,
): WorkspaceTab[] {
  const cellOf = (t: WorkspaceTab) => ({
    row: Math.round((t.position.y - opts.origin.y) / opts.rowHeight),
    col: Math.round((t.position.x - opts.origin.x) / opts.columnWidth),
  });
  return [...tabs].sort((a, b) => {
    const ca = cellOf(a);
    const cb = cellOf(b);
    if (ca.row !== cb.row) return ca.row - cb.row;
    if (ca.col !== cb.col) return ca.col - cb.col;
    if (a.position.x !== b.position.x) return a.position.x - b.position.x;
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    return a.tabId - b.tabId;
  });
}

/**
 * Tidy grid (M6 item 1): snap every card onto a regular grid in reading
 * order of the current positions. Cluster membership is purely logical
 * (D16): clustered cards get grid slots like any other card and cluster
 * frames are not moved. Returns a tabId → position map covering every
 * input tab; no two cards share a slot.
 */
export function tidyGridPositions(
  tabs: readonly WorkspaceTab[],
  opts: Partial<TidyGridOptions> = {},
): Map<number, Position> {
  const options: TidyGridOptions = { ...TIDY_GRID_DEFAULTS, ...opts };
  const positions = new Map<number, Position>();
  readingOrder(tabs, options).forEach((t, i) => positions.set(t.tabId, gridSlot(i, options)));
  return positions;
}

/** Fallback group name for tabs without a parseable domain (chrome://, data:). */
export const OTHER_DOMAIN_NAME = 'Other';

/** Default frame size for auto-created domain clusters (same as manual). */
export const DOMAIN_CLUSTER_SIZE: Size = { width: 360, height: 260 };

/** Cascade geometry for auto-created domain clusters. */
const DOMAIN_CLUSTER_ORIGIN: Position = { x: 80, y: 80 };
const DOMAIN_CLUSTER_PITCH_X = 420; // cluster width + gap
const DOMAIN_CLUSTER_PITCH_Y = 320; // cluster height + gap
const DOMAIN_CLUSTER_COLUMNS = 3;

export interface DomainGroupResult {
  /** New clusters to add. Existing clusters are never touched (D17). */
  newClusters: WorkspaceCluster[];
  /** tabId → clusterId assignments for previously unclustered tabs. */
  assignments: Map<number, string>;
}

function clusterSlot(index: number): Position {
  const col = index % DOMAIN_CLUSTER_COLUMNS;
  const row = Math.floor(index / DOMAIN_CLUSTER_COLUMNS);
  return {
    x: DOMAIN_CLUSTER_ORIGIN.x + col * DOMAIN_CLUSTER_PITCH_X,
    y: DOMAIN_CLUSTER_ORIGIN.y + row * DOMAIN_CLUSTER_PITCH_Y,
  };
}

/** First cascade slot (from `startSlot`) that does not overlap any taken frame. */
function nextFreeClusterPosition(taken: readonly WorkspaceCluster[], startSlot: number): Position {
  for (let i = startSlot; ; i++) {
    const slot = clusterSlot(i);
    const candidate = { x: slot.x, y: slot.y, width: DOMAIN_CLUSTER_SIZE.width, height: DOMAIN_CLUSTER_SIZE.height };
    const overlaps = taken.some(
      (c) => overlapArea(candidate, { x: c.position.x, y: c.position.y, width: c.size.width, height: c.size.height }) > 0,
    );
    if (!overlaps) return slot;
  }
}

/** Stable id that does not collide with existing or already-created clusters. */
function uniqueClusterId(base: string, taken: readonly WorkspaceCluster[]): string {
  let id = base;
  for (let n = 2; taken.some((c) => c.id === id); n++) {
    id = `${base}-${n}`;
  }
  return id;
}

/**
 * Group by domain (M6 item 2): one new cluster per distinct domain among
 * UNCLUSTERED tabs, named after the domain (tabs without a parseable
 * domain group under "Other"). Existing clusters are never touched and
 * tabs already in a cluster keep their assignment. New clusters cascade
 * into the first free slots that do not overlap existing frames; ids are
 * stable (`cluster-domain-<domain>`, numeric suffix on collision) and the
 * result is deterministic (domains sorted by name, code-unit order).
 */
export function groupByDomain(
  tabs: readonly WorkspaceTab[],
  clusters: readonly WorkspaceCluster[],
): DomainGroupResult {
  const byDomain = new Map<string, WorkspaceTab[]>();
  for (const t of tabs) {
    if (t.clusterId !== undefined) continue; // existing assignments untouched
    const name = t.domain || OTHER_DOMAIN_NAME;
    const list = byDomain.get(name);
    if (list) list.push(t);
    else byDomain.set(name, [t]);
  }

  const newClusters: WorkspaceCluster[] = [];
  const assignments = new Map<number, string>();
  let slotIndex = 0;

  for (const name of [...byDomain.keys()].sort()) {
    const members = byDomain.get(name)!;
    const taken = [...clusters, ...newClusters];
    const cluster: WorkspaceCluster = {
      id: uniqueClusterId(`cluster-domain-${name}`, taken),
      name,
      position: nextFreeClusterPosition(taken, slotIndex),
      size: { ...DOMAIN_CLUSTER_SIZE },
    };
    newClusters.push(cluster);
    slotIndex++;
    for (const t of members) assignments.set(t.tabId, cluster.id);
  }

  return { newClusters, assignments };
}
