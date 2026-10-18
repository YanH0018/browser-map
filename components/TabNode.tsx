import type { NodeProps } from '@xyflow/react';
import type { WorkspaceTab } from '../lib/types';
import type { WindowBadge } from '../lib/windowBadge';

/** Deterministic hue (0-360) derived from a string, for the avatar fallback. */
function hueFrom(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

/** Visual card for one browser tab. */
export default function TabNode({ data }: NodeProps) {
  const { tab, badge } = data as { tab: WorkspaceTab; badge?: WindowBadge };
  return (
    <div className="bw-tab-card">
      {badge && (
        <span
          className="bw-tab-badge"
          title={`Browser window ${badge.label} (id ${badge.windowId})`}
          style={{ background: `hsl(${badge.hue} 45% 30%)` }}
        >
          {badge.label}
        </span>
      )}
      <div className="bw-tab-title">
        {tab.faviconUrl ? (
          <img src={tab.faviconUrl} alt="" width={14} height={14} style={{ marginRight: 6, verticalAlign: -2 }} />
        ) : (
          <span
            className="bw-tab-avatar"
            style={{ background: `hsl(${hueFrom(tab.domain || tab.title)} 45% 38%)` }}
          >
            {(tab.domain || tab.title || '?').charAt(0).toUpperCase()}
          </span>
        )}
        {tab.title}
      </div>
      <div className="bw-tab-domain">{tab.domain}</div>
    </div>
  );
}
