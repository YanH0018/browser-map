import { useCallback, useMemo } from 'react';
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
import { windowBadges, type WindowBadge } from '../lib/windowBadge';
import type { Viewport, WorkspaceCluster, WorkspaceTab } from '../lib/types';
import TabNode from './TabNode';
import ClusterNode from './ClusterNode';

const nodeTypes = { tab: TabNode, cluster: ClusterNode };

// Fallback card size for drop math when XYFlow has not measured yet.
const TAB_CARD_FALLBACK = { width: 240, height: 68 };

type TabNodeData = { tab: WorkspaceTab; badge?: WindowBadge; selected?: boolean };
type ClusterNodeData = { cluster: WorkspaceCluster };

/**
 * Per-node `data` objects are cached by the identity of the underlying
 * tab/cluster object (M5 item 3). Zustand replaces only the changed tab's
 * object, so unchanged cards keep their previous `data` reference and the
 * memoized node components skip re-rendering. WeakMap entries are GC'd
 * together with their tab objects.
 */
const tabDataCache = new WeakMap<WorkspaceTab, TabNodeData>();
const clusterDataCache = new WeakMap<WorkspaceCluster, ClusterNodeData>();

function sameBadge(a: WindowBadge | undefined, b: WindowBadge | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.windowId === b.windowId && a.label === b.label && a.hue === b.hue;
}

function dataForTab(tab: WorkspaceTab, badge: WindowBadge | undefined, selected: boolean): TabNodeData {
  const prev = tabDataCache.get(tab);
  if (prev && prev.selected === selected && sameBadge(prev.badge, badge)) return prev;
  const data: TabNodeData = { tab, badge, selected };
  tabDataCache.set(tab, data);
  return data;
}

function dataForCluster(cluster: WorkspaceCluster): ClusterNodeData {
  const prev = clusterDataCache.get(cluster);
  if (prev) return prev; // the data object only wraps the cluster itself
  const data: ClusterNodeData = { cluster };
  clusterDataCache.set(cluster, data);
  return data;
}

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
      data: dataForCluster(c),
      style: { width: c.size.width, height: c.size.height },
      selectable: false,
    }));
    const tabNodes: Node[] = tabs.map((t) => ({
      id: String(t.tabId),
      type: 'tab',
      position: t.position,
      data: dataForTab(t, badges.get(t.windowId), t.tabId === selectedTabIds[0]),
    }));
    return [...clusterNodes, ...tabNodes];
  }, [tabs, allTabs, clusters, selectedTabIds]);

  // Stable callbacks (M5 item 3): zustand action references never change,
  // so these stay referentially stable across renders and do not force
  // ReactFlow to re-render the node tree.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
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
    },
    [moveTab, moveCluster],
  );

  // Drop detection: a card released over a cluster joins it; released in
  // open space, an assigned card leaves its cluster. Reads fresh store
  // state so the callback itself stays stable.
  const onNodeDragStop = useCallback(
    (_e: unknown, node: Node) => {
      if (node.type !== 'tab') return;
      const tabId = Number(node.id);
      if (Number.isNaN(tabId)) return;
      const size = {
        width: node.measured?.width ?? TAB_CARD_FALLBACK.width,
        height: node.measured?.height ?? TAB_CARD_FALLBACK.height,
      };
      const { tabs, clusters } = useWorkspaceStore.getState();
      const targetId = resolveClusterDrop(
        { x: node.position.x, y: node.position.y, width: size.width, height: size.height },
        clusterRects(clusters),
      );
      const current = tabs.find((t) => t.tabId === tabId)?.clusterId;
      if (targetId !== current) assignTab(tabId, targetId);
    },
    [assignTab],
  );

  const onNodeClick = useCallback(
    (_e: unknown, node: Node) => {
      const tabId = Number(node.id);
      selectTab(Number.isNaN(tabId) ? null : tabId);
    },
    [selectTab],
  );

  const onMoveEnd = useCallback(
    (_e: unknown, viewport: Viewport) => setViewport(viewport),
    [setViewport],
  );

  return (
    <div className="bw-canvas">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onMoveEnd={onMoveEnd}
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
