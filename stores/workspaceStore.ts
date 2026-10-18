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
import { groupByDomain, tidyGridPositions } from '../lib/autoLayout';
import { applyTabEvents as reduceTabEvents, type TabEvent } from '../lib/tabEvents';
import { embedTabs } from '../lib/embeddings';
import { buildSuggestedClusters, MIN_CLUSTER_SIZE } from '../lib/semantic';
import { loadEmbeddingCache, saveEmbeddingCache } from '../lib/workspaceStorage';

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
  /** Tidy grid (M6 item 1): snap every card onto a regular grid. */
  tidyGrid: () => void;
  /** Group by domain (M6 item 2): one new cluster per distinct domain. */
  groupByDomain: () => void;

  /** Suggest clusters (M7): embed unclustered tabs locally, group by similarity. */
  suggestClusters: () => Promise<void>;
  /** True while a semantic-clustering run is in flight (button disabled). */
  semanticBusy: boolean;
  /** Failure notice shown in the toolbar; null when there is nothing to report. */
  semanticNotice: string | null;
}

/** Safety snapshot name for auto-layout (M6 item 3); overwritten each run. */
export const AUTO_LAYOUT_SNAPSHOT_NAME = 'before-autolayout';

let clusterCounter = 0;

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tabs: [],
  clusters: [],
  selectedTabIds: [],
  viewport: DEFAULT_VIEWPORT,
  searchQuery: '',
  namedSnapshots: [],
  semanticBusy: false,
  semanticNotice: null,

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

  // Auto-layout safety (M6 item 3): capture the pre-mutation canvas state
  // as a named snapshot BEFORE applying any auto-layout change, so one
  // click of Restore brings the previous arrangement back. The snapshot is
  // overwritten (same name, updated in place) on every auto-layout run.
  tidyGrid: () =>
    set((s) => {
      const safe = withSafetySnapshot(s);
      const positions = tidyGridPositions(safe.tabs);
      return {
        ...safe,
        tabs: safe.tabs.map((t) => ({ ...t, position: positions.get(t.tabId)! })),
      };
    }),

  groupByDomain: () =>
    set((s) => {
      const safe = withSafetySnapshot(s);
      const { newClusters, assignments } = groupByDomain(safe.tabs, safe.clusters);
      return {
        ...safe,
        clusters: [...safe.clusters, ...newClusters],
        tabs: safe.tabs.map((t) => {
          const clusterId = assignments.get(t.tabId);
          return clusterId !== undefined ? { ...t, clusterId } : t;
        }),
      };
    }),

  // Suggest clusters (M7 item 3): embed UNCLUSTERED tabs' `title + hostname`
  // via the local LM Studio endpoint (vectors cached by URL), greedily
  // cluster them by cosine similarity, and create one new cluster per group
  // of >= MIN_CLUSTER_SIZE members. Existing clusters/assignments are never
  // touched (D17/D18). Safety: the `before-autolayout` snapshot is upserted
  // BEFORE any mutation, exactly like the M6 auto-layouts. Any endpoint
  // failure surfaces a toolbar notice and changes nothing (never crashes,
  // never blocks the canvas — the work is async).
  suggestClusters: async () => {
    const store = useWorkspaceStore;
    if (store.getState().semanticBusy) return; // no double runs
    const unclustered = store.getState().tabs.filter((t) => t.clusterId === undefined);
    if (unclustered.length < MIN_CLUSTER_SIZE) return; // nothing to suggest: no-op, no snapshot

    store.setState({ semanticBusy: true, semanticNotice: null });
    try {
      const cache = await loadEmbeddingCache();
      const { vectorsByTabId, cache: updatedCache } = await embedTabs(unclustered, cache);
      if (updatedCache !== cache) {
        await saveEmbeddingCache(updatedCache); // local storage: fast, awaited
      }

      // Safety (M6 pattern): capture the pre-mutation canvas state right
      // before mutating. A failed run (endpoint down) changes nothing —
      // not even the snapshot list.
      store.setState((s) => withSafetySnapshot(s));

      // Apply against FRESH state: tabs may have opened/closed while the
      // endpoint was busy. Vectors are keyed by tabId, so stale entries are
      // simply unused and new tabs without vectors stay unclustered.
      store.setState((s) => {
        const { newClusters, assignments } = buildSuggestedClusters(
          s.tabs,
          s.clusters,
          vectorsByTabId,
        );
        return {
          ...s,
          clusters: [...s.clusters, ...newClusters],
          tabs: s.tabs.map((t) => {
            const clusterId = assignments.get(t.tabId);
            return clusterId !== undefined ? { ...t, clusterId } : t;
          }),
        };
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      store.setState({
        semanticNotice: `Semantic clustering unavailable (${reason}). No clusters were created.`,
      });
    } finally {
      store.setState({ semanticBusy: false });
    }
  },
}));

/** State with the `before-autolayout` snapshot upserted (M6 item 3). */
function withSafetySnapshot(s: WorkspaceState): WorkspaceState {
  const snapshot = createNamedSnapshot(AUTO_LAYOUT_SNAPSHOT_NAME, s.tabs, s.clusters, s.viewport);
  const existing = s.namedSnapshots.find((x) => x.name === AUTO_LAYOUT_SNAPSHOT_NAME);
  return {
    ...s,
    namedSnapshots: existing
      ? s.namedSnapshots.map((x) => (x.id === existing.id ? snapshot : x))
      : [...s.namedSnapshots, snapshot],
  };
}

/** Selector: tabs visible under the current search query. */
export function selectVisibleTabs(s: WorkspaceState): WorkspaceTab[] {
  return filterTabs(s.tabs, s.clusters, s.searchQuery);
}

/** Position for a brand-new card (e.g. freshly seen tab). */
export function suggestPosition(s: WorkspaceState): Position {
  return nextFreePosition(s.tabs.length);
}
