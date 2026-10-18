import { useEffect } from 'react';
import { browser } from 'wxt/browser';
import { isOwnExtensionTab, type BrowserTabLike } from '../../lib/browserAdapter';
import type { TabChangeInfoLike, TabEvent } from '../../lib/tabEvents';
import { useWorkspaceStore } from '../../stores/workspaceStore';

/** Debounce window for tab-event bursts (e.g. restoring a closed window). */
const TAB_EVENT_DEBOUNCE_MS = 150;

/**
 * Subscribe to live chrome.tabs events and fold them into the store as a
 * debounced batch (M4 item 2, D10). The background's `bw:tabs-changed`
 * broadcast remains as a self-healing full resync.
 */
export function useTabEvents(): void {
  useEffect(() => {
    const ownOrigin = browser.runtime.getURL('');
    let buffer: TabEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      const events = buffer;
      buffer = [];
      if (events.length > 0) {
        useWorkspaceStore.getState().applyTabEvents(events);
      }
    };

    const schedule = (event: TabEvent) => {
      buffer.push(event);
      if (timer === undefined) timer = setTimeout(flush, TAB_EVENT_DEBOUNCE_MS);
    };

    const onCreated = (tab: BrowserTabLike) => {
      // The extension's own pages never become cards.
      if (isOwnExtensionTab(tab.url, ownOrigin)) return;
      schedule({ kind: 'created', tab });
    };

    const onRemoved = (tabId: number) => {
      schedule({ kind: 'removed', tabId });
    };

    const onUpdated = (tabId: number, changeInfo: TabChangeInfoLike) => {
      // Only user-visible metadata; status/progress churn is noise.
      if (
        changeInfo.title === undefined &&
        changeInfo.url === undefined &&
        changeInfo.pinned === undefined &&
        changeInfo.favIconUrl === undefined
      ) {
        return;
      }
      schedule({ kind: 'updated', tabId, changeInfo });
    };

    const onActivated = (activeInfo: { windowId: number; tabId: number }) => {
      schedule({ kind: 'activated', windowId: activeInfo.windowId, tabId: activeInfo.tabId });
    };

    browser.tabs.onCreated.addListener(onCreated);
    browser.tabs.onRemoved.addListener(onRemoved);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onActivated.addListener(onActivated);

    return () => {
      flush(); // Do not drop buffered events on unmount.
      browser.tabs.onCreated.removeListener(onCreated);
      browser.tabs.onRemoved.removeListener(onRemoved);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onActivated.removeListener(onActivated);
    };
  }, []);
}
