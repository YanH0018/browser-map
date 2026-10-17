import { useWorkspaceStore, suggestPosition } from '../stores/workspaceStore';

export default function Toolbar() {
  const searchQuery = useWorkspaceStore((s) => s.searchQuery);
  const setSearchQuery = useWorkspaceStore((s) => s.setSearchQuery);
  const createCluster = useWorkspaceStore((s) => s.createCluster);

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
    </header>
  );
}
