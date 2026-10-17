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
import TabNode from './TabNode';
import ClusterNode from './ClusterNode';

const nodeTypes = { tab: TabNode, cluster: ClusterNode };

// Fallback card size for drop math when XYFlow has not measured yet.
const TAB_CARD_FALLBACK = { width: 240, height: 68 };

export default function WorkspaceCanvas() {
  const tabs = useWorkspaceStore(selectVisibleTabs);
  const clusters = useWorkspaceStore((s) => s.clusters);
  const moveTab = useWorkspaceStore((s) => s.moveTab);
  const assignTab = useWorkspaceStore((s) => s.assignTab);
  const selectTab = useWorkspaceStore((s) => s.selectTab);
  const setViewport = useWorkspaceStore((s) => s.setViewport);

  const nodes = useMemo<Node[]>(() => {
    const clusterNodes: Node[] = clusters.map((c) => ({
      id: c.id,
      type: 'cluster',
      position: c.position,
      data: { name: c.name },
      style: { width: c.size.width, height: c.size.height },
      selectable: false,
      draggable: false,
    }));
    const tabNodes: Node[] = tabs.map((t) => ({
      id: String(t.tabId),
      type: 'tab',
      position: t.position,
      data: { tab: t },
    }));
    return [...clusterNodes, ...tabNodes];
  }, [tabs, clusters]);

  const onNodesChange = (changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position && change.id) {
        const tabId = Number(change.id);
        if (!Number.isNaN(tabId)) moveTab(tabId, change.position);
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
