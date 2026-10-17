import type {
  NamedSnapshot,
  PersistedTabMetadata,
  Viewport,
  WorkspaceCluster,
  WorkspaceTab,
} from './types';

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
  const persistedTabs: PersistedTabMetadata[] = tabs.map((t) => ({
    url: t.url,
    title: t.title,
    position: t.position,
    clusterId: t.clusterId,
  }));
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
  return raw.filter(isNamedSnapshot);
}
