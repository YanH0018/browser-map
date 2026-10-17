import type {
  NamedSnapshot,
  PersistedTabMetadata,
  Viewport,
  WorkspaceCluster,
  WorkspaceTab,
} from './types';
import { sanitizePersistedTabs } from './tabIdentity';

/**
 * Pure logic for named workspace snapshots (M3). No browser APIs here —
 * storage I/O lives in workspaceStorage.ts, state in the store.
 */

let snapshotCounter = 0;

/** Build a named snapshot from the current canvas state. */
export function createNamedSnapshot(
  name: string,
  tabs: WorkspaceTab[],
  clusters: WorkspaceCluster[],
  viewport: Viewport,
): NamedSnapshot {
  const persistedTabs: PersistedTabMetadata[] = tabs.map((t) => {
    const entry: PersistedTabMetadata = {
      url: t.url,
      title: t.title,
      position: t.position,
    };
    if (t.tabId >= 0) entry.tabId = t.tabId;
    if (t.clusterId !== undefined) entry.clusterId = t.clusterId;
    return entry;
  });
  return {
    id: `snapshot-${Date.now()}-${snapshotCounter++}`,
    name,
    createdAt: Date.now(),
    tabs: persistedTabs,
    clusters,
    viewport,
  };
}

/** True when a value has the shape of one usable named snapshot. */
function isNamedSnapshot(value: unknown): value is NamedSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const snap = value as Partial<NamedSnapshot>;
  return (
    typeof snap.id === 'string' &&
    typeof snap.name === 'string' &&
    Array.isArray(snap.tabs) &&
    Array.isArray(snap.clusters)
  );
}

/** Parse an untrusted stored value; drops unusable entries, keeps order. */
export function deserializeNamedSnapshots(raw: unknown): NamedSnapshot[] {
  if (!Array.isArray(raw)) return [];
  // Sanitize tab entries too: named snapshots are untrusted storage data.
  return raw.filter(isNamedSnapshot).map((snap) => ({
    ...snap,
    tabs: sanitizePersistedTabs(snap.tabs),
  }));
}
