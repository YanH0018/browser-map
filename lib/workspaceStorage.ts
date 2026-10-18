import { storage } from 'wxt/utils/storage';
import type { NamedSnapshot, WorkspaceSnapshot } from './types';
import { deserializeWorkspace } from './persistence';
import { deserializeNamedSnapshots } from './namedSnapshots';
import { deserializeEmbeddingCache } from './embeddings';

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

/**
 * Embedding vector cache keyed by URL (M7 item 2): reloads never re-embed.
 * Stored separately from the workspace snapshot so a layout restore can
 * never wipe or corrupt vectors.
 */
const embeddingCacheItem = storage.defineItem<unknown>('local:embeddingCache', {
  fallback: {},
});

export async function loadEmbeddingCache(): Promise<Map<string, number[]>> {
  const raw = await embeddingCacheItem.getValue();
  return deserializeEmbeddingCache(raw);
}

export async function saveEmbeddingCache(cache: ReadonlyMap<string, number[]>): Promise<void> {
  await embeddingCacheItem.setValue(Object.fromEntries(cache));
}
