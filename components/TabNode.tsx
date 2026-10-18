import { memo, useEffect, useRef } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { WorkspaceTab } from '../lib/types';
import type { WindowBadge } from '../lib/windowBadge';

/** Deterministic hue (0-360) derived from a string, for the avatar fallback. */
function hueFrom(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

/** Test-only render counter (M5 item 3 perf test); reset between tests. */
export const tabNodeRenderCount = { count: 0 };

/**
 * Visual card for one browser tab. Memoized (M5 item 3): moving or
 * selecting another card must not re-render this one. The canvas keeps
 * the per-node `data` object referentially stable for unchanged tabs so
 * this memo actually holds.
 *
 * Accessibility (M5 item 4, D15): the card is a real keyboard control —
 * role="button" + tabIndex=0 puts it in tab order (DOM order: clusters
 * first, then tabs in store order). Focusing a card selects it (so the
 * global Enter/Space activation path in useKeyboardNav works right after
 * tabbing to it), and selection follows back: arrow-key navigation moves
 * DOM focus onto the newly selected card.
 */
export default memo(function TabNode({ data }: NodeProps) {
  tabNodeRenderCount.count += 1;
  const { tab, badge, selected } = data as {
    tab: WorkspaceTab;
    badge?: WindowBadge;
    selected?: boolean;
  };
  const selectTab = useWorkspaceStore((s) => s.selectTab);

  // Selection → focus: keep DOM focus on the keyboard-navigated card.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) cardRef.current?.focus({ preventScroll: true });
  }, [selected]);

  const ariaLabel = `Tab card: ${tab.title} (${tab.domain})${badge ? `, window ${badge.label}` : ''}`;

  return (
    <div
      ref={cardRef}
      className={selected ? 'bw-tab-card bw-tab-card--selected' : 'bw-tab-card'}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected === true}
      onFocus={() => selectTab(tab.tabId)}
    >
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
});
