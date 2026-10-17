import { storage } from 'wxt/utils/storage';
import type { NamedSnapshot, WorkspaceSnapshot } from './types';
import { deserializeWorkspace } from './persistence';
import { deserializeNamedSnapshots } from './namedSnapshots';

/**
 * Storage I/O layer. MVP backend: browser.storage.local.
 * IndexedDB migration only when richer data (snapshots history,
 * embeddings, thumbnails) actually arrives — see docs/DECISIONS.md.
 */
const snapshotItem = storage.defineItem<unknown>('local:workspaceSnapshot', {
  fallback: null,
});

export async function saveSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
  await snapshotItem.setValue(snapshot);
}

export async function loadSnapshot(): Promise<WorkspaceSnapshot | null> {
  const raw = await snapshotItem.getValue();
  return deserializeWorkspace(raw);
}

const namedSnapshotsItem = storage.defineItem<unknown>('local:namedSnapshots', {
  fallback: [],
});

export async function saveNamedSnapshots(snapshots: NamedSnapshot[]): Promise<void> {
  await namedSnapshotsItem.setValue(snapshots);
}

export async function loadNamedSnapshots(): Promise<NamedSnapshot[]> {
  const raw = await namedSnapshotsItem.getValue();
  return deserializeNamedSnapshots(raw);
}
