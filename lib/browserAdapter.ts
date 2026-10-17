import { browser } from 'wxt/browser';
import type { Position, WorkspaceTab } from './types';
import { nextFreePosition } from './layout';

/**
 * Browser adapter: the only module allowed to talk to browser tab APIs.
 * Everything downstream consumes normalized WorkspaceTab objects so that
 * browser-specific state, workspace state, UI, and persistence stay
 * separated (see docs/ARCHITECTURE.md).
 */

/** Structural subset of Browser.tabs.Tab so pure logic stays testable. */
export interface BrowserTabLike {
  id?: number;
  windowId?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  pinned?: boolean;
  active?: boolean;
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** True when the tab belongs to this extension itself (e.g. workspace.html). */
export function isOwnExtensionTab(url: string | undefined, ownOrigin: string): boolean {
  return !!url && url.startsWith(ownOrigin);
}

/** Normalize one browser tab into a WorkspaceTab. */
export function normalizeTab(tab: BrowserTabLike, position: Position): WorkspaceTab {
  const url = tab.url ?? '';
  return {
    tabId: tab.id ?? -1,
    windowId: tab.windowId ?? -1,
    title: tab.title || url || 'Untitled',
    url,
    domain: domainFromUrl(url),
    faviconUrl: tab.favIconUrl || undefined,
    pinned: tab.pinned ?? false,
    active: tab.active ?? false,
    position,
  };
}

/** Query all open browser tabs and normalize them. */
export async function queryWorkspaceTabs(existing: WorkspaceTab[] = []): Promise<WorkspaceTab[]> {
  const byUrl = new Map(existing.map((t) => [t.url, t]));
  // The extension's own pages (workspace.html etc.) are real tabs too;
  // they must never appear as cards on the canvas.
  const ownOrigin = browser.runtime.getURL('');
  const tabs = await browser.tabs.query({});
  return tabs
    .filter((t) => t.id !== undefined && t.url !== undefined && !isOwnExtensionTab(t.url, ownOrigin))
    .map((t, i) => {
      // Preserve workspace state (position + cluster assignment) for tabs
      // we have seen before; resync must not wipe user arrangement.
      const prior = byUrl.get(t.url!);
      const normalized = normalizeTab(t, prior?.position ?? nextFreePosition(i));
      if (prior?.clusterId !== undefined) normalized.clusterId = prior.clusterId;
      return normalized;
    });
}

/** Activate (focus) a real browser tab. */
export async function activateBrowserTab(tab: WorkspaceTab): Promise<void> {
  await browser.windows.update(tab.windowId, { focused: true });
  await browser.tabs.update(tab.tabId, { active: true });
}

/** Close a real browser tab. */
export async function closeBrowserTab(tab: WorkspaceTab): Promise<void> {
  await browser.tabs.remove(tab.tabId);
}
