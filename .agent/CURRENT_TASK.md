# CURRENT_TASK.md

- **Task**: M4 — Robust browser synchronization (branch `feature/m4`)
- **Status**: active (started 2026-10-17, engine: pi coding agent)

## M4 task statement

Make the canvas a live mirror of the real browser: whatever happens in
Chrome shows up on the canvas without a reload, and user arrangement
survives it. Scope:

1. **Tab identity by tabId, not URL** — the current resync matches
   known tabs by URL (`lib/browserAdapter.ts queryWorkspaceTabs`), so a
   tab that navigates loses its position and cluster. Key persisted
   state by tabId; keep URL only as display data. Migration: existing
   snapshots still load (fall back to URL match when tabId unknown).
2. **Live events** — subscribe to `chrome.tabs` events and keep the
   store in sync:
   - `onCreated` → new card appears (next free position, no overlap);
   - `onRemoved` → card disappears (its cluster assignment goes too,
     clusters themselves stay);
   - `onUpdated` (URL/title) → card text updates in place, position and
     cluster preserved;
   - `onActivated` → canvas selection follows the real active tab.
   Debounce bursts (e.g. restoring a closed window fires many events).
3. **Multi-window behavior** — track `windowId` on each card; all
   windows' tabs appear on the canvas. A small window badge/label on the
   card is enough; no per-window grouping required yet.
4. **Tests** — unit tests for the identity migration and the event→store
   reducers (mock the chrome.tabs events); extend the e2e smoke spec for
   at least: open a new tab → card appears; close it → card gone;
   navigate a tab → position/cluster preserved.

Rules: check loop (`npm run compile && npm test && npm run build &&
npm run test:e2e`) green before each commit; work on `feature/m4`;
ordinary commits allowed; do NOT push or merge. See .agent/POLICY.md.

## M3 archive

M3 (search filter, named snapshots, click-to-activate) complete —
2 iterations with the pi engine, merged to `main` (`a971d37`).
Details in `.agent/RUN_LOG.md`.
