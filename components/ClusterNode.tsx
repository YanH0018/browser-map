import { useEffect, useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { WorkspaceCluster } from '../lib/types';

/** Named spatial grouping drawn behind its member tab cards. */
export default function ClusterNode({ data }: NodeProps) {
  const cluster = (data as { cluster: WorkspaceCluster }).cluster;
  const renameCluster = useWorkspaceStore((s) => s.renameCluster);
  const deleteCluster = useWorkspaceStore((s) => s.deleteCluster);

  // Inline rename (M5 item 2): double-click the title (or press ✎) to edit
  // in place; Enter/blur commits, Escape cancels. Replaces window.prompt.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cluster.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEditing = () => {
    setDraft(cluster.name);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== cluster.name) renameCluster(cluster.id, name);
  };

  return (
    <div className="bw-cluster-node">
      {editing ? (
        <input
          ref={inputRef}
          className="bw-cluster-name-input"
          value={draft}
          aria-label={`Rename cluster ${cluster.name}`}
          // Keep typing/dragging inside the input from panning or dragging
          // the node.
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span
          className="bw-cluster-name"
          title="Double-click to rename"
          // Stop mousedown so double-clicking the title does not start a
          // node drag.
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={startEditing}
        >
          {cluster.name}
        </span>
      )}
      <span className="bw-cluster-actions">
        {!editing && (
          <button
            type="button"
            title="Rename cluster"
            aria-label={`Rename cluster ${cluster.name}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={startEditing}
          >
            ✎
          </button>
        )}
        <button
          type="button"
          title="Delete cluster (member tabs are unassigned, not closed)"
          aria-label={`Delete cluster ${cluster.name}`}
          onMouseDown={(e) => e.stopPropagation()}
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
