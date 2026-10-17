import type { NodeProps } from '@xyflow/react';

/** Named spatial grouping drawn behind its member tab cards. */
export default function ClusterNode({ data }: NodeProps) {
  const { name } = data as { name: string };
  return <div className="bw-cluster-node">{name}</div>;
}
