import { useWorkspaceStore } from '../stores/workspaceStore';
import { activateBrowserTab, closeBrowserTab } from '../lib/browserAdapter';
import { windowBadges } from '../lib/windowBadge';

/** Side panel: metadata and actions for the selected tab. */
export default function InspectorPanel() {
  const selectedId = useWorkspaceStore((s) => s.selectedTabIds[0]);
  const tab = useWorkspaceStore((s) => s.tabs.find((t) => t.tabId === selectedId));
  const windowLabel = useWorkspaceStore((s) => {
    if (!tab) return undefined;
    return windowBadges(s.tabs).get(tab.windowId)?.label;
  });
  const removeTab = useWorkspaceStore((s) => s.removeTab);

  if (!tab) {
    return <aside className="bw-inspector">Select a tab card to inspect it.</aside>;
  }

  return (
    <aside className="bw-inspector">
      <h3>{tab.title}</h3>
      <p>{tab.domain}</p>
      <p style={{ wordBreak: 'break-all' }}>{tab.url}</p>
      <p>
        Position: ({Math.round(tab.position.x)}, {Math.round(tab.position.y)})
        {windowLabel ? ` · Window: ${windowLabel}` : ''}
        {tab.clusterId ? ` · Cluster: ${tab.clusterId}` : ''}
      </p>
      <button onClick={() => void activateBrowserTab(tab)}>Activate tab</button>{' '}
      <button
        onClick={() => {
          void closeBrowserTab(tab);
          removeTab(tab.tabId);
        }}
      >
        Close tab
      </button>
    </aside>
  );
}
