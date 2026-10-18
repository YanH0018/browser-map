# CURRENT_TASK.md

- **Task**: M5 — Interaction quality (branch `feature/m5`)
- **Status**: active (started 2026-10-17, engine: pi coding agent)

## M5 task statement

Make the canvas pleasant to use, not just functional. Scope:

1. **Keyboard navigation** — arrow keys move a visible focus/selection
   between tab cards (reading order or spatial-nearest, pick one and
   document in docs/DECISIONS.md); Enter activates the real tab (reuse
   the M3 activateTab path); Escape clears selection. Covered by unit
   tests for the navigation reducer and one e2e using page.keyboard.
2. **Cluster interaction, finished** — clusters are currently
   non-draggable (M2 deferred it). Make clusters draggable and persist
   their positions (they already exist in the snapshot schema); member
   cards do NOT need to follow a moving cluster (document that choice).
   Replace `window.prompt` rename with inline editing (double-click the
   cluster title). Unit tests for the store side.
3. **Performance with many tabs** — the canvas must stay smooth with
   150 cards. Memoize TabNode/ClusterNode (React.memo) so dragging one
   card does not re-render the rest; verify with a lightweight render-
   count test or document manual measurement in RUN_LOG. No exotic
   virtualization — memoization and stable callbacks only.
4. **Accessibility basics** — every interactive element gets an
   aria-label; cards expose role="button" (or real buttons) and tab
   order; honor prefers-reduced-motion for canvas transitions. Axe-style
   deep audit is out of scope; labels + roles + reduced motion only.

Rules: check loop (`npm run compile && npm test && npm run build &&
npm run test:e2e`) green before each commit; work on `feature/m5`;
ordinary commits allowed; do NOT push or merge. See .agent/POLICY.md.

## M4 archive

M4 (tabId identity, live chrome.tabs sync, multi-window badges)
complete — 7 iterations, merged to `main` (`0ecda5b`). Details in
`.agent/RUN_LOG.md`.
