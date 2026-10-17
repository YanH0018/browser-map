import type { NodeProps } from '@xyflow/react';
import type { WorkspaceTab } from '../lib/types';

/** Visual card for one browser tab. */
export default function TabNode({ data }: NodeProps) {
  const tab = (data as { tab: WorkspaceTab }).tab;
  return (
    <div className="bw-tab-card">
      <div className="bw-tab-title">
        {tab.faviconUrl && (
          <img src={tab.faviconUrl} alt="" width={14} height={14} style={{ marginRight: 6, verticalAlign: -2 }} />
        )}
        {tab.title}
      </div>
      <div className="bw-tab-domain">{tab.domain}</div>
    </div>
  );
}
