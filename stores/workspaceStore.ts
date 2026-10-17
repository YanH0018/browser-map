import { create } from 'zustand';
import type {
  Position,
  Viewport,
  WorkspaceCluster,
  WorkspaceTab,
} from '../lib/types';
import { DEFAULT_VIEWPORT } from '../lib/types';
import { filterTabs } from '../lib/search';
import { nextFreePosition } from '../lib/layout';

/**
 * Central workspace store (see docs/ARCHITECTURE.md).
 * The browser adapter writes browser-derived state; the UI reads and
 * mutates workspace state; persistence observes relevant slices.
 */
export interface WorkspaceState {
  tabs: WorkspaceTab[];
  clusters: WorkspaceCluster[];
  selectedTabIds: number[];
  viewport: Viewport;
  searchQuery: string;

  setTabs: (tabs: WorkspaceTab[]) => void;
  moveTab: (tabId: number, position: Position) => void;
  createCluster: (name: string, position: Position) => WorkspaceCluster;
  renameCluster: (clusterId: string, name: string) => void;
  deleteCluster: (clusterId: string) => void;
  assignTab: (tabId: number, clusterId: string | undefined) => void;
  removeTab: (tabId: number) => void;
  selectTab: (tabId: number | null) => void;
  setSearchQuery: (query: string) => void;
  setViewport: (viewport: Viewport) => void;
}

let clusterCounter = 0;

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tabs: [],
  clusters: [],
  selectedTabIds: [],
  viewport: DEFAULT_VIEWPORT,
  searchQuery: '',

  setTabs: (tabs) => set({ tabs }),

  moveTab: (tabId, position) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.tabId === tabId ? { ...t, position } : t)),
    })),

  createCluster: (name, position) => {
    const cluster: WorkspaceCluster = {
      id: `cluster-${Date.now()}-${clusterCounter++}`,
      name,
      position,
      size: { width: 360, height: 260 },
    };
    set((s) => ({ clusters: [...s.clusters, cluster] }));
    return cluster;
  },

  renameCluster: (clusterId, name) =>
    set((s) => ({
      clusters: s.clusters.map((c) => (c.id === clusterId ? { ...c, name } : c)),
    })),

  // Deleting a cluster unassigns its member cards; it never closes real
  // browser tabs.
  deleteCluster: (clusterId) =>
    set((s) => ({
      clusters: s.clusters.filter((c) => c.id !== clusterId),
      tabs: s.tabs.map((t) => (t.clusterId === clusterId ? { ...t, clusterId: undefined } : t)),
    })),

  assignTab: (tabId, clusterId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.tabId === tabId ? { ...t, clusterId } : t)),
    })),

  removeTab: (tabId) =>
    set((s) => ({
      tabs: s.tabs.filter((t) => t.tabId !== tabId),
      selectedTabIds: s.selectedTabIds.filter((id) => id !== tabId),
    })),

  selectTab: (tabId) => set({ selectedTabIds: tabId === null ? [] : [tabId] }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setViewport: (viewport) => set({ viewport }),
}));

/** Selector: tabs visible under the current search query. */
export function selectVisibleTabs(s: WorkspaceState): WorkspaceTab[] {
  return filterTabs(s.tabs, s.clusters, s.searchQuery);
}

/** Position for a brand-new card (e.g. freshly seen tab). */
export function suggestPosition(s: WorkspaceState): Position {
  return nextFreePosition(s.tabs.length);
}
