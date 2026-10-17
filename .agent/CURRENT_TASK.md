# CURRENT_TASK.md

- **Task**: M1 — Spatial tab view
- **Status**: in progress (2026-10-17) — own-tab exclusion fixed, favicon
  fallback added, isOwnExtensionTab unit-tested; check loop green (22/22
  tests). Remaining: manual verification in real Chromium, then commit.
- **Next up**: M2 — see TASKS.md

## M1 progress (this session)

- `lib/browserAdapter.ts`: exclude the extension's own tabs
  (`isOwnExtensionTab` against `browser.runtime.getURL('')`) so
  workspace.html never renders as a canvas card.
- `components/TabNode.tsx`: favicon fallback — when `favIconUrl` is empty,
  render a colored letter avatar (deterministic hue from domain/title).
- `tests/browserAdapter.test.ts`: 5 unit tests for `isOwnExtensionTab`.
- Check loop green: `npm run compile && npm test && npm run build`
  (22/22 tests, .output/chrome-mv3 built).

## M1 task statement (for the next agent session)

Wire the workspace page to real browser tabs end-to-end: query live tabs
through `lib/browserAdapter.ts`, render them as cards on the XYFlow
canvas, and make clicking a card activate the real browser tab. The
scaffold already contains the store, adapter, persistence, and component
shells — verify them against real Chromium behavior and fix what is
wrong. Check loop (`npm run compile && npm test && npm run build`) must
be green; commit on `feature/spatial-tab-view`.
