import type { WorkspaceCluster, WorkspaceTab } from './types';
import { nextFreeClusterPosition, uniqueClusterId, AUTO_CLUSTER_SIZE } from './autoLayout';

/**
 * Pure semantic-clustering math (M7). No I/O, no browser APIs: the store
 * feeds it embedding vectors and applies its results (see D18). All
 * functions are deterministic for a given input order.
 */

/**
 * Default cosine-similarity threshold for "same topic" (D18). Calibrated
 * against nomic-embed-text-v1.5 on `title + " " + hostname` texts:
 * same-topic pairs measured 0.57–0.85, cross-topic pairs 0.36–0.43;
 * 0.5 sits in the gap between them.
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.5;

/** Groups with fewer members than this are not turned into clusters (noise). */
export const MIN_CLUSTER_SIZE = 2;

/**
 * Cosine similarity of two vectors, by hand (no library). Returns 0 for
 * empty/mismatched-length inputs and zero vectors — a safe "unrelated"
 * value that can never trigger a merge.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

/** One item to cluster: an opaque id plus its embedding vector. */
export interface ClusterItem<T> {
  id: T;
  vector: readonly number[];
}

/**
 * Greedy threshold clustering (single-linkage agglomerative): compute every
 * pair's cosine similarity, sort pairs by similarity descending (ties broken
 * by index), and union-find-merge while the pair's similarity is at or above
 * `threshold`. Items that never merge remain singleton groups.
 *
 * Determinism: for a fixed input order the merges are fully determined;
 * group membership is independent of input order, and groups come back
 * ordered by their first member's position in the input.
 */
export function clusterByThreshold<T>(
  items: readonly ClusterItem<T>[],
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
): T[][] {
  const n = items.length;
  if (n === 0) return [];

  const parent: number[] = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!; // path halving
      i = parent[i]!;
    }
    return i;
  };

  const pairs: { sim: number; i: number; j: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push({ sim: cosineSimilarity(items[i]!.vector, items[j]!.vector), i, j });
    }
  }
  pairs.sort((p, q) => q.sim - p.sim || p.i - q.i || p.j - q.j);
  for (const { sim, i, j } of pairs) {
    if (sim < threshold) continue; // sorted desc: nothing later can merge either pair
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[rj] = ri;
  }

  // Insertion order of the map = first (lowest-index) member per group,
  // so the output is ordered by each group's first member in the input.
  const groups = new Map<number, T[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(items[i]!.id);
    else groups.set(root, [items[i]!.id]);
  }
  return [...groups.values()];
}

/**
 * Most common non-empty domain among the members; ties break to the
 * lexicographically smallest domain (deterministic). '' when no member has
 * a parseable domain.
 */
export function dominantDomain(members: readonly WorkspaceTab[]): string {
  const counts = new Map<string, number>();
  for (const t of members) {
    if (!t.domain) continue;
    counts.set(t.domain, (counts.get(t.domain) ?? 0) + 1);
  }
  let best = '';
  for (const [domain, count] of counts) {
    const bestCount = best ? counts.get(best)! : 0;
    if (count > bestCount || (count === bestCount && domain < best)) best = domain;
  }
  return best;
}

/**
 * Longest common prefix of all titles, cut back to a word boundary so the
 * name does not end mid-word. '' when there is no shared prefix.
 */
export function commonTitlePrefix(titles: readonly string[]): string {
  const nonEmpty = titles.filter((t) => t.length > 0);
  if (nonEmpty.length === 0) return '';
  const sorted = [...nonEmpty].sort();
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  let i = 0;
  while (i < min.length && i < max.length && min[i] === max[i]) i++;
  let prefix = min.slice(0, i);
  const space = prefix.lastIndexOf(' ');
  if (space > 0) prefix = prefix.slice(0, space); // drop the trailing partial word
  return prefix.trim();
}

/**
 * Name for a suggested cluster (D18): the dominant domain of the group,
 * falling back to the common title prefix, then the first member's title.
 */
export function suggestedClusterName(members: readonly WorkspaceTab[]): string {
  return (
    dominantDomain(members) ||
    commonTitlePrefix(members.map((t) => t.title)) ||
    members[0]?.title?.trim() ||
    'Untitled'
  );
}

export interface SuggestedClusterResult {
  /** New clusters to add. Existing clusters are never touched (D17/D18). */
  newClusters: WorkspaceCluster[];
  /** tabId → clusterId assignments for previously unclustered tabs. */
  assignments: Map<number, string>;
}

/**
 * Turn embedding vectors into concrete cluster suggestions (M7 item 3):
 * greedy threshold clustering over UNCLUSTERED tabs that have a vector;
 * groups smaller than MIN_CLUSTER_SIZE stay unclustered (singletons are
 * noise); each remaining group becomes a new cluster named by its dominant
 * domain (fallback: common title prefix), placed at the first free cascade
 * slot that does not overlap existing frames (M6 geometry). Ids are stable
 * (`cluster-semantic-<k>`, numeric suffix on collision) and the result is
 * deterministic for a given input.
 */
export function buildSuggestedClusters(
  tabs: readonly WorkspaceTab[],
  clusters: readonly WorkspaceCluster[],
  vectorsByTabId: ReadonlyMap<number, number[]>,
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
): SuggestedClusterResult {
  const items: ClusterItem<WorkspaceTab>[] = [];
  for (const t of tabs) {
    if (t.clusterId !== undefined) continue; // never touch existing assignments
    const vector = vectorsByTabId.get(t.tabId);
    if (vector) items.push({ id: t, vector });
  }

  const newClusters: WorkspaceCluster[] = [];
  const assignments = new Map<number, string>();
  let k = 0;

  for (const group of clusterByThreshold(items, threshold)) {
    if (group.length < MIN_CLUSTER_SIZE) continue; // singletons stay unclustered
    k++;
    const taken = [...clusters, ...newClusters];
    const cluster: WorkspaceCluster = {
      id: uniqueClusterId(`cluster-semantic-${k}`, taken),
      name: suggestedClusterName(group),
      position: nextFreeClusterPosition(taken, k - 1),
      size: { ...AUTO_CLUSTER_SIZE },
    };
    newClusters.push(cluster);
    for (const t of group) assignments.set(t.tabId, cluster.id);
  }

  return { newClusters, assignments };
}
