import { useEffect } from 'react';
import { browser } from 'wxt/browser';
import Toolbar from '../../components/Toolbar';
import WorkspaceCanvas from '../../components/WorkspaceCanvas';
import InspectorPanel from '../../components/InspectorPanel';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { queryWorkspaceTabs } from '../../lib/browserAdapter';
import { applySnapshotToTabs } from '../../lib/persistence';
import {
  loadNamedSnapshots,
  loadSnapshot,
  saveNamedSnapshots,
  saveSnapshot,
} from '../../lib/workspaceStorage';
import { serializeWorkspace } from '../../lib/persistence';

/**
 * Workspace is a full extension page (not a toolbar popup) — see
 * docs/PRODUCT.md. It syncs with live browser tabs and persists the
 * spatial arrangement locally.
 */
export default function App() {
  const setTabs = useWorkspaceStore((s) => s.setTabs);
  const setViewport = useWorkspaceStore((s) => s.setViewport);

  // Initial load: persisted layout merged onto live tabs, plus any
  // user-named snapshots.
  useEffect(() => {
    void (async () => {
      const [snapshot, live, named] = await Promise.all([
        loadSnapshot(),
        queryWorkspaceTabs(),
        loadNamedSnapshots(),
      ]);
      if (snapshot) {
        setTabs(applySnapshotToTabs(live, snapshot));
        setViewport(snapshot.viewport);
        useWorkspaceStore.setState({ clusters: snapshot.clusters });
      } else {
        setTabs(live);
      }
      useWorkspaceStore.setState({ namedSnapshots: named });
    })();
  }, [setTabs, setViewport]);

  // Re-sync when the background reports tab changes.
  useEffect(() => {
    const listener = (message: unknown) => {
      if ((message as { type?: string })?.type === 'bw:tabs-changed') {
        void queryWorkspaceTabs(useWorkspaceStore.getState().tabs).then(setTabs);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [setTabs]);

  // Persist relevant state on change (debounced).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useWorkspaceStore.subscribe((s) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void saveSnapshot(serializeWorkspace(s.tabs, s.clusters, s.viewport));
      }, 500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  // Persist named snapshots only when they change (debounced).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useWorkspaceStore.subscribe((s, prev) => {
      if (s.namedSnapshots === prev.namedSnapshots) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void saveNamedSnapshots(s.namedSnapshots);
      }, 500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  return (
    <div className="bw-app">
      <Toolbar />
      <WorkspaceCanvas />
      <InspectorPanel />
    </div>
  );
}
