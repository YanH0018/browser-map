import type { WorkspaceCluster, WorkspaceTab } from './types';

/**
 * Deterministic, local search (M3). No AI, no network.
 * Searchable fields: title, URL, domain, cluster name.
 */
export function filterTabs(
  tabs: WorkspaceTab[],
  clusters: WorkspaceCluster[],
  query: string,
): WorkspaceTab[] {
  const q = query.trim().toLowerCase();
  if (q === '') return tabs;

  const clusterNameById = new Map(clusters.map((c) => [c.id, c.name.toLowerCase()]));

  return tabs.filter((tab) => {
    if (tab.title.toLowerCase().includes(q)) return true;
    if (tab.url.toLowerCase().includes(q)) return true;
    if (tab.domain.toLowerCase().includes(q)) return true;
    const clusterName = tab.clusterId ? clusterNameById.get(tab.clusterId) : undefined;
    return clusterName !== undefined && clusterName.includes(q);
  });
}
