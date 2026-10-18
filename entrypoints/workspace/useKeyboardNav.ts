import { useEffect } from 'react';
import { activateBrowserTab } from '../../lib/browserAdapter';
import { nextSelectedTabId, type NavDirection } from '../../lib/keyboardNav';
import { selectVisibleTabs, useWorkspaceStore } from '../../stores/workspaceStore';

/** Arrow keys → spatial navigation direction (D12). */
const ARROW_KEYS: Record<string, NavDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Keys must not be hijacted while an interactive element has focus. */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'BUTTON' ||
    target.isContentEditable
  );
}

/**
 * Global keyboard navigation for the canvas (M5 item 1, D12):
 * - Arrow keys move a visible selection between tab cards (spatial-nearest)
 * - Enter activates the real browser tab behind the selected card — the same
 *   `activateBrowserTab` path as the inspector's "Activate tab" button (M3)
 * - Escape clears the selection
 *
 * Listens on document in the capture phase so it wins over React Flow's own
 * key handling. Typing in the search box, Enter on focused buttons and
 * modifier combos (Cmd/Ctrl/Alt) are left alone. Only cards visible under
 * the current search filter are navigation candidates.
 */
export function useKeyboardNav(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // browser/OS shortcuts
      if (isInteractiveTarget(e.target)) return;

      const direction = ARROW_KEYS[e.key];
      if (direction) {
        e.preventDefault();
        e.stopPropagation();
        const state = useWorkspaceStore.getState();
        const visible = selectVisibleTabs(state);
        state.selectTab(nextSelectedTabId(visible, state.selectedTabIds, direction));
        return;
      }

      if (e.key === 'Enter') {
        const state = useWorkspaceStore.getState();
        const tabId = state.selectedTabIds[0];
        if (tabId === undefined) return;
        const tab = state.tabs.find((t) => t.tabId === tabId);
        if (!tab) return;
        e.preventDefault();
        void activateBrowserTab(tab);
        return;
      }

      if (e.key === 'Escape') {
        useWorkspaceStore.getState().selectTab(null);
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
