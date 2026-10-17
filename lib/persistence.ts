import type {
  WorkspaceCluster,
  WorkspaceSnapshot,
  WorkspaceTab,
} from './types';
import { DEFAULT_VIEWPORT, SNAPSHOT_VERSION } from './types';

/**
 * Persistence is split in two layers:
 *  - pure (de)serialization here, unit-testable without a browser;
 *  - storage I/O in workspaceStorage.ts, the only module touching
 *    browser.storage.local.
 *
 * Tabs are persisted as PersistedTabMetadata keyed conceptually by URL,
 * never by ephemeral tabId.
 */
export function serializeWorkspace(
  tabs: WorkspaceTab[],
  clusters: WorkspaceCluster[],
  viewport: WorkspaceSnapshot['viewport'],
): WorkspaceSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    tabs: tabs.map((t) => ({
      url: t.url,
      title: t.title,
      position: t.position,
      clusterId: t.clusterId,
    })),
    clusters,
    viewport,
  };
}

/** Parse an untrusted stored value; returns null when unusable. */
export function deserializeWorkspace(raw: unknown): WorkspaceSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const snapshot = raw as Partial<WorkspaceSnapshot>;
  if (snapshot.version !== SNAPSHOT_VERSION) return null;
  if (!Array.isArray(snapshot.tabs) || !Array.isArray(snapshot.clusters)) return null;
  return {
    version: SNAPSHOT_VERSION,
    tabs: snapshot.tabs,
    clusters: snapshot.clusters,
    viewport: snapshot.viewport ?? DEFAULT_VIEWPORT,
  };
}

/**
 * Merge persisted positions/cluster assignments onto freshly queried tabs.
 * Accepts anything carrying PersistedTabMetadata (WorkspaceSnapshot or
 * NamedSnapshot); tabs not open in the browser are simply absent.
 */
export function applySnapshotToTabs(
  tabs: WorkspaceTab[],
  snapshot: Pick<WorkspaceSnapshot, 'tabs'>,
): WorkspaceTab[] {
  const byUrl = new Map(snapshot.tabs.map((t) => [t.url, t]));
  return tabs.map((tab) => {
    const persisted = byUrl.get(tab.url);
    if (!persisted) return tab;
    return { ...tab, position: persisted.position, clusterId: persisted.clusterId };
  });
}
