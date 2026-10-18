import { describe, expect, it } from 'vitest';
import { applyTabEvent, applyTabEvents, type TabEvent } from '../lib/tabEvents';
import { nextFreePosition, nextFreePositionFor } from '../lib/layout';
import type { WorkspaceTab } from '../lib/types';

/** Build a minimal workspace tab for reducer tests. */
function tab(overrides: Partial<WorkspaceTab> & { tabId: number }): WorkspaceTab {
  return {
    windowId: 1,
    title: 'Example',
    url: 'https://example.com/',
    domain: 'example.com',
    pinned: false,
    active: false,
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('applyTabEvent — created', () => {
  it('adds a new card at the next free position without overlap', () => {
    const tabs = [
      tab({ tabId: 1, position: nextFreePosition(0) }),
      tab({ tabId: 2, position: nextFreePosition(1) }),
    ];
    const result = applyTabEvent(tabs, [], {
      kind: 'created',
      tab: { id: 3, windowId: 1, title: 'News', url: 'https://news.ycombinator.com/', active: true },
    });

    expect(result.tabs).toHaveLength(3);
    const fresh = result.tabs[2]!;
    expect(fresh.tabId).toBe(3);
    expect(fresh.title).toBe('News');
    expect(fresh.domain).toBe('news.ycombinator.com');
    expect(fresh.active).toBe(true);
    // No two cards share a position (uniform card size ⇒ no overlap).
    const keys = result.tabs.map((t) => `${t.position.x}:${t.position.y}`);
    expect(new Set(keys).size).toBe(result.tabs.length);
  });

  it('is idempotent for a duplicate created event', () => {
    const tabs = [tab({ tabId: 1 })];
    const event: TabEvent = { kind: 'created', tab: { id: 1, url: 'https://example.com/' } };
    const once = applyTabEvent(tabs, [], event);
    expect(once.tabs).toHaveLength(1); // already known → no-op
  });

  it('skips tabs without a usable id', () => {
    const result = applyTabEvent([], [], { kind: 'created', tab: { url: 'https://example.com/' } });
    expect(result.tabs).toHaveLength(0);
  });

  it('falls back to the URL when the created tab has no title yet', () => {
    const result = applyTabEvent([], [], {
      kind: 'created',
      tab: { id: 9, url: 'https://example.org/page' },
    });
    expect(result.tabs[0]!.title).toBe('https://example.org/page');
  });
});

describe('applyTabEvent — removed', () => {
  it('removes the card and cleans up its selection; other tabs untouched', () => {
    const tabs = [tab({ tabId: 1, clusterId: 'c1' }), tab({ tabId: 2 })];
    const result = applyTabEvent(tabs, [1], { kind: 'removed', tabId: 1 });
    expect(result.tabs.map((t) => t.tabId)).toEqual([2]);
    expect(result.selectedTabIds).toEqual([]);
  });

  it('is a no-op for an unknown tabId', () => {
    const tabs = [tab({ tabId: 1 })];
    const result = applyTabEvent(tabs, [1], { kind: 'removed', tabId: 99 });
    expect(result.tabs).toBe(tabs); // same reference: nothing changed
  });

  it('leaves clusters alone (they live in a separate store slice)', () => {
    // The reducer only touches tabs + selection; cluster state is never
    // read or written here, so a removed card simply loses its assignment.
    const tabs = [tab({ tabId: 1, clusterId: 'c1' })];
    const result = applyTabEvent(tabs, [], { kind: 'removed', tabId: 1 });
    expect(result.tabs).toEqual([]);
  });
});

describe('applyTabEvent — updated', () => {
  it('updates url/title in place, preserving position and cluster (M4 core)', () => {
    const tabs = [tab({ tabId: 1, position: { x: 420, y: 80 }, clusterId: 'c1' })];
    const result = applyTabEvent(tabs, [1], {
      kind: 'updated',
      tabId: 1,
      changeInfo: { url: 'https://news.ycombinator.com/', title: 'Hacker News' },
    });

    expect(result.tabs).toHaveLength(1);
    const updated = result.tabs[0]!;
    expect(updated.url).toBe('https://news.ycombinator.com/');
    expect(updated.title).toBe('Hacker News');
    expect(updated.domain).toBe('news.ycombinator.com');
    expect(updated.position).toEqual({ x: 420, y: 80 }); // preserved
    expect(updated.clusterId).toBe('c1'); // preserved
  });

  it('applies only the defined changeInfo fields', () => {
    const tabs = [tab({ tabId: 1, faviconUrl: 'https://example.com/icon.png' })];
    const result = applyTabEvent(tabs, [], { kind: 'updated', tabId: 1, changeInfo: { pinned: true } });
    expect(result.tabs[0]!.pinned).toBe(true);
    expect(result.tabs[0]!.faviconUrl).toBe('https://example.com/icon.png'); // untouched
    expect(result.tabs[0]!.url).toBe('https://example.com/'); // untouched
  });

  it('falls back to the URL for an empty title (page still loading)', () => {
    const tabs = [tab({ tabId: 1, title: 'Old' })];
    const result = applyTabEvent(tabs, [], { kind: 'updated', tabId: 1, changeInfo: { title: '' } });
    expect(result.tabs[0]!.title).toBe('https://example.com/');
  });

  it('is a no-op for an unknown tabId (e.g. the extension own page)', () => {
    const tabs = [tab({ tabId: 1 })];
    const result = applyTabEvent(tabs, [], { kind: 'updated', tabId: 99, changeInfo: { title: 'x' } });
    expect(result.tabs).toBe(tabs);
  });

  it('is a no-op when nothing user-visible changed', () => {
    const tabs = [tab({ tabId: 1 })];
    const result = applyTabEvent(tabs, [], {
      kind: 'updated',
      tabId: 1,
      changeInfo: { title: 'Example', url: 'https://example.com/' },
    });
    expect(result.tabs).toBe(tabs);
  });
});

describe('applyTabEvent — activated', () => {
  it('selection follows the real active tab', () => {
    const tabs = [tab({ tabId: 1 }), tab({ tabId: 2 })];
    const result = applyTabEvent(tabs, [1], { kind: 'activated', windowId: 1, tabId: 2 });
    expect(result.selectedTabIds).toEqual([2]);
    expect(result.tabs).toBe(tabs); // tabs untouched
  });

  it('clears selection when the activated tab has no card (own page)', () => {
    const tabs = [tab({ tabId: 1 })];
    const result = applyTabEvent(tabs, [1], { kind: 'activated', windowId: 2, tabId: 77 });
    expect(result.selectedTabIds).toEqual([]);
  });
});

describe('applyTabEvents — debounced bursts', () => {
  it('applies a burst in order: created → updated → activated', () => {
    const events: TabEvent[] = [
      { kind: 'created', tab: { id: 5, windowId: 1, url: 'about:blank' } },
      { kind: 'updated', tabId: 5, changeInfo: { url: 'https://example.net/', title: 'Net' } },
      { kind: 'activated', windowId: 1, tabId: 5 },
    ];
    const result = applyTabEvents([], [], events);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0]!.title).toBe('Net');
    // Position from creation survives the in-place update.
    expect(result.tabs[0]!.position).toEqual(nextFreePosition(0));
    expect(result.selectedTabIds).toEqual([5]);
  });

  it('a tab opened and closed inside one burst nets to zero', () => {
    const tabs = [tab({ tabId: 1 })];
    const events: TabEvent[] = [
      { kind: 'created', tab: { id: 6, url: 'https://example.com/' } },
      { kind: 'removed', tabId: 6 },
    ];
    const result = applyTabEvents(tabs, [], events);
    expect(result.tabs.map((t) => t.tabId)).toEqual([1]);
  });

  it('restoring a window (many created events) yields one card each, no overlap', () => {
    const tabs = [tab({ tabId: 1, position: nextFreePosition(0) })];
    const events: TabEvent[] = [2, 3, 4].map((id) => ({
      kind: 'created' as const,
      tab: { id, windowId: 2, url: `https://w${id}.example.com/` },
    }));
    const result = applyTabEvents(tabs, [], events);
    expect(result.tabs.map((t) => t.tabId)).toEqual([1, 2, 3, 4]);
    const keys = result.tabs.map((t) => `${t.position.x}:${t.position.y}`);
    expect(new Set(keys).size).toBe(4);
  });
});

describe('nextFreePositionFor', () => {
  it('returns the next cascade slot when it is free', () => {
    const tabs = [tab({ tabId: 1, position: nextFreePosition(0) })];
    expect(nextFreePositionFor(tabs)).toEqual(nextFreePosition(1));
  });

  it('skips cascade slots occupied by dragged cards', () => {
    // A card was dragged onto the slot that index 1 would use.
    const tabs = [tab({ tabId: 1, position: nextFreePosition(0) }), tab({ tabId: 2, position: nextFreePosition(1) })];
    expect(nextFreePositionFor(tabs)).toEqual(nextFreePosition(2));
  });

  it('places the first card at the origin slot', () => {
    expect(nextFreePositionFor([])).toEqual({ x: 80, y: 80 });
  });
});
