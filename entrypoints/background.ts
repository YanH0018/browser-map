import { browser } from 'wxt/browser';

/**
 * Background service worker.
 *
 * Responsibilities (see docs/ARCHITECTURE.md):
 *  - listen for browser tab events
 *  - publish lightweight "tabs changed" notifications to extension pages
 *  - execute privileged tab operations (added as the UI needs them)
 *
 * The workspace page re-queries tab state on notification; the background
 * itself stays stateless so that MV3 service-worker restarts are harmless.
 */
export default defineBackground(() => {
  const notifyTabsChanged = () => {
    // No receivers is normal when the workspace page is closed.
    browser.runtime
      .sendMessage({ type: 'bw:tabs-changed' })
      .catch(() => undefined);
  };

  browser.tabs.onCreated.addListener(notifyTabsChanged);
  browser.tabs.onRemoved.addListener(notifyTabsChanged);
  browser.tabs.onActivated.addListener(notifyTabsChanged);
  browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    // Only broadcast when user-visible metadata changed.
    if (changeInfo.title !== undefined || changeInfo.url !== undefined || changeInfo.pinned !== undefined) {
      notifyTabsChanged();
    }
  });

  console.log('[browser-workspace] background started', { id: browser.runtime.id });
});
