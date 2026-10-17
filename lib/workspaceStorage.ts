import { storage } from 'wxt/utils/storage';
import type { WorkspaceSnapshot } from './types';
import { deserializeWorkspace } from './persistence';

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
