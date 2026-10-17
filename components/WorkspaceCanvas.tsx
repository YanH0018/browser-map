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
import TabNode from './TabNode';
import ClusterNode from './ClusterNode';

const nodeTypes = { tab: TabNode, cluster: ClusterNode };

export default function WorkspaceCanvas() {
  const tabs = useWorkspaceStore(selectVisibleTabs);
  const clusters = useWorkspaceStore((s) => s.clusters);
  const moveTab = useWorkspaceStore((s) => s.moveTab);
  const selectTab = useWorkspaceStore((s) => s.selectTab);

  const nodes = useMemo<Node[]>(() => {
    const clusterNodes: Node[] = clusters.map((c) => ({
      id: c.id,
      type: 'cluster',
      position: c.position,
      data: { name: c.name },
      style: { width: c.size.width, height: c.size.height },
      selectable: false,
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

  return (
    <div className="bw-canvas">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_e, node) => {
          const tabId = Number(node.id);
          selectTab(Number.isNaN(tabId) ? null : tabId);
        }}
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
