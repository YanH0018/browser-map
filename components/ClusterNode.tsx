import type { NodeProps } from '@xyflow/react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { WorkspaceCluster } from '../lib/types';

/** Named spatial grouping drawn behind its member tab cards. */
export default function ClusterNode({ data }: NodeProps) {
  const cluster = (data as { cluster: WorkspaceCluster }).cluster;
  const renameCluster = useWorkspaceStore((s) => s.renameCluster);
  const deleteCluster = useWorkspaceStore((s) => s.deleteCluster);

  return (
    <div className="bw-cluster-node">
      <span className="bw-cluster-name">{cluster.name}</span>
      <span className="bw-cluster-actions">
        <button
          type="button"
          title="Rename cluster"
          onClick={(e) => {
            e.stopPropagation();
            const name = window.prompt('Cluster name', cluster.name);
            if (name && name !== cluster.name) renameCluster(cluster.id, name);
          }}
        >
          ✎
        </button>
        <button
          type="button"
          title="Delete cluster (member tabs are unassigned, not closed)"
          onClick={(e) => {
            e.stopPropagation();
            const members = useWorkspaceStore
              .getState()
              .tabs.filter((t) => t.clusterId === cluster.id).length;
            const detail =
              members > 0 ? ` Its ${members} tab card(s) will be unassigned, not closed.` : '';
            if (window.confirm(`Delete cluster "${cluster.name}"?${detail}`)) {
              deleteCluster(cluster.id);
            }
          }}
        >
          ×
        </button>
      </span>
    </div>
  );
}
