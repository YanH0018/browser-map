import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTO_LAYOUT_SNAPSHOT_NAME,
  selectVisibleTabs,
  useWorkspaceStore,
} from '../stores/workspaceStore';
import { TIDY_GRID_DEFAULTS } from '../lib/autoLayout';
import type { WorkspaceTab, WorkspaceCluster } from '../lib/types';

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
      namedSnapshots: [],
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

  it('moves a cluster without moving its member cards (D13)', () => {
    useWorkspaceStore.getState().setTabs([
      tab({ tabId: 1, position: { x: 40, y: 30 } }),
      tab({ tabId: 2, position: { x: 900, y: 800 } }),
    ]);
    const cluster = useWorkspaceStore.getState().createCluster('Work', { x: 0, y: 0 });
    useWorkspaceStore.getState().assignTab(1, cluster.id);
    useWorkspaceStore.getState().moveCluster(cluster.id, { x: 500, y: 320 });
    const s = useWorkspaceStore.getState();
    expect(s.clusters[0]?.position).toEqual({ x: 500, y: 320 });
    // Member card keeps its own position; assignment is by explicit drop,
    // not containment, so cards do not follow a moving cluster.
    expect(s.tabs.find((t) => t.tabId === 1)?.position).toEqual({ x: 40, y: 30 });
    expect(s.tabs.find((t) => t.tabId === 1)?.clusterId).toBe(cluster.id);
    expect(s.tabs.find((t) => t.tabId === 2)?.position).toEqual({ x: 900, y: 800 });
  });

  it('moveCluster is a no-op for an unknown cluster id', () => {
    useWorkspaceStore.getState().createCluster('Work', { x: 0, y: 0 });
    const before = useWorkspaceStore.getState().clusters;
    useWorkspaceStore.getState().moveCluster('cluster-does-not-exist', { x: 10, y: 20 });
    expect(useWorkspaceStore.getState().clusters).toEqual(before);
  });

  it('renames a cluster', () => {
    useWorkspaceStore.getState().setTabs([tab({ tabId: 1 })]);
    const cluster = useWorkspaceStore.getState().createCluster('Thesis', { x: 0, y: 0 });
    useWorkspaceStore.getState().renameCluster(cluster.id, 'Thesis v2');
    const s = useWorkspaceStore.getState();
    expect(s.clusters).toHaveLength(1);
    expect(s.clusters[0]?.name).toBe('Thesis v2');
  });

  it('deleting a cluster unassigns its member tabs but keeps them', () => {
    useWorkspaceStore.getState().setTabs([
      tab({ tabId: 1 }),
      tab({ tabId: 2, url: 'https://b.example.com', domain: 'b.example.com' }),
    ]);
    const cluster = useWorkspaceStore.getState().createCluster('Work', { x: 0, y: 0 });
    useWorkspaceStore.getState().assignTab(1, cluster.id);
    useWorkspaceStore.getState().deleteCluster(cluster.id);
    const s = useWorkspaceStore.getState();
    expect(s.clusters).toHaveLength(0);
    // Both cards remain; the former member is unassigned, the other untouched.
    expect(s.tabs).toHaveLength(2);
    expect(s.tabs.find((t) => t.tabId === 1)?.clusterId).toBeUndefined();
    expect(s.tabs.find((t) => t.tabId === 2)?.clusterId).toBeUndefined();
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

  describe('named snapshots (M3)', () => {
    it('saveNamedSnapshot captures the current canvas state', () => {
      useWorkspaceStore.getState().setTabs([tab({ tabId: 1, position: { x: 40, y: 50 } })]);
      useWorkspaceStore.getState().setViewport({ x: 7, y: 8, zoom: 1.2 });
      useWorkspaceStore.getState().saveNamedSnapshot('work');
      const s = useWorkspaceStore.getState();
      expect(s.namedSnapshots).toHaveLength(1);
      const snap = s.namedSnapshots[0]!;
      expect(snap.name).toBe('work');
      expect(typeof snap.id).toBe('string');
      expect(snap.tabs[0]).toMatchObject({ url: 'https://a.example.com', position: { x: 40, y: 50 }, tabId: 1 });
      expect(snap.viewport).toEqual({ x: 7, y: 8, zoom: 1.2 });
      expect(typeof snap.createdAt).toBe('number');
    });

    it('saving again with the same name updates instead of duplicating', () => {
      useWorkspaceStore.getState().setTabs([tab({ tabId: 1, position: { x: 0, y: 0 } })]);
      useWorkspaceStore.getState().saveNamedSnapshot('work');
      useWorkspaceStore.getState().moveTab(1, { x: 900, y: 800 });
      useWorkspaceStore.getState().saveNamedSnapshot('work');
      const s = useWorkspaceStore.getState();
      expect(s.namedSnapshots).toHaveLength(1);
      expect(s.namedSnapshots[0]?.tabs[0]?.position).toEqual({ x: 900, y: 800 });
    });

    it('restoreNamedSnapshot replaces canvas state without opening/closing tabs', () => {
      const s0 = useWorkspaceStore.getState();
      s0.setTabs([
        tab({ tabId: 1, position: { x: 40, y: 50 } }),
        tab({ tabId: 2, url: 'https://b.example.com', domain: 'b.example.com' }),
      ]);
      const c = s0.createCluster('Work', { x: 10, y: 20 });
      s0.assignTab(1, c.id);
      const savedViewport = { x: 5, y: 6, zoom: 1.4 };
      s0.setViewport(savedViewport);
      useWorkspaceStore.getState().saveNamedSnapshot('work');
      const snapId = useWorkspaceStore.getState().namedSnapshots[0]!.id;

      // Drift the canvas: move a card, add another cluster, pan.
      useWorkspaceStore.getState().moveTab(1, { x: 500, y: 600 });
      useWorkspaceStore.getState().createCluster('Side', { x: 9, y: 9 });
      useWorkspaceStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

      // Live tab set changes too: B closed, C opened.
      useWorkspaceStore.getState().setTabs([
        tab({ tabId: 1, position: { x: 500, y: 600 }, clusterId: c.id }),
        tab({ tabId: 3, url: 'https://c.example.com', domain: 'c.example.com' }),
      ]);

      useWorkspaceStore.getState().restoreNamedSnapshot(snapId);
      const s = useWorkspaceStore.getState();

      // Saved arrangement is back for the still-open tab.
      expect(s.tabs.find((t) => t.tabId === 1)?.position).toEqual({ x: 40, y: 50 });
      expect(s.tabs.find((t) => t.tabId === 1)?.clusterId).toBe(c.id);
      // Closed tab B is NOT resurrected; new live tab C stays untouched.
      expect(s.tabs.map((t) => t.tabId).sort()).toEqual([1, 3]);
      expect(s.tabs.find((t) => t.tabId === 3)?.position).toEqual({ x: 0, y: 0 });
      // Clusters and viewport are replaced wholesale.
      expect(s.clusters.map((x) => x.id)).toEqual([c.id]);
      expect(s.viewport).toEqual(savedViewport);
    });

    it('restoreNamedSnapshot with an unknown id is a no-op', () => {
      useWorkspaceStore.getState().setTabs([tab({ tabId: 1 })]);
      const before = useWorkspaceStore.getState();
      useWorkspaceStore.getState().restoreNamedSnapshot('nope');
      expect(useWorkspaceStore.getState()).toEqual(before);
    });

    it('deleteNamedSnapshot removes by id; unknown ids are ignored', () => {
      useWorkspaceStore.getState().setTabs([tab({ tabId: 1 })]);
      useWorkspaceStore.getState().saveNamedSnapshot('a');
      useWorkspaceStore.getState().moveTab(1, { x: 5, y: 5 });
      useWorkspaceStore.getState().saveNamedSnapshot('b');
      const [first] = useWorkspaceStore.getState().namedSnapshots;
      expect(first).toBeDefined();

      useWorkspaceStore.getState().deleteNamedSnapshot('nope'); // no-op
      expect(useWorkspaceStore.getState().namedSnapshots).toHaveLength(2);

      useWorkspaceStore.getState().deleteNamedSnapshot(first!.id);
      const s = useWorkspaceStore.getState();
      expect(s.namedSnapshots).toHaveLength(1);
      expect(s.namedSnapshots[0]?.name).toBe('b');
    });
  });

  describe('auto-layout (M6)', () => {
    const cluster = (over?: Partial<WorkspaceCluster>): WorkspaceCluster => ({
      id: 'cluster-user',
      name: 'Research',
      position: { x: 0, y: 0 },
      size: { width: 360, height: 260 },
      ...over,
    });

    it('tidyGrid snaps cards onto the grid and saves before-autolayout first', () => {
      useWorkspaceStore.getState().setTabs([
        tab({ tabId: 1, position: { x: 80, y: 80 } }),
        tab({ tabId: 2, position: { x: 360, y: 95 } }),
        tab({ tabId: 3, position: { x: 80, y: 240 } }),
      ]);

      useWorkspaceStore.getState().tidyGrid();
      const s = useWorkspaceStore.getState();

      // Cards are on the regular grid, in reading order of their old spots.
      expect(s.tabs.find((t) => t.tabId === 1)?.position).toEqual({ x: 80, y: 80 });
      expect(s.tabs.find((t) => t.tabId === 2)?.position).toEqual({ x: 360, y: 80 });
      expect(s.tabs.find((t) => t.tabId === 3)?.position).toEqual({ x: 640, y: 80 });

      // Safety snapshot captured the PRE-tidy arrangement (M6 item 3).
      const snap = s.namedSnapshots.find((x) => x.name === AUTO_LAYOUT_SNAPSHOT_NAME);
      expect(snap).toBeDefined();
      const snapTab2 = snap!.tabs.find((t) => t.tabId === 2);
      expect(snapTab2?.position).toEqual({ x: 360, y: 95 }); // pre-tidy
      expect(snapTab2?.clusterId).toBeUndefined();
    });

    it('restoring before-autolayout brings the previous arrangement back', () => {
      useWorkspaceStore.getState().setTabs([
        tab({ tabId: 1, position: { x: 123, y: 45 } }),
        tab({ tabId: 2, position: { x: 900, y: 700 } }),
      ]);
      useWorkspaceStore.getState().tidyGrid();

      const snap = useWorkspaceStore
        .getState()
        .namedSnapshots.find((x) => x.name === AUTO_LAYOUT_SNAPSHOT_NAME)!;
      useWorkspaceStore.getState().restoreNamedSnapshot(snap.id);

      const s = useWorkspaceStore.getState();
      expect(s.tabs.find((t) => t.tabId === 1)?.position).toEqual({ x: 123, y: 45 });
      expect(s.tabs.find((t) => t.tabId === 2)?.position).toEqual({ x: 900, y: 700 });
    });

    it('tidyGrid overwrites (not duplicates) the safety snapshot on each run', () => {
      useWorkspaceStore.getState().setTabs([tab({ tabId: 1, position: { x: 50, y: 60 } })]);
      useWorkspaceStore.getState().tidyGrid();
      const firstId = useWorkspaceStore
        .getState()
        .namedSnapshots.find((x) => x.name === AUTO_LAYOUT_SNAPSHOT_NAME)!.id;

      useWorkspaceStore.getState().moveTab(1, { x: 500, y: 500 });
      useWorkspaceStore.getState().tidyGrid();

      const snaps = useWorkspaceStore
        .getState()
        .namedSnapshots.filter((x) => x.name === AUTO_LAYOUT_SNAPSHOT_NAME);
      expect(snaps).toHaveLength(1); // overwritten in place
      expect(snaps[0]!.id).not.toBe(firstId);
      // It now captures the state before the SECOND tidy.
      expect(snaps[0]!.tabs.find((t) => t.tabId === 1)?.position).toEqual({ x: 500, y: 500 });
    });

    it('tidyGrid keeps cluster membership (purely logical, D16) and does not move frames', () => {
      const c = cluster();
      useWorkspaceStore.getState().setTabs([
        tab({ tabId: 1, position: { x: 80, y: 80 }, clusterId: c.id }),
        tab({ tabId: 2, position: { x: 360, y: 80 } }),
      ]);
      useWorkspaceStore.setState({ clusters: [c] });

      useWorkspaceStore.getState().tidyGrid();
      const s = useWorkspaceStore.getState();

      expect(s.tabs.find((t) => t.tabId === 1)?.clusterId).toBe(c.id); // membership kept
      expect(s.tabs.find((t) => t.tabId === 2)?.clusterId).toBeUndefined();
      expect(s.clusters).toEqual([c]); // frames untouched
    });

    it('groupByDomain creates domain clusters, assigns unclustered tabs only', () => {
      const c = cluster();
      useWorkspaceStore.getState().setTabs([
        tab({ tabId: 1, domain: 'github.com', clusterId: c.id }), // untouched
        tab({ tabId: 2, domain: 'github.com' }),
        tab({ tabId: 3, domain: '' }), // → Other
      ]);
      useWorkspaceStore.setState({ clusters: [c] });

      useWorkspaceStore.getState().groupByDomain();
      const s = useWorkspaceStore.getState();

      expect(s.clusters).toHaveLength(3);
      expect(s.clusters[0]).toEqual(c); // existing cluster untouched
      const github = s.clusters.find((x) => x.name === 'github.com')!;
      const other = s.clusters.find((x) => x.name === 'Other')!;
      expect(s.tabs.find((t) => t.tabId === 1)?.clusterId).toBe(c.id);
      expect(s.tabs.find((t) => t.tabId === 2)?.clusterId).toBe(github.id);
      expect(s.tabs.find((t) => t.tabId === 3)?.clusterId).toBe(other.id);

      // Safety snapshot captured the pre-mutation state.
      const snap = s.namedSnapshots.find((x) => x.name === AUTO_LAYOUT_SNAPSHOT_NAME)!;
      expect(snap.clusters).toHaveLength(1);
      expect(snap.tabs.find((t) => t.tabId === 2)?.clusterId).toBeUndefined();
    });

    it('groupByDomain is idempotent: a second click adds nothing', () => {
      useWorkspaceStore.getState().setTabs([
        tab({ tabId: 1, domain: 'github.com' }),
        tab({ tabId: 2, domain: 'example.com' }),
      ]);
      useWorkspaceStore.getState().groupByDomain();
      const afterFirst = useWorkspaceStore.getState();

      useWorkspaceStore.getState().groupByDomain();
      const s = useWorkspaceStore.getState();

      expect(s.clusters).toHaveLength(afterFirst.clusters.length); // no new clusters
      expect(s.tabs.find((t) => t.tabId === 1)?.clusterId).toBe(
        afterFirst.tabs.find((t) => t.tabId === 1)?.clusterId,
      );
    });

    it('auto-layout grid output never overlaps: every card on a unique lattice slot', () => {
      const tabs = Array.from({ length: 10 }, (_, i) =>
        tab({ tabId: i + 1, position: { x: (i * 137) % 600, y: (i * 89) % 500 } }),
      );
      useWorkspaceStore.getState().setTabs(tabs);

      useWorkspaceStore.getState().tidyGrid();
      const seen = new Set<string>();
      for (const t of useWorkspaceStore.getState().tabs) {
        const key = `${t.position.x}:${t.position.y}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        const { origin, columnWidth, rowHeight } = TIDY_GRID_DEFAULTS;
        expect((t.position.x - origin.x) % columnWidth).toBe(0);
        expect((t.position.y - origin.y) % rowHeight).toBe(0);
      }
    });
  });
});
