# CURRENT_TASK.md

- **Task**: M2 — Spatial organization (branch `feature/clusters`)
- **Status**: in progress (iteration 5, 2026-10-17).
  - [x] Item 2 — drop detection: drag tab onto cluster → `assignTab`,
    out of all clusters → unassign. Pure AABB logic in
    `lib/clusterDrop.ts` (8 unit tests), wired via `onNodeDragStop`.
    Commit `35c7e76`. Clusters made non-draggable (their positions are
    not persisted yet — no visual-only moves).
  - [x] Item 1 (partial) — resync leak fixed: `queryWorkspaceTabs`
    preserves clusterId of known tabs (`a911fff`); viewport persisted
    on move end. Reload-restore still needs e2e proof (item 4).
  - [x] Item 3 — cluster rename / delete UI. `renameCluster` +
    `deleteCluster` store actions (2 unit tests); ClusterNode shows ✎ / ×
    buttons — rename via prompt, delete via confirm that states member
    cards are unassigned (never closed). Commit this iteration.
  - [ ] Item 4 — extend e2e smoke spec: drag card onto cluster, reload
    workspace page, assert positions + clusters restored.
- **Check loop state at last commit**: compile ✓, 32/32 unit tests ✓,
  wxt build ✓ (443.04 kB), e2e smoke 2/2 ✓.
- **Next up**: item 4 (e2e extension) — the last M2 slice.

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
