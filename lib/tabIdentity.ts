import type { PersistedTabMetadata, Position } from './types';

/**
 * Tab identity resolution (M4 — see docs/DECISIONS.md D9).
 *
 * Live tabs are matched against persisted state by tabId first, so a tab
 * that navigates keeps its position and cluster. URL is only a fallback:
 * for entries whose tabId is unknown (v1 snapshots) or stale (the tab was
 * closed and a new one opened). Each persisted entry is consumed at most
 * once, so duplicate URLs never alias two cards onto one arrangement.
 */

/** A live tab the matcher can key on (WorkspaceTab satisfies this). */
export interface LiveTabLike {
  tabId: number;
  url: string;
}

/** Sanitize one untrusted persisted tab entry; null when unusable. */
export function sanitizePersistedTab(raw: unknown): PersistedTabMetadata | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.url !== 'string') return null;
  const p = e.position;
  if (typeof p !== 'object' || p === null) return null;
  const pos = p as Record<string, unknown>;
  if (typeof pos.x !== 'number' || !Number.isFinite(pos.x)) return null;
  if (typeof pos.y !== 'number' || !Number.isFinite(pos.y)) return null;

  const out: PersistedTabMetadata = {
    url: e.url,
    title: typeof e.title === 'string' ? e.title : '',
    position: { x: pos.x, y: pos.y } satisfies Position,
  };
  if (typeof e.tabId === 'number' && Number.isInteger(e.tabId) && e.tabId >= 0) {
    out.tabId = e.tabId;
  }
  if (typeof e.clusterId === 'string' && e.clusterId.length > 0) {
    out.clusterId = e.clusterId;
  }
  return out;
}

/** Sanitize a list of untrusted persisted entries, dropping unusable ones. */
export function sanitizePersistedTabs(raw: unknown): PersistedTabMetadata[] {
  if (!Array.isArray(raw)) return [];
  const out: PersistedTabMetadata[] = [];
  for (const entry of raw) {
    const clean = sanitizePersistedTab(entry);
    if (clean !== null) out.push(clean);
  }
  return out;
}

/**
 * Merge persisted position/cluster state onto live tabs.
 * tabId match wins; URL fallback only for entries whose tabId is unknown
 * or no longer live. Tabs without persisted state are returned unchanged.
 */
export function resolveTabState<T extends LiveTabLike>(live: T[], persistedRaw: unknown): T[] {
  const persisted = sanitizePersistedTabs(persistedRaw);
  const liveIds = new Set(live.map((t) => t.tabId));

  const byTabId = new Map<number, PersistedTabMetadata>();
  for (const entry of persisted) {
    if (entry.tabId !== undefined && !byTabId.has(entry.tabId)) byTabId.set(entry.tabId, entry);
  }

  const consumed = new Set<PersistedTabMetadata>();

  return live.map((tab) => {
    const byId = tab.tabId >= 0 ? byTabId.get(tab.tabId) : undefined;
    if (byId !== undefined && !consumed.has(byId)) {
      consumed.add(byId);
      return { ...tab, position: byId.position, clusterId: byId.clusterId };
    }

    // URL fallback: entries with an unknown tabId (v1) or a stale one.
    const byUrl = persisted.find(
      (e) => !consumed.has(e) && e.url === tab.url && (e.tabId === undefined || !liveIds.has(e.tabId)),
    );
    if (byUrl !== undefined) {
      consumed.add(byUrl);
      return { ...tab, position: byUrl.position, clusterId: byUrl.clusterId };
    }

    return tab;
  });
}
