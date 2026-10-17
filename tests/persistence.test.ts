import { describe, expect, it } from 'vitest';
import {
  applySnapshotToTabs,
  deserializeWorkspace,
  serializeWorkspace,
} from '../lib/persistence';
import { DEFAULT_VIEWPORT, SNAPSHOT_VERSION } from '../lib/types';
import type { WorkspaceTab } from '../lib/types';

const tab = (over: Partial<WorkspaceTab>): WorkspaceTab => ({
  tabId: 1,
  windowId: 1,
  title: 'T',
  url: 'https://a.example.com',
  domain: 'a.example.com',
  pinned: false,
  active: false,
  position: { x: 10, y: 20 },
  ...over,
});

describe('serializeWorkspace / deserializeWorkspace round-trip', () => {
  it('persists metadata keyed by tabId (D9)', () => {
    const snapshot = serializeWorkspace(
      [tab({ tabId: 42, clusterId: 'c1' })],
      [{ id: 'c1', name: 'ML', position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }],
      { x: 5, y: 6, zoom: 1.5 },
    );
    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.tabs[0]).toMatchObject({ url: 'https://a.example.com', clusterId: 'c1', tabId: 42 });

    const restored = deserializeWorkspace(JSON.parse(JSON.stringify(snapshot)));
    expect(restored).toEqual(snapshot);
  });

  it('rejects wrong versions and malformed input', () => {
    expect(deserializeWorkspace(null)).toBeNull();
    expect(deserializeWorkspace('junk')).toBeNull();
    expect(deserializeWorkspace({ version: 999, tabs: [], clusters: [] })).toBeNull();
  });

  it('fills a default viewport when missing', () => {
    const restored = deserializeWorkspace({ version: SNAPSHOT_VERSION, tabs: [], clusters: [] });
    expect(restored?.viewport).toEqual(DEFAULT_VIEWPORT);
  });
});

describe('applySnapshotToTabs', () => {
  it('restores position and cluster (URL fallback for stale tabId)', () => {
    const live = [tab({ tabId: 99, position: { x: 0, y: 0 } })];
    const snapshot = serializeWorkspace(
      [tab({ position: { x: 400, y: 300 }, clusterId: 'c1' })],
      [],
      DEFAULT_VIEWPORT,
    );
    const merged = applySnapshotToTabs(live, snapshot);
    expect(merged[0]?.tabId).toBe(99); // live id preserved
    expect(merged[0]?.position).toEqual({ x: 400, y: 300 });
    expect(merged[0]?.clusterId).toBe('c1');
  });

  it('leaves unknown URLs untouched', () => {
    const live = [tab({ url: 'https://new.example.com' })];
    const snapshot = serializeWorkspace([tab({})], [], DEFAULT_VIEWPORT);
    const merged = applySnapshotToTabs(live, snapshot);
    expect(merged[0]?.position).toEqual({ x: 10, y: 20 });
  });
});
