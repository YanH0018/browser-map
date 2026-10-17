# CURRENT_TASK.md

- **Task**: M0 — agent environment scaffold
- **Status**: done (baseline committed by the setup run; see RUN_LOG)
- **Next up**: M1 — Spatial tab view (see TASKS.md)

## M1 task statement (for the next agent session)

Wire the workspace page to real browser tabs end-to-end: query live tabs
through `lib/browserAdapter.ts`, render them as cards on the XYFlow
canvas, and make clicking a card activate the real browser tab. The
scaffold already contains the store, adapter, persistence, and component
shells — verify them against real Chromium behavior and fix what is
wrong. Check loop (`npm run compile && npm test && npm run build`) must
be green; commit on `feature/spatial-tab-view`.
