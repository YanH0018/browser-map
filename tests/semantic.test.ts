import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  MIN_CLUSTER_SIZE,
  buildSuggestedClusters,
  clusterByThreshold,
  commonTitlePrefix,
  cosineSimilarity,
  dominantDomain,
  suggestedClusterName,
} from '../lib/semantic';
import type { WorkspaceTab } from '../lib/types';

/** Fixed 2-D vectors with hand-computed cosines (deterministic test data). */
const V: Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'p' | 'q' | 'h', number[]> = {
  a: [1, 0], // cos(a,b) = 0.6 — just above the default threshold
  b: [3, 4], // cos(b,c) = 0.96, cos(b,d) ≈ 0.9692
  c: [4, 3], // cos(c,d) ≈ 0.8615
  d: [5, 12], // cos(a,e) = 0 (orthogonal), cos(a,f) = -1
  e: [0, 1], // NOTE: cos(b,e) = 0.8 — NOT "far" from b/c; use f or h for that
  f: [-1, 0], // cos(a,f) = -1, cos(b,f) = -0.6 — far from a and b
  p: [1, -2], // cos(p,q) ≈ 0.99; ≤ 0.45 from a, b, c
  q: [2, -3], // cos(q,p) ≈ 0.99; < 0.5 from b, c
  h: [-1, -1], // ≤ 0.32 from a..q — far from everything (singleton fodder)
};

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

describe('cosineSimilarity', () => {
  it('is 1 for identical and parallel vectors (magnitude independent)', () => {
    expect(cosineSimilarity([1, 2], [1, 2])).toBeCloseTo(1);
    expect(cosineSimilarity([3, 4], [6, 8])).toBeCloseTo(1);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(V.a, V.e)).toBe(0);
  });

  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity(V.a, V.f)).toBeCloseTo(-1);
  });

  it('returns the hand-computed value for the fixed test vectors', () => {
    expect(cosineSimilarity(V.a, V.b)).toBeCloseTo(0.6);
    expect(cosineSimilarity(V.b, V.c)).toBeCloseTo(0.96);
  });

  it('returns 0 (safe "unrelated") for zero, empty or mismatched inputs', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
  });
});

describe('clusterByThreshold', () => {
  it('returns [] for empty input and a singleton group for one item', () => {
    expect(clusterByThreshold([])).toEqual([]);
    expect(
      clusterByThreshold([{ id: 'x', vector: V.a }]),
    ).toEqual([['x']]);
  });

  it('merges pairs at or above the threshold, keeps below-threshold pairs apart', () => {
    // cos(a,b) = 0.6 ≥ 0.5 → merged; f is far from both (cos ≤ -0.6) → separate.
    const groups = clusterByThreshold(
      [
        { id: 'a', vector: V.a },
        { id: 'b', vector: V.b },
        { id: 'f', vector: V.f },
      ],
    );
    expect(groups).toEqual([['a', 'b'], ['f']]);

    // Raising the threshold above 0.6 splits the pair into singletons.
    const strict = clusterByThreshold(
      [
        { id: 'a', vector: V.a },
        { id: 'b', vector: V.b },
      ],
      0.9,
    );
    expect(strict).toEqual([['a'], ['b']]);

    // A pair exactly at the threshold (identical vectors, threshold 1) merges.
    const exact = clusterByThreshold(
      [
        { id: 'a', vector: V.a },
        { id: 'b', vector: [2, 0] },
      ],
      1,
    );
    expect(exact).toEqual([['a', 'b']]);
  });

  it('merges transitively (single linkage): a~b and b~c ⇒ one group', () => {
    // cos(b,c) ≈ 0.96 and cos(a,b) = 0.6, but a is only 0.6 from b and
    // c·d ≈ 0.86 — with the default threshold all of b,c,d chain together
    // and a joins through b.
    const groups = clusterByThreshold([
      { id: 'a', vector: V.a },
      { id: 'b', vector: V.b },
      { id: 'c', vector: V.c },
      { id: 'd', vector: V.d },
    ]);
    expect(groups).toEqual([['a', 'b', 'c', 'd']]);

    // A far item never joins.
    const withF = clusterByThreshold([
      { id: 'a', vector: V.a },
      { id: 'b', vector: V.b },
      { id: 'f', vector: V.f },
    ]);
    expect(withF).toEqual([['a', 'b'], ['f']]);
  });

  it('is deterministic: same input → identical output, membership is order-independent', () => {
    const items = [
      { id: 'a', vector: V.a },
      { id: 'b', vector: V.b },
      { id: 'c', vector: V.c },
      { id: 'd', vector: V.d },
      { id: 'e', vector: V.e },
    ];
    const first = clusterByThreshold(items);
    expect(clusterByThreshold(items)).toEqual(first);

    // Shuffled input: same group membership (compared as sets of ids).
    const shuffled = [items[3]!, items[0]!, items[4]!, items[2]!, items[1]!];
    const asSets = (groups: string[][]) =>
      groups.map((g) => [...g].sort().join(',')).sort();
    expect(asSets(clusterByThreshold(shuffled))).toEqual(asSets(first));
  });

  it('orders groups by each group\'s first member in the input', () => {
    // f is far from both (own group) and appears first; a~b second.
    const groups = clusterByThreshold([
      { id: 'f', vector: V.f },
      { id: 'a', vector: V.a },
      { id: 'b', vector: V.b },
    ]);
    expect(groups).toEqual([['f'], ['a', 'b']]);
  });

  it('keeps unrelated items as singleton groups (filtering happens upstream)', () => {
    const groups = clusterByThreshold([
      { id: 'a', vector: V.a },
      { id: 'e', vector: V.e },
      { id: 'f', vector: V.f },
    ]);
    // a·e = 0, a·f = -1, e·f = 0 → nothing merges.
    expect(groups).toEqual([['a'], ['e'], ['f']]);
  });
});

describe('dominantDomain', () => {
  it('returns the most common non-empty domain', () => {
    const members = [
      tab({ tabId: 1, domain: 'github.com' }),
      tab({ tabId: 2, domain: 'github.com' }),
      tab({ tabId: 3, domain: 'arxiv.org' }),
    ];
    expect(dominantDomain(members)).toBe('github.com');
  });

  it('breaks ties to the lexicographically smallest domain', () => {
    const members = [
      tab({ tabId: 1, domain: 'zeta.org' }),
      tab({ tabId: 2, domain: 'alpha.org' }),
    ];
    expect(dominantDomain(members)).toBe('alpha.org');
  });

  it('returns "" when no member has a parseable domain', () => {
    expect(dominantDomain([tab({ tabId: 1, domain: '' })])).toBe('');
    expect(dominantDomain([])).toBe('');
  });
});

describe('commonTitlePrefix', () => {
  it('returns the shared prefix cut back to a word boundary', () => {
    expect(commonTitlePrefix(['PyTorch docs', 'PyTorch tutorial'])).toBe('PyTorch');
  });

  it('returns "" when there is no shared prefix or all titles are empty', () => {
    expect(commonTitlePrefix(['Alpha', 'Beta'])).toBe('');
    expect(commonTitlePrefix([])).toBe('');
    expect(commonTitlePrefix(['', ''])).toBe('');
  });

  it('keeps a prefix that already ends at a word boundary', () => {
    // "Alpha" is the whole shorter title — it ends at a word boundary.
    expect(commonTitlePrefix(['Alpha', 'Alphabet'])).toBe('Alpha');
  });

  it('ignores empty titles when computing the prefix', () => {
    expect(commonTitlePrefix(['', 'PyTorch docs', 'PyTorch tutorial'])).toBe('PyTorch');
  });
});

describe('suggestedClusterName', () => {
  it('prefers the dominant domain of the group', () => {
    const members = [
      tab({ tabId: 1, domain: 'github.com', title: 'Repo A' }),
      tab({ tabId: 2, domain: 'github.com', title: 'Repo B' }),
      tab({ tabId: 3, domain: '', title: 'PyTorch docs' }),
    ];
    expect(suggestedClusterName(members)).toBe('github.com');
  });

  it('falls back to the common title prefix when no member has a domain', () => {
    const members = [
      tab({ tabId: 1, domain: '', title: 'PyTorch docs' }),
      tab({ tabId: 2, domain: '', title: 'PyTorch tutorial' }),
    ];
    expect(suggestedClusterName(members)).toBe('PyTorch');
  });

  it('falls back to the first member\'s title, then "Untitled"', () => {
    const members = [
      tab({ tabId: 1, domain: '', title: 'Lone page' }),
      tab({ tabId: 2, domain: '', title: 'Other page' }),
    ];
    expect(suggestedClusterName(members)).toBe('Lone page');

    const blank = [
      tab({ tabId: 1, domain: '', title: '' }),
      tab({ tabId: 2, domain: '', title: '   ' }),
    ];
    expect(suggestedClusterName(blank)).toBe('Untitled');
  });
});

describe('buildSuggestedClusters', () => {
  const vectors = (pairs: Array<[number, number[]]>): Map<number, number[]> =>
    new Map(pairs);

  it('clusters unclustered tabs with vectors; names by dominant domain', () => {
    const tabs = [
      tab({ tabId: 1, domain: 'github.com', title: 'Repo A' }),
      tab({ tabId: 2, domain: 'github.com', title: 'Repo B' }),
      tab({ tabId: 3, domain: '', title: 'PyTorch docs' }),
      tab({ tabId: 4, domain: '', title: 'PyTorch tutorial' }),
      tab({ tabId: 5, domain: '', title: 'Unrelated' }), // singleton → stays out
    ];
    const { newClusters, assignments } = buildSuggestedClusters(
      tabs,
      [],
      vectors([
        [1, V.b],
        [2, V.c], // cos ≈ 0.96 → group with tab 1
        [3, V.p],
        [4, V.q], // cos(p,q) ≈ 0.99 → group with tab 3
        [5, V.h], // far from everything (≤ 0.32) → singleton
      ]),
    );

    expect(newClusters).toHaveLength(2);
    const names = newClusters.map((c) => c.name).sort();
    expect(names).toEqual(['PyTorch', 'github.com']);

    const github = newClusters.find((c) => c.name === 'github.com')!;
    const pytorch = newClusters.find((c) => c.name === 'PyTorch')!;
    expect(assignments.get(1)).toBe(github.id);
    expect(assignments.get(2)).toBe(github.id);
    expect(assignments.get(3)).toBe(pytorch.id);
    expect(assignments.get(4)).toBe(pytorch.id);
    expect(assignments.has(5)).toBe(false); // singleton never assigned

    // Stable, predictable ids.
    expect(newClusters.map((c) => c.id).sort()).toEqual([
      'cluster-semantic-1',
      'cluster-semantic-2',
    ]);
  });

  it('never touches tabs that already belong to a cluster, even with vectors', () => {
    const existing = {
      id: 'cluster-user',
      name: 'User cluster',
      position: { x: 0, y: 0 },
      size: { width: 360, height: 260 },
    };
    const tabs = [
      tab({ tabId: 1, clusterId: existing.id }), // clustered → excluded
      tab({ tabId: 2 }),
      tab({ tabId: 3 }),
    ];
    const { newClusters, assignments } = buildSuggestedClusters(
      tabs,
      [existing],
      vectors([
        [1, V.b], // vector exists but the tab is already clustered
        [2, V.c],
        [3, V.d], // cos(c,d) ≈ 0.86 → group
      ]),
    );

    expect(newClusters).toHaveLength(1);
    expect(assignments.has(1)).toBe(false); // existing assignment untouched
    expect(assignments.get(2)).toBe(newClusters[0]!.id);
    expect(assignments.get(3)).toBe(newClusters[0]!.id);
  });

  it('ignores tabs without a vector (they stay unclustered, no crash)', () => {
    const tabs = [tab({ tabId: 1 }), tab({ tabId: 2 }), tab({ tabId: 3 })];
    const { newClusters, assignments } = buildSuggestedClusters(
      tabs,
      [],
      vectors([
        [1, V.b],
        [2, V.c], // pair above threshold
      ]),
    );
    expect(newClusters).toHaveLength(1);
    expect(assignments.get(3)).toBeUndefined(); // no vector → not clustered
  });

  it('skips groups smaller than MIN_CLUSTER_SIZE (singletons are noise)', () => {
    expect(MIN_CLUSTER_SIZE).toBe(2);
    const tabs = [tab({ tabId: 1 }), tab({ tabId: 2 })];
    const { newClusters } = buildSuggestedClusters(
      tabs,
      [],
      vectors([
        [1, V.a], // orthogonal pair → two singleton groups
        [2, V.e],
      ]),
    );
    expect(newClusters).toHaveLength(0);
  });

  it('places new frames at free positions that never overlap existing ones', () => {
    const taken = [
      // Occupy the first cascade slots so new frames must move on.
      { id: 'c1', name: 'A', position: { x: 80, y: 80 }, size: { width: 360, height: 260 } },
      { id: 'c2', name: 'B', position: { x: 480, y: 80 }, size: { width: 360, height: 260 } },
    ];
    const tabs = [tab({ tabId: 1 }), tab({ tabId: 2 })];
    const { newClusters } = buildSuggestedClusters(
      tabs,
      taken,
      vectors([
        [1, V.b],
        [2, V.c],
      ]),
    );
    expect(newClusters).toHaveLength(1);
    const frame = newClusters[0]!;
    for (const other of [...taken, ...newClusters]) {
      if (other.id === frame.id) continue;
      const overlapW =
        Math.min(frame.position.x + frame.size.width, other.position.x + other.size.width) -
        Math.max(frame.position.x, other.position.x);
      const overlapH =
        Math.min(frame.position.y + frame.size.height, other.position.y + other.size.height) -
        Math.max(frame.position.y, other.position.y);
      expect(overlapW > 0 && overlapH > 0).toBe(false); // no overlap
    }
  });

  it('uses collision-safe ids when a semantic cluster id already exists', () => {
    const taken = [
      { id: 'cluster-semantic-1', name: 'Old', position: { x: 0, y: 0 }, size: { width: 360, height: 260 } },
    ];
    const tabs = [tab({ tabId: 1 }), tab({ tabId: 2 })];
    const { newClusters } = buildSuggestedClusters(
      tabs,
      taken,
      vectors([
        [1, V.b],
        [2, V.c],
      ]),
    );
    expect(newClusters[0]?.id).toBe('cluster-semantic-1-2');
  });

  it('is deterministic for a given input', () => {
    const tabs = [tab({ tabId: 1 }), tab({ tabId: 2 }), tab({ tabId: 3 })];
    const vecs = vectors([
      [1, V.b],
      [2, V.c],
      [3, V.d],
    ]);
    const first = buildSuggestedClusters(tabs, [], vecs);
    const second = buildSuggestedClusters(tabs, [], vecs);
    expect(second.newClusters).toEqual(first.newClusters);
    expect([...second.assignments.entries()]).toEqual([...first.assignments.entries()]);
  });

  it('respects a custom threshold', () => {
    const tabs = [tab({ tabId: 1 }), tab({ tabId: 2 })];
    const vecs = vectors([
      [1, V.a], // cos(a,b) = 0.6
      [2, V.b],
    ]);
    // Default threshold (0.5) merges them…
    expect(buildSuggestedClusters(tabs, [], vecs).newClusters).toHaveLength(1);
    // …a stricter threshold (0.9) does not.
    expect(
      buildSuggestedClusters(tabs, [], vecs, 0.9).newClusters,
    ).toHaveLength(0);
    expect(DEFAULT_SIMILARITY_THRESHOLD).toBe(0.5);
  });
});
