import { describe, expect, it } from 'vitest';
import {
  AUTO_CLUSTER_SIZE,
  OTHER_DOMAIN_NAME,
  TIDY_GRID_DEFAULTS,
  groupByDomain,
  gridSlot,
  readingOrder,
  tidyGridPositions,
} from '../lib/autoLayout';
import type { WorkspaceCluster, WorkspaceTab } from '../lib/types';

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

const cluster = (over: Partial<WorkspaceCluster>): WorkspaceCluster => ({
  id: 'cluster-1',
  name: 'C',
  position: { x: 0, y: 0 },
  size: { width: 360, height: 260 },
  ...over,
});

/** tabId → value as a plain object for stable assertions. */
function asRecord<V>(m: Map<number, V>): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [k, v] of m) out[String(k)] = v;
  return out;
}

describe('tidyGridPositions', () => {
  it('snaps cards onto the regular grid in reading order of current positions', () => {
    const tabs = [
      tab({ tabId: 1, position: { x: 80, y: 80 } }), // cell (0,0) → slot 0
      tab({ tabId: 2, position: { x: 360, y: 95 } }), // cell (0,1) → slot 1
      tab({ tabId: 3, position: { x: 80, y: 240 } }), // cell (1,0) → index 2
    ];
    expect(asRecord(tidyGridPositions(tabs))).toEqual({
      '1': { x: 80, y: 80 }, // index 0 → slot (row 0, col 0)
      '2': { x: 360, y: 80 }, // index 1 → slot (row 0, col 1)
      '3': { x: 640, y: 80 }, // index 2 → slot (row 0, col 2)
    });
  });

  it('is deterministic: same input twice gives identical output', () => {
    const tabs = [
      tab({ tabId: 1, position: { x: 500, y: 30 } }),
      tab({ tabId: 2, position: { x: 10, y: 400 } }),
      tab({ tabId: 3, position: { x: 900, y: 700 } }),
      tab({ tabId: 4, position: { x: 300, y: 250 } }),
    ];
    expect(tidyGridPositions(tabs)).toEqual(tidyGridPositions([...tabs].reverse()));
  });

  it('is independent of input array order (tabId tie-break)', () => {
    const tabs = [
      tab({ tabId: 7, position: { x: 80, y: 80 } }),
      tab({ tabId: 3, position: { x: 95, y: 82 } }), // same cell as tab 7
      tab({ tabId: 5, position: { x: 360, y: 80 } }),
    ];
    const shuffled = [tabs[1]!, tabs[2]!, tabs[0]!];
    expect(asRecord(tidyGridPositions(shuffled))).toEqual(asRecord(tidyGridPositions(tabs)));
    // Same-cell tie breaks by x: tab 7 (x=80) before tab 3 (x=95).
    expect(readingOrder(tabs).map((t) => t.tabId)).toEqual([7, 3, 5]);
  });

  it('never produces overlapping cards: every slot is unique and on the lattice', () => {
    const tabs = Array.from({ length: 17 }, (_, i) =>
      tab({
        tabId: i + 1,
        position: { x: (i * 97) % 500, y: (i * 53) % 400 }, // pseudo-scrambled
      }),
    );
    const positions = tidyGridPositions(tabs);
    expect(positions.size).toBe(17);

    const seen = new Set<string>();
    for (const [tabId, p] of positions) {
      expect(tabId).toBeGreaterThan(0);
      const key = `${p.x}:${p.y}`;
      expect(seen.has(key)).toBe(false); // no two cards share a slot
      seen.add(key);
      const { origin, columnWidth, rowHeight } = TIDY_GRID_DEFAULTS;
      expect(p.x - origin.x).toBeGreaterThanOrEqual(0);
      expect((p.x - origin.x) % columnWidth).toBe(0); // on the lattice
      expect(p.y - origin.y).toBeGreaterThanOrEqual(0);
      expect((p.y - origin.y) % rowHeight).toBe(0);
    }
  });

  it('gives clustered cards grid slots too (membership is purely logical, D16)', () => {
    const tabs = [
      tab({ tabId: 1, position: { x: 80, y: 80 }, clusterId: 'cluster-1' }),
      tab({ tabId: 2, position: { x: 360, y: 80 } }),
    ];
    const positions = tidyGridPositions(tabs);
    expect(positions.size).toBe(2); // clustered card included, not skipped
    expect(asRecord(positions)).toEqual({
      '1': { x: 80, y: 80 },
      '2': { x: 360, y: 80 },
    });
  });

  it('handles empty input and custom options', () => {
    expect(tidyGridPositions([]).size).toBe(0);
    const tabs = [tab({ tabId: 1, position: { x: 0, y: 0 } }), tab({ tabId: 2, position: { x: 10, y: 0 } })];
    const positions = tidyGridPositions(tabs, { columns: 1, origin: { x: 0, y: 0 }, columnWidth: 300, rowHeight: 150 });
    expect(asRecord(positions)).toEqual({ '1': { x: 0, y: 0 }, '2': { x: 0, y: 150 } });
    expect(gridSlot(5, { columns: 2, origin: { x: 0, y: 0 }, columnWidth: 10, rowHeight: 20 })).toEqual({
      x: 10,
      y: 40,
    });
  });
});

describe('groupByDomain', () => {
  it('creates one cluster per distinct domain among unclustered tabs, named after the domain', () => {
    const tabs = [
      tab({ tabId: 1, domain: 'github.com', url: 'https://github.com/a' }),
      tab({ tabId: 2, domain: 'example.com', url: 'https://example.com' }),
      tab({ tabId: 3, domain: 'github.com', url: 'https://github.com/b' }),
    ];
    const { newClusters, assignments } = groupByDomain(tabs, []);

    expect(newClusters.map((c) => c.name)).toEqual(['example.com', 'github.com']); // sorted
    const github = newClusters.find((c) => c.name === 'github.com')!;
    expect(assignments.get(1)).toBe(github.id);
    expect(assignments.get(3)).toBe(github.id);
    const example = newClusters.find((c) => c.name === 'example.com')!;
    expect(assignments.get(2)).toBe(example.id);
    // Stable, readable ids.
    expect(github.id).toBe('cluster-domain-github.com');
  });

  it('does not touch existing clusters or already-assigned tabs', () => {
    const userCluster = cluster({ id: 'cluster-user', name: 'Research' });
    const tabs = [
      tab({ tabId: 1, domain: 'github.com', clusterId: 'cluster-user' }), // stays put
      tab({ tabId: 2, domain: 'github.com' }),
      tab({ tabId: 3, domain: 'news.ycombinator.com' }),
    ];
    const { newClusters, assignments } = groupByDomain(tabs, [userCluster]);

    expect(newClusters).toHaveLength(2); // github.com + news.ycombinator.com
    for (const c of newClusters) expect(c.id).not.toBe('cluster-user');
    expect(assignments.has(1)).toBe(false); // existing assignment untouched
    const github = newClusters.find((c) => c.name === 'github.com')!;
    expect(assignments.get(2)).toBe(github.id);
  });

  it('groups tabs without a parseable domain under "Other"', () => {
    const tabs = [tab({ tabId: 1, domain: '', url: 'chrome://extensions' }), tab({ tabId: 2, domain: '' })];
    const { newClusters, assignments } = groupByDomain(tabs, []);
    expect(newClusters).toHaveLength(1);
    expect(newClusters[0]!.name).toBe(OTHER_DOMAIN_NAME);
    expect(assignments.get(1)).toBe(newClusters[0]!.id);
    expect(assignments.get(2)).toBe(newClusters[0]!.id);
  });

  it('is deterministic and independent of tab order', () => {
    const tabs = [
      tab({ tabId: 1, domain: 'b.example.com' }),
      tab({ tabId: 2, domain: 'a.example.com' }),
      tab({ tabId: 3, domain: 'b.example.com' }),
    ];
    const first = groupByDomain(tabs, []);
    const second = groupByDomain([...tabs].reverse(), []);
    expect(second.newClusters.map((c) => [c.name, c.id, c.position])).toEqual(
      first.newClusters.map((c) => [c.name, c.id, c.position]),
    );
    expect(asRecord(second.assignments)).toEqual(asRecord(first.assignments));
  });

  it('places new clusters in free cascade slots, never overlapping existing frames', () => {
    // Occupy the first two cascade slots (80,80) and (500,80).
    const taken = [
      cluster({ id: 'c1', position: { x: 80, y: 80 } }),
      cluster({ id: 'c2', position: { x: 500, y: 80 } }),
    ];
    const tabs = [tab({ tabId: 1, domain: 'x.example.com' }), tab({ tabId: 2, domain: 'y.example.com' })];
    const { newClusters } = groupByDomain(tabs, taken);

    expect(newClusters).toHaveLength(2);
    for (const c of newClusters) {
      expect(c.size).toEqual(AUTO_CLUSTER_SIZE);
      for (const other of taken) {
        const w = Math.min(c.position.x + c.size.width, other.position.x + other.size.width) -
          Math.max(c.position.x, other.position.x);
        const h = Math.min(c.position.y + c.size.height, other.position.y + other.size.height) -
          Math.max(c.position.y, other.position.y);
        expect(w > 0 && h > 0).toBe(false); // no overlap with existing frames
      }
    }
    // Third cascade slot is (920, 80); the two new frames take slots 3 and 4.
    expect(newClusters[0]!.position).toEqual({ x: 920, y: 80 });
    expect(newClusters[1]!.position).toEqual({ x: 80, y: 400 });
  });

  it('suffixed ids avoid collisions with existing cluster ids', () => {
    const taken = [cluster({ id: 'cluster-domain-github.com', name: 'github.com' })];
    const tabs = [tab({ tabId: 1, domain: 'github.com' })];
    const { newClusters } = groupByDomain(tabs, taken);
    expect(newClusters[0]!.id).toBe('cluster-domain-github.com-2');
  });

  it('is a no-op when every tab is already clustered', () => {
    const tabs = [tab({ tabId: 1, domain: 'github.com', clusterId: 'cluster-user' })];
    const { newClusters, assignments } = groupByDomain(tabs, [cluster({ id: 'cluster-user' })]);
    expect(newClusters).toHaveLength(0);
    expect(assignments.size).toBe(0);
  });
});
