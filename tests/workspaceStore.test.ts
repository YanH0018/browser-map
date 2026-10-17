import { beforeEach, describe, expect, it } from 'vitest';
import { selectVisibleTabs, useWorkspaceStore } from '../stores/workspaceStore';
import type { WorkspaceTab } from '../lib/types';

const tab = (over: Partial<WorkspaceTab>): WorkspaceTab => ({
  tabId: 1,
  windowId: 1,
  title: 'T',
  url: 'https://a.example.com',
  domain: 'a.example.com',
  pinned: false,
  active: false,
  position: { x: 0, y: 0 },
  ...over,
});

describe('workspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      tabs: [],
      clusters: [],
      selectedTabIds: [],
      searchQuery: '',
    });
  });

  it('moves a tab card', () => {
    useWorkspaceStore.getState().setTabs([tab({ tabId: 1 }), tab({ tabId: 2 })]);
    useWorkspaceStore.getState().moveTab(2, { x: 500, y: 600 });
    const s = useWorkspaceStore.getState();
    expect(s.tabs.find((t) => t.tabId === 2)?.position).toEqual({ x: 500, y: 600 });
    expect(s.tabs.find((t) => t.tabId === 1)?.position).toEqual({ x: 0, y: 0 });
  });

  it('creates clusters and assigns tabs', () => {
    useWorkspaceStore.getState().setTabs([tab({ tabId: 1 })]);
    const cluster = useWorkspaceStore.getState().createCluster('Thesis', { x: 0, y: 0 });
    useWorkspaceStore.getState().assignTab(1, cluster.id);
    const s = useWorkspaceStore.getState();
    expect(s.clusters).toHaveLength(1);
    expect(s.tabs[0]?.clusterId).toBe(cluster.id);
  });

  it('removing a tab also clears its selection', () => {
    useWorkspaceStore.getState().setTabs([tab({ tabId: 1 })]);
    useWorkspaceStore.getState().selectTab(1);
    useWorkspaceStore.getState().removeTab(1);
    const s = useWorkspaceStore.getState();
    expect(s.tabs).toHaveLength(0);
    expect(s.selectedTabIds).toHaveLength(0);
  });

  it('selectVisibleTabs applies the search query', () => {
    useWorkspaceStore.getState().setTabs([
      tab({ tabId: 1, title: 'PyTorch docs' }),
      tab({ tabId: 2, title: 'Shopping' }),
    ]);
    useWorkspaceStore.getState().setSearchQuery('pytorch');
    const visible = selectVisibleTabs(useWorkspaceStore.getState());
    expect(visible.map((t) => t.tabId)).toEqual([1]);
  });
});
