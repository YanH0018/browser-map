# CURRENT_TASK.md

- **Task**: M2 — Spatial organization (branch `feature/clusters`)
- **Status**: done (iteration 7, 2026-10-17).
  - [x] Item 2 — drop detection: drag tab onto cluster → `assignTab`,
    out of all clusters → unassign. Pure AABB logic in
    `lib/clusterDrop.ts` (8 unit tests), wired via `onNodeDragStop`.
    Commit `35c7e76`. Clusters made non-draggable (their positions are
    not persisted yet — no visual-only moves).
  - [x] Item 1 (partial) — resync leak fixed: `queryWorkspaceTabs`
    preserves clusterId of known tabs (`a911fff`); viewport persisted
    on move end. Reload-restore proven in e2e (item 4).
  - [x] Item 3 — cluster rename / delete UI. `renameCluster` +
    `deleteCluster` store actions (2 unit tests); ClusterNode shows ✎ / ×
    buttons — rename via prompt, delete via confirm that states member
    cards are unassigned (never closed). Commit `67b72f1`.
  - [x] Item 4 — e2e smoke spec extended: drag card onto cluster,
    reload workspace page, assert positions + clusters restored with no
    drift. Commit `60e9463`. The only leak found was in the test helper
    itself: wxt/utils/storage resolves `local:workspaceSnapshot` to area
    `local`, key `workspaceSnapshot`, so the raw chrome.storage.local key
    has no prefix. App persistence was working all along.
- **Check loop state at last commit**: compile ✓, 32/32 unit tests ✓,
  wxt build ✓ (443.04 kB), e2e smoke 3/3 ✓.
- **Next up**: M2 is complete. Backlog: M1-boundary item (card click
  activates real tab — needs e2e coverage), then M3 (live search filter,
  named snapshots). Branch `feature/clusters` is ready to merge when a
  human says so (agent does not push/merge without approval).

## M2 task statement (archive)

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
