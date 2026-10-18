/**
 * Core data model (see docs/ARCHITECTURE.md).
 *
 * Tab identity is tabId-first (D9): persisted state carries the live
 * tabId so a navigating tab keeps its position and cluster. URL is
 * display data plus a fallback for v1 snapshots (no tabId) and stale
 * ids after browser restarts.
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** A browser tab normalized into workspace-domain terms. */
export interface WorkspaceTab {
  /** Ephemeral browser tab id; valid only within the current session. */
  tabId: number;
  windowId: number;

  title: string;
  url: string;
  domain: string;
  faviconUrl?: string;

  pinned: boolean;
  active: boolean;

  position: Position;
  clusterId?: string;
}

/** A named spatial grouping of tab cards on the canvas. */
export interface WorkspaceCluster {
  id: string;
  name: string;
  position: Position;
  size: Size;
}

/** Session-stable subset of a tab, persisted across browser restarts. */
export interface PersistedTabMetadata {
  /** Live tab id when known; absent in v1 snapshots (URL fallback). */
  tabId?: number;
  url: string;
  title: string;
  position: Position;
  clusterId?: string;
}

/** The serialized workspace written to browser.storage.local. */
export interface WorkspaceSnapshot {
  version: number;
  tabs: PersistedTabMetadata[];
  clusters: WorkspaceCluster[];
  viewport: Viewport;
}

/**
 * A user-named saved layout (M3). Captures the canvas state at save
 * time; restoring it never opens or closes real browser tabs.
 */
export interface NamedSnapshot {
  id: string;
  name: string;
  /** Epoch ms when the snapshot was (last) saved. */
  createdAt: number;
  tabs: PersistedTabMetadata[];
  clusters: WorkspaceCluster[];
  viewport: Viewport;
}

/** v2 (M4): persisted tabs carry tabId; matching is tabId-first. */
export const SNAPSHOT_VERSION = 2;

/** Snapshot versions this build can load (v1 migrates via URL fallback). */
export const ACCEPTED_SNAPSHOT_VERSIONS: readonly number[] = [1, SNAPSHOT_VERSION];

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
