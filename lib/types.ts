/**
 * Core data model (see docs/ARCHITECTURE.md).
 *
 * Browser tab IDs are ephemeral: they change between browser sessions.
 * Persistent workspace state must therefore key off more stable metadata
 * (URL + title) rather than tabId alone.
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

export const SNAPSHOT_VERSION = 1;

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
