import { create } from 'zustand';
import type {
  NamedSnapshot,
  Position,
  Viewport,
  WorkspaceCluster,
  WorkspaceTab,
} from '../lib/types';
import { DEFAULT_VIEWPORT } from '../lib/types';
import { filterTabs } from '../lib/search';
import { nextFreePosition } from '../lib/layout';
import { createNamedSnapshot } from '../lib/namedSnapshots';
import { applySnapshotToTabs } from '../lib/persistence';
import { applyTabEvents as reduceTabEvents, type TabEvent } from '../lib/tabEvents';

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
  namedSnapshots: NamedSnapshot[];

  setTabs: (tabs: WorkspaceTab[]) => void;
  /** Fold a debounced batch of live chrome.tabs events into the store (M4 item 2). */
  applyTabEvents: (events: readonly TabEvent[]) => void;
  moveTab: (tabId: number, position: Position) => void;
  /** Move a cluster; member cards do NOT follow (D13). */
  moveCluster: (clusterId: string, position: Position) => void;
  createCluster: (name: string, position: Position) => WorkspaceCluster;
  renameCluster: (clusterId: string, name: string) => void;
  deleteCluster: (clusterId: string) => void;
  assignTab: (tabId: number, clusterId: string | undefined) => void;
  removeTab: (tabId: number) => void;
  selectTab: (tabId: number | null) => void;
  setSearchQuery: (query: string) => void;
  setViewport: (viewport: Viewport) => void;
  setNamedSnapshots: (snapshots: NamedSnapshot[]) => void;
  saveNamedSnapshot: (name: string) => void;
  restoreNamedSnapshot: (id: string) => void;
  deleteNamedSnapshot: (id: string) => void;
}

let clusterCounter = 0;

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tabs: [],
  clusters: [],
  selectedTabIds: [],
  viewport: DEFAULT_VIEWPORT,
  searchQuery: '',
  namedSnapshots: [],

  setTabs: (tabs) => set({ tabs }),

  applyTabEvents: (events) =>
    set((s) => reduceTabEvents(s.tabs, s.selectedTabIds, events)),

  moveTab: (tabId, position) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.tabId === tabId ? { ...t, position } : t)),
    })),

  // Moving a cluster only moves the frame itself; member cards keep their
  // positions (D13) — assignment is by explicit drop, not containment.
  moveCluster: (clusterId, position) =>
    set((s) => ({
      clusters: s.clusters.map((c) => (c.id === clusterId ? { ...c, position } : c)),
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

  setNamedSnapshots: (snapshots) => set({ namedSnapshots: snapshots }),

  // Save the current canvas state under a name. Saving again with an
  // existing name updates that snapshot instead of creating a duplicate.
  saveNamedSnapshot: (name) =>
    set((s) => {
      const snapshot = createNamedSnapshot(name, s.tabs, s.clusters, s.viewport);
      const existing = s.namedSnapshots.find((x) => x.name === name);
      return {
        namedSnapshots: existing
          ? s.namedSnapshots.map((x) => (x.id === existing.id ? snapshot : x))
          : [...s.namedSnapshots, snapshot],
      };
    }),

  // Restore replaces the canvas state (positions, clusters, viewport)
  // from a saved snapshot. It never opens or closes real browser tabs:
  // only tabs currently open get the saved arrangement; closed tabs are
  // simply absent from the canvas.
  restoreNamedSnapshot: (id) =>
    set((s) => {
      const snapshot = s.namedSnapshots.find((x) => x.id === id);
      if (!snapshot) return s;
      return {
        tabs: applySnapshotToTabs(s.tabs, snapshot),
        clusters: snapshot.clusters,
        viewport: snapshot.viewport,
      };
    }),

  deleteNamedSnapshot: (id) =>
    set((s) => ({ namedSnapshots: s.namedSnapshots.filter((x) => x.id !== id) })),
}));

/** Selector: tabs visible under the current search query. */
export function selectVisibleTabs(s: WorkspaceState): WorkspaceTab[] {
  return filterTabs(s.tabs, s.clusters, s.searchQuery);
}

/** Position for a brand-new card (e.g. freshly seen tab). */
export function suggestPosition(s: WorkspaceState): Position {
  return nextFreePosition(s.tabs.length);
}
