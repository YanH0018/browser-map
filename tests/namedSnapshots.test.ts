import { describe, expect, it } from 'vitest';
import { createNamedSnapshot, deserializeNamedSnapshots } from '../lib/namedSnapshots';
import type { WorkspaceTab } from '../lib/types';

const tab = (over: Partial<WorkspaceTab>): WorkspaceTab => ({
  tabId: 1,
  windowId: 1,
  title: 'T',
  url: 'https://a.example.com',
  domain: 'a.example.com',
  pinned: false,
  active: false,
  position: { x: 0, y: 0 },
  ...over,
});

describe('createNamedSnapshot', () => {
  it('captures canvas state as persisted metadata (tabId-keyed, D9)', () => {
    const snap = createNamedSnapshot(
      'work',
      [tab({ tabId: 7, clusterId: 'c1' })],
      [{ id: 'c1', name: 'ML', position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }],
      { x: 1, y: 2, zoom: 1.5 },
    );
    expect(snap.name).toBe('work');
    expect(typeof snap.id).toBe('string');
    expect(snap.tabs[0]).toMatchObject({ url: 'https://a.example.com', clusterId: 'c1', tabId: 7 });
    expect(snap.clusters).toHaveLength(1);
    expect(snap.viewport).toEqual({ x: 1, y: 2, zoom: 1.5 });
    expect(typeof snap.createdAt).toBe('number');
  });

  it('generates unique ids', () => {
    const a = createNamedSnapshot('a', [], [], { x: 0, y: 0, zoom: 1 });
    const b = createNamedSnapshot('b', [], [], { x: 0, y: 0, zoom: 1 });
    expect(a.id).not.toBe(b.id);
  });
});

describe('deserializeNamedSnapshots', () => {
  it('returns [] for non-array input', () => {
    expect(deserializeNamedSnapshots(null)).toEqual([]);
    expect(deserializeNamedSnapshots('junk')).toEqual([]);
    expect(deserializeNamedSnapshots({ id: 'x' })).toEqual([]);
  });

  it('drops malformed entries and keeps the rest in order', () => {
    const good = createNamedSnapshot('good', [], [], { x: 0, y: 0, zoom: 1 });
    const raw = [
      { id: 'x', name: 'no-tabs' }, // missing tabs/clusters arrays
      { id: 42, name: 'bad-id', tabs: [], clusters: [] },
      good,
    ];
    expect(deserializeNamedSnapshots(raw)).toEqual([good]);
  });
});
