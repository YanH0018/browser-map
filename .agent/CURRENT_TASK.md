# CURRENT_TASK.md

- **Task**: M3 — Workspace functionality
- **Status**: done (2026-10-17, engine: pi coding agent) — all three items
  implemented and verified; see archive below. Next backlog: M4 (tab
  sync hardening, multi-window).

## M3 task statement

Make the workspace genuinely usable day-to-day: find tabs fast, save and
restore named layouts, and make cards control the real browser. Scope:

1. **Live search filter** — a search box on the workspace canvas; typing
   filters tab cards by title and URL (case-insensitive, matches as-you-
   type; non-matching cards hidden or dimmed, clusters always visible).
   Store-driven (`searchQuery` in the workspace store), covered by unit
   tests for the filter predicate.
2. **Named snapshots** — save the current layout (tab set, positions,
   clusters, viewport) under a user-chosen name; list saved snapshots;
   restore one (replaces current canvas state, does NOT open/close real
   browser tabs); delete one. Persist via the existing storage layer
   (`wxt/utils/storage`), separate key from the live `workspaceSnapshot`.
   Unit tests for the save/restore/delete store actions.
3. **Card click activates the real tab** (M1-boundary backlog item) —
   clicking a tab card focuses the real browser tab via
   `chrome.tabs.update(tabId, {active: true})` (+ its window). Add an
   `activateTab` to `lib/browserAdapter.ts` and cover the wiring in the
   e2e smoke spec.

Rules: check loop (`npm run compile && npm test && npm run build &&
npm run test:e2e`) green before each commit; work on `feature/m3`;
ordinary commits allowed; do NOT push or merge. See .agent/POLICY.md.

## M2 archive

M2 (drag persistence, cluster grouping) complete — 7 iterations,
merged to `main` as `fad08a3`. Details in `.agent/RUN_LOG.md`.
Known flake logged in `.agent/TASKS.md`: e2e reload-restore can fail
once on a cold build (suspected hydration race).
