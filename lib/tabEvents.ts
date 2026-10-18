import type { WorkspaceTab } from './types';
import { domainFromUrl, normalizeTab, type BrowserTabLike } from './browserAdapter';
import { nextFreePositionFor } from './layout';

/**
 * Live tab event reducers (M4 item 2 — see docs/DECISIONS.md D10).
 *
 * The workspace page subscribes to `tabs.onCreated/onRemoved/onUpdated/
 * onActivated` and folds debounced event batches into the store through
 * these pure functions. Because tab identity is tabId-first (D9), an
 * `updated` event changes a card's text in place while its position and
 * cluster assignment survive.
 *
 * The reducers are browser-agnostic: own-extension tabs are filtered at
 * the listener boundary, and unknown tabIds (e.g. our own page) are no-ops
 * except that `activated` clears the selection, so the canvas always
 * reflects the real active tab.
 */

/** Structural subset of Browser.tabs.OnUpdatedChangeInfo (user-visible fields). */
export interface TabChangeInfoLike {
  title?: string;
  url?: string;
  favIconUrl?: string;
  pinned?: boolean;
}

/** One normalized chrome.tabs event. */
export type TabEvent =
  | { kind: 'created'; tab: BrowserTabLike }
  | { kind: 'removed'; tabId: number }
  | { kind: 'updated'; tabId: number; changeInfo: TabChangeInfoLike }
  | { kind: 'activated'; windowId: number; tabId: number };

/** Store slices touched by the reducers. */
export interface TabEventResult {
  tabs: WorkspaceTab[];
  selectedTabIds: number[];
}

/** Apply a single event to the current tab list + selection. */
export function applyTabEvent(
  tabs: WorkspaceTab[],
  selectedTabIds: number[],
  event: TabEvent,
): TabEventResult {
  switch (event.kind) {
    case 'created':
      return applyCreated(tabs, selectedTabIds, event.tab);
    case 'removed':
      return applyRemoved(tabs, selectedTabIds, event.tabId);
    case 'updated':
      return applyUpdated(tabs, selectedTabIds, event.tabId, event.changeInfo);
    case 'activated':
      return applyActivated(tabs, selectedTabIds, event.tabId);
  }
}

/** Apply a batch of events in order (one debounced flush). */
export function applyTabEvents(
  tabs: WorkspaceTab[],
  selectedTabIds: number[],
  events: readonly TabEvent[],
): TabEventResult {
  let result: TabEventResult = { tabs, selectedTabIds };
  for (const event of events) {
    result = applyTabEvent(result.tabs, result.selectedTabIds, event);
  }
  return result;
}

/** onCreated: new card at the next free position, no overlap. */
function applyCreated(
  tabs: WorkspaceTab[],
  selectedTabIds: number[],
  tab: BrowserTabLike,
): TabEventResult {
  const tabId = tab.id ?? -1;
  // Idempotent: a duplicate created event (or an already-known tab) is a no-op.
  if (tabId < 0 || tabs.some((t) => t.tabId === tabId)) {
    return { tabs, selectedTabIds };
  }
  const fresh = normalizeTab(tab, nextFreePositionFor(tabs));
  return { tabs: [...tabs, fresh], selectedTabIds };
}

/** onRemoved: card disappears with its cluster assignment; clusters stay. */
function applyRemoved(
  tabs: WorkspaceTab[],
  selectedTabIds: number[],
  tabId: number,
): TabEventResult {
  if (!tabs.some((t) => t.tabId === tabId)) return { tabs, selectedTabIds };
  return {
    tabs: tabs.filter((t) => t.tabId !== tabId),
    selectedTabIds: selectedTabIds.filter((id) => id !== tabId),
  };
}

/** onUpdated: text updates in place; position and cluster are preserved. */
function applyUpdated(
  tabs: WorkspaceTab[],
  selectedTabIds: number[],
  tabId: number,
  changeInfo: TabChangeInfoLike,
): TabEventResult {
  const index = tabs.findIndex((t) => t.tabId === tabId);
  const current = index >= 0 ? tabs[index] : undefined;
  if (!current) return { tabs, selectedTabIds }; // Unknown tab (e.g. own page): ignore.

  const url = changeInfo.url ?? current.url;
  // Mirror normalizeTab's fallback: empty title (page still loading) shows the URL.
  const title = changeInfo.title !== undefined ? changeInfo.title || url || 'Untitled' : current.title;
  const faviconUrl =
    changeInfo.favIconUrl !== undefined ? changeInfo.favIconUrl || undefined : current.faviconUrl;
  const pinned = changeInfo.pinned ?? current.pinned;

  if (title === current.title && url === current.url && faviconUrl === current.faviconUrl && pinned === current.pinned) {
    return { tabs, selectedTabIds }; // No user-visible change.
  }

  const updated = [...tabs];
  updated[index] = { ...current, url, title, domain: domainFromUrl(url), faviconUrl, pinned };
  return { tabs: updated, selectedTabIds };
}

/** onActivated: canvas selection follows the real active tab. */
function applyActivated(
  tabs: WorkspaceTab[],
  selectedTabIds: number[],
  tabId: number,
): TabEventResult {
  // The activated tab has no card (e.g. our own extension page) → clear selection.
  const exists = tabs.some((t) => t.tabId === tabId);
  return { tabs, selectedTabIds: exists ? [tabId] : [] };
}