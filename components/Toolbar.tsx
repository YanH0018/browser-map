import { useWorkspaceStore, suggestPosition } from '../stores/workspaceStore';

export default function Toolbar() {
  const searchQuery = useWorkspaceStore((s) => s.searchQuery);
  const setSearchQuery = useWorkspaceStore((s) => s.setSearchQuery);
  const createCluster = useWorkspaceStore((s) => s.createCluster);
  const namedSnapshots = useWorkspaceStore((s) => s.namedSnapshots);
  const saveNamedSnapshot = useWorkspaceStore((s) => s.saveNamedSnapshot);
  const restoreNamedSnapshot = useWorkspaceStore((s) => s.restoreNamedSnapshot);
  const deleteNamedSnapshot = useWorkspaceStore((s) => s.deleteNamedSnapshot);

  return (
    <header className="bw-toolbar">
      <input
        type="search"
        placeholder="Search title, URL, domain, cluster…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <button
        onClick={() => {
          const name = window.prompt('Cluster name');
          if (name) createCluster(name, suggestPosition(useWorkspaceStore.getState()));
        }}
      >
        New cluster
      </button>
      <button
        onClick={() => {
          const name = window.prompt('Snapshot name');
          if (name?.trim()) saveNamedSnapshot(name.trim());
        }}
      >
        Save snapshot
      </button>
      {namedSnapshots.length > 0 && (
        <div className="bw-snapshots">
          {namedSnapshots.map((snap) => (
            <span key={snap.id} className="bw-snapshot-item">
              {snap.name}
              <button onClick={() => restoreNamedSnapshot(snap.id)}>Restore</button>
              <button
                aria-label={`Delete snapshot ${snap.name}`}
                onClick={() => {
                  if (window.confirm(`Delete snapshot "${snap.name}"?`)) deleteNamedSnapshot(snap.id);
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
