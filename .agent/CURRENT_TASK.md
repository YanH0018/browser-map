# CURRENT_TASK.md

- **Task**: M1 — Spatial tab view
- **Status**: done (2026-10-17). Accepted: unit loop green (22/22),
  e2e smoke 2/2 in real Chromium (service worker + app shell render,
  own-tab excluded, letter-avatar fallback live). Evidence:
  `docs/assets/m1-workspace.png`. Merged to main.
- **Next up**: M2 — Spatial organization (see TASKS.md)

## M2 task statement (for the next agent session)

Make the canvas spatially useful: cards stay where the user drops them
and clusters become real containers. Scope:

1. Drag a tab card → position persists across workspace reload
   (pipeline exists: `moveTab` → debounced `saveSnapshot`; verify it
   end-to-end and fix what leaks).
2. Drag a tab card onto a `ClusterNode` → `assignTab(tabId, cluster.id)`
   (drop detection via XYFlow intersection; dragged-out → unassign).
3. Cluster rename / delete (delete asks what to do with member tabs:
   unassign, do not close real tabs).
4. Restore clusters + positions on reload; cover with unit tests
   (store) and extend the e2e smoke spec.

Rules: check loop (`npm run compile && npm test && npm run build &&
npm run test:e2e`) green before commit; work on `feature/clusters`;
ordinary commits allowed; do not push. See .agent/POLICY.md.
