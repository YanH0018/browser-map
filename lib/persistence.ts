import type {
  PersistedTabMetadata,
  WorkspaceCluster,
  WorkspaceSnapshot,
  WorkspaceTab,
} from './types';
import { ACCEPTED_SNAPSHOT_VERSIONS, DEFAULT_VIEWPORT, SNAPSHOT_VERSION } from './types';
import { resolveTabState, sanitizePersistedTabs } from './tabIdentity';

/**
 * Persistence is split in two layers:
 *  - pure (de)serialization here, unit-testable without a browser;
 *  - storage I/O in workspaceStorage.ts, the only module touching
 *    browser.storage.local.
 *
 * Tabs are persisted as PersistedTabMetadata keyed by tabId (D9); URL
 * and title are display data plus a fallback for v1 snapshots.
 */
export function serializeWorkspace(
  tabs: WorkspaceTab[],
  clusters: WorkspaceCluster[],
  viewport: WorkspaceSnapshot['viewport'],
): WorkspaceSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    tabs: tabs.map((t) => {
      const entry: PersistedTabMetadata = {
        url: t.url,
        title: t.title,
        position: t.position,
      };
      if (t.tabId >= 0) entry.tabId = t.tabId;
      if (t.clusterId !== undefined) entry.clusterId = t.clusterId;
      return entry;
    }),
    clusters,
    viewport,
  };
}

/**
 * Parse an untrusted stored value; returns null when unusable.
 * Accepts v1 (URL-keyed) and v2 (tabId-keyed) snapshots; the result is
 * normalized to SNAPSHOT_VERSION with sanitized tab entries.
 */
export function deserializeWorkspace(raw: unknown): WorkspaceSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const snapshot = raw as Partial<WorkspaceSnapshot>;
  if (!ACCEPTED_SNAPSHOT_VERSIONS.includes(snapshot.version as number)) return null;
  if (!Array.isArray(snapshot.tabs) || !Array.isArray(snapshot.clusters)) return null;
  return {
    version: SNAPSHOT_VERSION,
    tabs: sanitizePersistedTabs(snapshot.tabs),
    clusters: snapshot.clusters,
    viewport: snapshot.viewport ?? DEFAULT_VIEWPORT,
  };
}

/**
 * Merge persisted positions/cluster assignments onto freshly queried tabs.
 * Accepts anything carrying PersistedTabMetadata (WorkspaceSnapshot or
 * NamedSnapshot); tabs not open in the browser are simply absent.
 * Matching is tabId-first with URL fallback (see lib/tabIdentity.ts).
 */
export function applySnapshotToTabs(
  tabs: WorkspaceTab[],
  snapshot: Pick<WorkspaceSnapshot, 'tabs'>,
): WorkspaceTab[] {
  return resolveTabState(tabs, snapshot.tabs);
}
