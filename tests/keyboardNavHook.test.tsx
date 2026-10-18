// @vitest-environment happy-dom
/**
 * M5 item 4 (D15) — accessibility wiring for the canvas keyboard model.
 *
 * Mounts the real WorkspaceCanvas together with useKeyboardNav (the same
 * combination App.tsx uses) and drives key events through the document,
 * exactly like a real browser would. The browser adapter is mocked so no
 * chrome.* APIs are touched. Covers:
 * - cards expose role="button", tabIndex=0 and a descriptive aria-label
 * - arrow keys move the selection (spatial-nearest, D12) through the hook
 * - Enter activates the selected tab (mocked adapter call)
 * - focusing a card selects it; Space on a focused card activates it
 *   (role="button" semantics); Space with no card focused does nothing
 * - Escape clears the selection
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { activateMock } = vi.hoisted(() => ({
  activateMock: vi.fn(async (_tab: unknown) => {}),
}));

vi.mock('../lib/browserAdapter', () => ({
  activateBrowserTab: (tab: unknown) => activateMock(tab),
}));

// Deterministic rendering: no node measurement in this test.
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import WorkspaceCanvas from '../components/WorkspaceCanvas';
import { useKeyboardNav } from '../entrypoints/workspace/useKeyboardNav';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { WorkspaceTab } from '../lib/types';

function Harness() {
  useKeyboardNav(); // same wiring as App.tsx
  return <WorkspaceCanvas />;
}

/** Two cards on the same row: A (left, id 1001) and B (right, id 1002). */
function makeTabs(): WorkspaceTab[] {
  return [
    {
      tabId: 1001,
      windowId: 1,
      title: 'Alpha',
      url: 'https://example.com/alpha',
      domain: 'example.com',
      pinned: false,
      active: true,
      position: { x: 0, y: 0 },
    },
    {
      tabId: 1002,
      windowId: 1,
      title: 'Beta',
      url: 'https://example.com/beta',
      domain: 'example.com',
      pinned: false,
      active: false,
      position: { x: 260, y: 0 },
    },
  ];
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  activateMock.mockClear();
  useWorkspaceStore.setState({
    tabs: makeTabs(),
    clusters: [],
    selectedTabIds: [],
    searchQuery: '',
  });
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderHarness(): Promise<void> {
  await act(async () => {
    root = createRoot(container);
    root.render(<Harness />);
  });
}

/** Key press with the document as target (focus not on a card). */
function keyOnDocument(keyName: string): void {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }),
    );
  });
}

/** Key press targeted at an element (like a real browser: target = focused el). */
function keyOnElement(el: HTMLElement, keyName: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }));
  });
}

function cards(): HTMLDivElement[] {
  return Array.from(container.querySelectorAll<HTMLDivElement>('.bw-tab-card'));
}

/** Both cards as a non-optional tuple (the harness always renders exactly two). */
function cardPair(): [HTMLDivElement, HTMLDivElement] {
  const all = cards();
  if (all.length !== 2) throw new Error(`expected exactly 2 cards, got ${all.length}`);
  return [all[0]!, all[1]!];
}

describe('canvas keyboard + accessibility wiring (M5 item 4)', () => {
  it('cards expose role="button", tab order and a descriptive aria-label', async () => {
    await renderHarness();
    const [alpha, beta] = cardPair();

    for (const card of [alpha, beta]) {
      expect(card.getAttribute('role')).toBe('button');
      expect(card.tabIndex).toBe(0); // reachable via Tab key
    }
    expect(alpha.getAttribute('aria-label')).toBe('Tab card: Alpha (example.com)');
    expect(beta.getAttribute('aria-label')).toBe('Tab card: Beta (example.com)');
    // Nothing selected yet → not pressed.
    expect(alpha.getAttribute('aria-pressed')).toBe('false');
  });

  it('arrow keys move the selection spatially (spatial-nearest, D12)', async () => {
    await renderHarness();

    keyOnDocument('ArrowRight'); // nothing selected → first visible tab
    expect(useWorkspaceStore.getState().selectedTabIds).toEqual([1001]);

    keyOnDocument('ArrowRight'); // from Alpha → Beta (same row, to the right)
    expect(useWorkspaceStore.getState().selectedTabIds).toEqual([1002]);

    keyOnDocument('ArrowLeft'); // back to Alpha
    expect(useWorkspaceStore.getState().selectedTabIds).toEqual([1001]);

    // The selected card advertises its state via aria-pressed.
    const [alpha, beta] = cardPair();
    expect(alpha.getAttribute('aria-pressed')).toBe('true');
    expect(beta.getAttribute('aria-pressed')).toBe('false');
  });

  it('Enter activates the real tab behind the selected card (mocked)', async () => {
    await renderHarness();

    useWorkspaceStore.getState().selectTab(1002);
    keyOnDocument('Enter');

    expect(activateMock).toHaveBeenCalledTimes(1);
    expect(activateMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ tabId: 1002 }));
  });

  it('focusing a card selects it; Space on the focused card activates it', async () => {
    await renderHarness();
    const [alpha, beta] = cardPair();

    // Tab order: focusing a card (as the Tab key would) selects it.
    await act(async () => {
      alpha.focus();
    });
    expect(useWorkspaceStore.getState().selectedTabIds).toEqual([1001]);

    // Space with the card focused activates that tab (role="button").
    keyOnElement(alpha, ' ');
    expect(activateMock).toHaveBeenCalledTimes(1);
    expect(activateMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ tabId: 1001 }));

    // Space with no card focused must NOT activate anything.
    activateMock.mockClear();
    keyOnDocument(' ');
    expect(activateMock).not.toHaveBeenCalled();

    // Selection → focus: selecting Beta moves DOM focus onto its card.
    await act(async () => {
      useWorkspaceStore.getState().selectTab(1002);
    });
    expect(document.activeElement).toBe(beta);
  });

  it('Escape clears the selection', async () => {
    await renderHarness();

    useWorkspaceStore.getState().selectTab(1001);
    keyOnDocument('Escape');
    expect(useWorkspaceStore.getState().selectedTabIds).toEqual([]);

    const [alpha] = cardPair();
    expect(alpha.getAttribute('aria-pressed')).toBe('false');
  });

  it('keys are ignored while a real form control has focus', async () => {
    await renderHarness();

    // The search box is not part of the canvas; simulate focus on a button
    // (e.g. toolbar "New cluster") — arrow/Enter must not be hijacked.
    const button = document.createElement('button');
    container.appendChild(button);
    keyOnElement(button, 'ArrowRight');
    expect(useWorkspaceStore.getState().selectedTabIds).toEqual([]);

    keyOnElement(button, 'Enter');
    expect(activateMock).not.toHaveBeenCalled();
  });
});
