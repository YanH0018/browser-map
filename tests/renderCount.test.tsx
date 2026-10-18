// @vitest-environment happy-dom
/**
 * M5 item 3 — performance with many tabs (render-count test).
 *
 * Renders the real WorkspaceCanvas with 150 tab cards + 2 clusters and
 * counts how often the memoized node components actually render. The
 * contract: a store update that changes one tab (or one cluster) must
 * re-render exactly the affected node(s), not the whole canvas.
 *
 * ResizeObserver is stubbed out so XYFlow never measures nodes: the test
 * asserts React memoization behavior, not layout, and measurement-driven
 * re-renders would be environmental noise.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Deterministic rendering: no node measurement in this test.
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import WorkspaceCanvas from '../components/WorkspaceCanvas';
import { tabNodeRenderCount } from '../components/TabNode';
import { clusterNodeRenderCount } from '../components/ClusterNode';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { WorkspaceCluster, WorkspaceTab } from '../lib/types';

const TAB_COUNT = 150;

function makeTabs(n: number): WorkspaceTab[] {
  return Array.from({ length: n }, (_, i) => ({
    tabId: 1000 + i,
    // Two windows so every card carries a badge (exercises the badge path).
    windowId: i % 2 === 0 ? 1 : 2,
    title: `Tab ${i}`,
    url: `https://example.com/${i}`,
    domain: 'example.com',
    pinned: false,
    active: i === 0,
    position: { x: (i % 10) * 260, y: Math.floor(i / 10) * 90 },
  }));
}

function makeClusters(): WorkspaceCluster[] {
  return [
    { id: 'cluster-a', name: 'A', position: { x: 0, y: 0 }, size: { width: 360, height: 260 } },
    { id: 'cluster-b', name: 'B', position: { x: 500, y: 400 }, size: { width: 360, height: 260 } },
  ];
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  tabNodeRenderCount.count = 0;
  clusterNodeRenderCount.count = 0;
  useWorkspaceStore.setState({
    tabs: makeTabs(TAB_COUNT),
    clusters: makeClusters(),
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

async function renderCanvas(): Promise<void> {
  await act(async () => {
    root = createRoot(container);
    root.render(<WorkspaceCanvas />);
  });
}

describe('canvas render counts with 150 tabs (M5 item 3)', () => {
  it('renders every card once on mount', async () => {
    await renderCanvas();
    expect(tabNodeRenderCount.count).toBe(TAB_COUNT);
    expect(clusterNodeRenderCount.count).toBe(2);
  });

  it('moving one tab re-renders only that card', async () => {
    await renderCanvas();
    const before = tabNodeRenderCount.count;
    const clusterBefore = clusterNodeRenderCount.count;

    await act(async () => {
      useWorkspaceStore.getState().moveTab(1042, { x: 999, y: 888 });
    });

    expect(tabNodeRenderCount.count - before).toBe(1);
    expect(clusterNodeRenderCount.count).toBe(clusterBefore);
  });

  it('selecting a tab re-renders only the affected cards', async () => {
    await renderCanvas();

    let before = tabNodeRenderCount.count;
    await act(async () => {
      useWorkspaceStore.getState().selectTab(1005);
    });
    expect(tabNodeRenderCount.count - before).toBe(1); // newly selected card

    before = tabNodeRenderCount.count;
    await act(async () => {
      useWorkspaceStore.getState().selectTab(1007); // old + new selection change
    });
    expect(tabNodeRenderCount.count - before).toBe(2);

    before = tabNodeRenderCount.count;
    await act(async () => {
      useWorkspaceStore.getState().selectTab(null); // clears the selection
    });
    expect(tabNodeRenderCount.count - before).toBe(1);
  });

  it('moving or renaming a cluster re-renders only that cluster', async () => {
    await renderCanvas();

    let before = clusterNodeRenderCount.count;
    const tabsBefore = tabNodeRenderCount.count;
    await act(async () => {
      useWorkspaceStore.getState().moveCluster('cluster-a', { x: 12, y: 34 });
    });
    expect(clusterNodeRenderCount.count - before).toBe(1);
    expect(tabNodeRenderCount.count).toBe(tabsBefore);

    before = clusterNodeRenderCount.count;
    await act(async () => {
      useWorkspaceStore.getState().renameCluster('cluster-b', 'B2');
    });
    expect(clusterNodeRenderCount.count - before).toBe(1);
    expect(tabNodeRenderCount.count).toBe(tabsBefore);
  });

  it('adding a tab re-renders only the new card', async () => {
    await renderCanvas();

    const before = tabNodeRenderCount.count;
    const clusterBefore = clusterNodeRenderCount.count;
    await act(async () => {
      const s = useWorkspaceStore.getState();
      s.setTabs([
        ...s.tabs,
        {
          tabId: 9999,
          windowId: 1,
          title: 'New tab',
          url: 'https://example.com/new',
          domain: 'example.com',
          pinned: false,
          active: true,
          position: { x: 0, y: 2000 },
        },
      ]);
    });

    expect(tabNodeRenderCount.count - before).toBe(1);
    expect(clusterNodeRenderCount.count).toBe(clusterBefore);
  });

  it('updating one tab in place (live sync) re-renders only that card', async () => {
    await renderCanvas();

    const before = tabNodeRenderCount.count;
    await act(async () => {
      // Mirrors what applyTabEvents does: replace one tab object, keep the rest.
      const s = useWorkspaceStore.getState();
      s.setTabs(
        s.tabs.map((t) => (t.tabId === 1010 ? { ...t, title: 'Navigated', url: 'https://example.com/next' } : t)),
      );
    });

    expect(tabNodeRenderCount.count - before).toBe(1);
  });
});
