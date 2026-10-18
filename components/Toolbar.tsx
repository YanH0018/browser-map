import { useWorkspaceStore, suggestPosition } from '../stores/workspaceStore';

export default function Toolbar() {
  const searchQuery = useWorkspaceStore((s) => s.searchQuery);
  const setSearchQuery = useWorkspaceStore((s) => s.setSearchQuery);
  const createCluster = useWorkspaceStore((s) => s.createCluster);
  const namedSnapshots = useWorkspaceStore((s) => s.namedSnapshots);
  const saveNamedSnapshot = useWorkspaceStore((s) => s.saveNamedSnapshot);
  const restoreNamedSnapshot = useWorkspaceStore((s) => s.restoreNamedSnapshot);
  const deleteNamedSnapshot = useWorkspaceStore((s) => s.deleteNamedSnapshot);
  const tidyGrid = useWorkspaceStore((s) => s.tidyGrid);
  const groupByDomain = useWorkspaceStore((s) => s.groupByDomain);

  return (
    <header className="bw-toolbar">
      <input
        type="search"
        placeholder="Search title, URL, domain, cluster…"
        aria-label="Search tabs by title, URL, domain or cluster"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <button
        aria-label="Create a new cluster"
        onClick={() => {
          const name = window.prompt('Cluster name');
          if (name) createCluster(name, suggestPosition(useWorkspaceStore.getState()));
        }}
      >
        New cluster
      </button>
      <button
        aria-label="Save the current layout as a named snapshot"
        onClick={() => {
          const name = window.prompt('Snapshot name');
          if (name?.trim()) saveNamedSnapshot(name.trim());
        }}
      >
        Save snapshot
      </button>
      <span className="bw-autolayout" role="group" aria-label="Automatic layout">
        <button
          aria-label="Tidy grid: snap every card onto a regular grid"
          onClick={() => tidyGrid()}
        >
          Tidy grid
        </button>
        <button
          aria-label="Group by domain: create one cluster per tab domain"
          onClick={() => groupByDomain()}
        >
          Group by domain
        </button>
      </span>
      {namedSnapshots.length > 0 && (
        <div className="bw-snapshots">
          {namedSnapshots.map((snap) => (
            <span key={snap.id} className="bw-snapshot-item">
              {snap.name}
              <button
                aria-label={`Restore snapshot ${snap.name}`}
                onClick={() => restoreNamedSnapshot(snap.id)}
              >
                Restore
              </button>
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
