# CURRENT_TASK.md

- **Task**: M6 — Automatic layout (branch `feature/m6`)
- **Status**: active (started 2026-10-18, engine: pi coding agent, 128K ctx)

## M6 task statement

Give the canvas a "clean this up for me" button. All layout algorithms
must be pure functions in `lib/autoLayout.ts` (deterministic, unit-testable);
UI only wires them up. Scope:

1. **Tidy grid** — one click snaps every tab card onto a regular grid
   (fixed column width, reading order by current position). Cards inside
   clusters keep their cluster assignment; decide and document (in
   docs/DECISIONS.md) whether tidying re-packs members near their
   cluster or leaves cluster membership purely logical.
2. **Group by domain** — propose clusters from tab domains (e.g. all
   github.com tabs → one cluster). One click creates the clusters and
   assigns matching unclustered tabs; existing user clusters are NOT
   touched. Names come from the domain.
3. **Safety** — before any auto-layout mutation, auto-save a named
   snapshot `before-autolayout` (M3 infrastructure) so one click restores
   the previous arrangement. Overwrite that snapshot each time.
4. **Tests** — unit tests for both algorithms: determinism, no card
   overlap in grid output, domain grouping correctness, and the
   snapshot-before-mutate guarantee. Extend the e2e smoke spec: click
   Tidy → cards land on grid positions; reload → layout persists.

Rules: check loop (`npm run compile && npm test && npm run build &&
npm run test:e2e`) green before each commit; work on `feature/m6`;
ordinary commits allowed; do NOT push or merge. See .agent/POLICY.md.

## M5 archive

M5 (keyboard nav, draggable clusters, 150-tab memoization, a11y)
complete — 5 iterations, merged to `main` (`f0f0dbb`). Token ledger for
the milestone: 4.35M tokens processed locally (scripts/token-report.py).
Details in `.agent/RUN_LOG.md`.
