import { describe, expect, it } from 'vitest';
import { resolveTabState, sanitizePersistedTab, sanitizePersistedTabs } from '../lib/tabIdentity';
import type { LiveTabLike } from '../lib/tabIdentity';

/** Live tab fixture with an explicit default position ("unarranged"). */
const live = (
  tabId: number,
  url: string,
): LiveTabLike & { position: { x: number; y: number }; clusterId?: string } => ({
  tabId,
  url,
  position: { x: 0, y: 0 },
});

describe('sanitizePersistedTab', () => {
  it('keeps valid entries, normalizing optional fields', () => {
    expect(
      sanitizePersistedTab({ tabId: 7, url: 'https://a.example.com', title: 'A', position: { x: 1, y: 2 } }),
    ).toEqual({ tabId: 7, url: 'https://a.example.com', title: 'A', position: { x: 1, y: 2 } });
  });

  it('drops junk entries (null, missing url, bad position, negative tabId)', () => {
    expect(sanitizePersistedTab(null)).toBeNull();
    expect(sanitizePersistedTab('junk')).toBeNull();
    expect(sanitizePersistedTab({ url: 'https://a.example.com' })).toBeNull();
    expect(sanitizePersistedTab({ url: 42, position: { x: 0, y: 0 } })).toBeNull();
    expect(sanitizePersistedTab({ url: 'u', position: { x: NaN, y: 0 } })).toBeNull();
    expect(sanitizePersistedTab({ url: 'u', position: { x: 0, y: 0 }, tabId: -1 })).toEqual({
      url: 'u',
      title: '',
      position: { x: 0, y: 0 },
    });
  });

  it('drops non-integer and negative tabIds, keeps zero', () => {
    expect(sanitizePersistedTab({ url: 'u', position: { x: 0, y: 0 }, tabId: 1.5 })).toEqual({
      url: 'u',
      title: '',
      position: { x: 0, y: 0 },
    });
    expect(sanitizePersistedTab({ url: 'u', position: { x: 0, y: 0 }, tabId: 0 })?.tabId).toBe(0);
  });

  it('sanitizePersistedTabs drops unusable entries, keeps order', () => {
    const raw = [null, { url: 'a', position: { x: 0, y: 1 } }, 'junk', { url: 'b', position: { x: 2, y: 3 } }];
    expect(sanitizePersistedTabs(raw)).toHaveLength(2);
    expect(sanitizePersistedTabs('not an array')).toEqual([]);
  });
});

describe('resolveTabState — tabId-first matching', () => {
  it('preserves position and cluster when the tab navigated (URL changed)', () => {
    const liveTabs = [live(5, 'https://new.example.com/page')];
    const persisted = [{ tabId: 5, url: 'https://old.example.com/', title: 'Old', position: { x: 400, y: 300 }, clusterId: 'c1' }];
    const merged = resolveTabState(liveTabs, persisted);
    expect(merged[0]?.position).toEqual({ x: 400, y: 300 });
    expect(merged[0]?.clusterId).toBe('c1');
  });

  it('tabId match wins over a URL collision with another tab', () => {
    // Tab 5 navigated away from U; a brand-new tab 7 opened on U.
    const liveTabs = [live(5, 'https://v.example.com'), live(7, 'https://u.example.com')];
    const persisted = [{ tabId: 5, url: 'https://u.example.com', title: '', position: { x: 10, y: 20 } }];
    const merged = resolveTabState(liveTabs, persisted);
    expect(merged[0]?.position).toEqual({ x: 10, y: 20 }); // follows tab identity
    expect(merged[1]?.position).toEqual({ x: 0, y: 0 }); // new tab untouched
  });

  it('leaves tabs without persisted state unchanged', () => {
    const liveTabs = [live(9, 'https://fresh.example.com')];
    const merged = resolveTabState(liveTabs, []);
    expect(merged[0]).toEqual({ tabId: 9, url: 'https://fresh.example.com', position: { x: 0, y: 0 } });
  });

  it('tolerates unknown tabId (-1) on the live side via URL fallback', () => {
    const liveTabs = [live(-1, 'https://u.example.com')];
    const persisted = [{ tabId: 5, url: 'https://u.example.com', title: '', position: { x: 7, y: 8 } }];
    const merged = resolveTabState(liveTabs, persisted);
    expect(merged[0]?.position).toEqual({ x: 7, y: 8 });
  });
});

describe('resolveTabState — URL fallback (migration + stale ids)', () => {
  it('v1 entries without tabId fall back to URL', () => {
    const liveTabs = [live(42, 'https://a.example.com')];
    const persisted = [{ url: 'https://a.example.com', title: 'A', position: { x: 100, y: 50 }, clusterId: 'c9' }];
    const merged = resolveTabState(liveTabs, persisted);
    expect(merged[0]?.position).toEqual({ x: 100, y: 50 });
    expect(merged[0]?.clusterId).toBe('c9');
  });

  it('stale tabIds (tab closed, new tab on same URL) fall back to URL', () => {
    const liveTabs = [live(7, 'https://a.example.com')];
    const persisted = [{ tabId: 5, url: 'https://a.example.com', title: '', position: { x: 100, y: 50 } }];
    const merged = resolveTabState(liveTabs, persisted);
    expect(merged[0]?.position).toEqual({ x: 100, y: 50 });
  });

  it('a live tabId match never falls through to URL for another entry', () => {
    // Entry A (tabId 5, live) and entry B (no tabId) share URL U;
    // only one card may receive each arrangement.
    const liveTabs = [live(5, 'https://u.example.com'), live(6, 'https://u.example.com')];
    const persisted = [
      { tabId: 5, url: 'https://u.example.com', title: '', position: { x: 1, y: 1 } },
      { url: 'https://u.example.com', title: '', position: { x: 2, y: 2 } },
    ];
    const merged = resolveTabState(liveTabs, persisted);
    expect(merged[0]?.position).toEqual({ x: 1, y: 1 });
    expect(merged[1]?.position).toEqual({ x: 2, y: 2 });
  });

  it('duplicate live URLs consume a v1 entry at most once', () => {
    const liveTabs = [live(5, 'https://u.example.com'), live(6, 'https://u.example.com')];
    const persisted = [{ url: 'https://u.example.com', title: '', position: { x: 3, y: 4 } }];
    const merged = resolveTabState(liveTabs, persisted);
    expect(merged[0]?.position).toEqual({ x: 3, y: 4 });
    expect(merged[1]?.position).toEqual({ x: 0, y: 0 });
  });

  it('ignores junk persisted entries', () => {
    const liveTabs = [live(5, 'https://u.example.com')];
    const merged = resolveTabState(liveTabs, [null, 'junk', { position: { x: 1, y: 2 } }, undefined]);
    expect(merged[0]).toEqual({ tabId: 5, url: 'https://u.example.com', position: { x: 0, y: 0 } });
  });
});
