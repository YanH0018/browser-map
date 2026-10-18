import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type NodeProps,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { selectVisibleTabs, useWorkspaceStore } from '../stores/workspaceStore';
import { clusterRects, resolveClusterDrop } from '../lib/clusterDrop';
import { windowBadges } from '../lib/windowBadge';
import TabNode from './TabNode';
import ClusterNode from './ClusterNode';

const nodeTypes = { tab: TabNode, cluster: ClusterNode };

// Fallback card size for drop math when XYFlow has not measured yet.
const TAB_CARD_FALLBACK = { width: 240, height: 68 };

export default function WorkspaceCanvas() {
  const tabs = useWorkspaceStore(selectVisibleTabs);
  // Badges derive from the full tab list so window labels stay stable
  // while a search filter hides cards.
  const allTabs = useWorkspaceStore((s) => s.tabs);
  // Keyboard-navigation selection (M5 item 1, D12): rendered as a CSS
  // class on the card. Deliberately NOT XYFlow's node.selected, which
  // would enable React Flow's own arrow-move / delete key semantics.
  const selectedTabIds = useWorkspaceStore((s) => s.selectedTabIds);
  const clusters = useWorkspaceStore((s) => s.clusters);
  const moveTab = useWorkspaceStore((s) => s.moveTab);
  const moveCluster = useWorkspaceStore((s) => s.moveCluster);
  const assignTab = useWorkspaceStore((s) => s.assignTab);
  const selectTab = useWorkspaceStore((s) => s.selectTab);
  const setViewport = useWorkspaceStore((s) => s.setViewport);

  const nodes = useMemo<Node[]>(() => {
    // Multi-window badges (M4 item 3): derived from the full tab list so
    // every card knows its window even while a search filter hides others.
    const badges = windowBadges(allTabs);
    // Clusters are draggable frames (M5 item 2, D13); member cards do not
    // follow a moving cluster — assignment is by explicit drop, not containment.
    const clusterNodes: Node[] = clusters.map((c) => ({
      id: c.id,
      type: 'cluster',
      position: c.position,
      data: { cluster: c },
      style: { width: c.size.width, height: c.size.height },
      selectable: false,
    }));
    const tabNodes: Node[] = tabs.map((t) => ({
      id: String(t.tabId),
      type: 'tab',
      position: t.position,
      data: { tab: t, badge: badges.get(t.windowId), selected: t.tabId === selectedTabIds[0] },
    }));
    return [...clusterNodes, ...tabNodes];
  }, [tabs, allTabs, clusters, selectedTabIds]);

  const onNodesChange = (changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position && change.id) {
        // Cluster ids are strings ('cluster-...'); tab ids are numeric.
        if (change.id.startsWith('cluster-')) {
          moveCluster(change.id, change.position);
        } else {
          const tabId = Number(change.id);
          if (!Number.isNaN(tabId)) moveTab(tabId, change.position);
        }
      }
    }
  };

  // Drop detection: a card released over a cluster joins it; released in
  // open space, an assigned card leaves its cluster.
  const onNodeDragStop = (_e: unknown, node: Node) => {
    if (node.type !== 'tab') return;
    const tabId = Number(node.id);
    if (Number.isNaN(tabId)) return;
    const size = {
      width: node.measured?.width ?? TAB_CARD_FALLBACK.width,
      height: node.measured?.height ?? TAB_CARD_FALLBACK.height,
    };
    const targetId = resolveClusterDrop(
      { x: node.position.x, y: node.position.y, width: size.width, height: size.height },
      clusterRects(clusters),
    );
    const current = useWorkspaceStore.getState().tabs.find((t) => t.tabId === tabId)?.clusterId;
    if (targetId !== current) assignTab(tabId, targetId);
  };

  return (
    <div className="bw-canvas">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_e, node) => {
          const tabId = Number(node.id);
          selectTab(Number.isNaN(tabId) ? null : tabId);
        }}
        onMoveEnd={(_e, viewport) => setViewport(viewport)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export type { NodeProps };
