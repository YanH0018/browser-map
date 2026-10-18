# TASKS.md — Development Backlog

Ordered roughly by milestone (details in `docs/ROADMAP.md`).
Format: `[ ] task (milestone)` — mark `[x]` with the commit hash when done.

## Now (M1 — Spatial tab view)

- [x] Verify live tab query → card rendering on real Chromium (`65ac108`, e2e `3d4b4c8`)
- [x] Favicon rendering fallbacks for chrome:// and missing icons (`65ac108`)
- [x] Card click activates the real browser tab — wired in InspectorPanel;
      e2e coverage added (`3213892`): click card → inspector selects it,
      "Activate tab" → real tab becomes active (asserted via
      chrome.tabs.query from the extension page)

## Next (M2 — Spatial organization)

- [x] Drag cards; persist positions (M2) — pipeline + resync leak fixed
      (`a911fff`), viewport persisted; e2e proof of reload restore in
      `60e9463` (no drift after re-save)
- [x] Cluster creation / rename / delete UI (M2) — create existed;
      rename/delete added in `67b72f1` (delete unassigns members,
      never closes tabs)
- [x] Assign tab to cluster by drag (drop detection) (`35c7e76`)
- [x] Restore full layout after workspace reload (M2) — unit-covered;
      e2e smoke spec proves it in Chromium (`60e9463`)

M2 complete: all four items verified end-to-end (compile, 32/32 unit,
build, e2e 3/3 green at `60e9463`).

## Now (M4 — Robust browser synchronization)

- [x] Tab identity by tabId, not URL (M4) — `lib/tabIdentity.ts`
      (`resolveTabState`, tabId-first + URL fallback for v1/stale ids),
      shared by snapshot restore and live resync; snapshot version 2,
      v1 still loads (D9, `c01a453`); 12 unit tests in
      `tests/tabIdentity.test.ts`
- [x] Live chrome.tabs events → store (M4) — pure reducers in
      `lib/tabEvents.ts` (`applyTabEvent(s)`), debounced (150 ms) listener
      hook `useTabEvents.ts` wired in App, store action `applyTabEvents`,
      `nextFreePositionFor` for overlap-free new cards; 20 unit tests in
      `tests/tabEvents.test.ts` (D10, `d8c8892`)
- [x] Multi-window behavior (M4) — windowId already flowed through
      normalizeTab/WorkspaceTab; derived W1..Wn badges (stable per-window
      hue, shown only with ≥2 windows) in `lib/windowBadge.ts`, rendered on
      TabNode + InspectorPanel; 8 unit tests in `tests/windowBadge.test.ts`
      (D11, `5ced706`)
- [ ] e2e: open tab → card appears; close → gone; navigate →
      position/cluster preserved (M4)

## Done (M3 — Workspace functionality)

- [x] Search box filters canvas live (M3) — store-driven `searchQuery`
      + `selectVisibleTabs` in the canvas (scaffold `17d277d`); filter
      predicate unit-tested in `tests/search.test.ts`
- [x] Named workspace snapshots (save / restore / delete) (`a880f4a`) —
      separate `namedSnapshots` storage key; restore replaces canvas
      state only (never opens/closes real tabs); 9 unit tests for the
      pure helpers + store actions; e2e smoke still green (4/4)
- [x] Card click activates the real browser tab (`3213892`) — see M1
      section above; e2e asserts the real tab becomes active

M3 complete: all three items verified (compile, 41/41 unit, build,
e2e 4/4 at `a880f4a`).

## Later

- [ ] Real Playwright e2e suite per `tests/e2e/README.md` (M4)
- [ ] Visual test loop: screenshot → vision-model inspection (M5)
- [ ] Keyboard navigation + accessibility pass (M5)
- [ ] Automatic layout algorithms (M6)
- [ ] Local embeddings + semantic clustering (M7)
- [ ] Natural-language workspace commands via local model (M8)

## Known issues

- [ ] e2e `reload restores positions and clusters` flaked once right after a fresh build (clusterId undefined post-reload); passes on rerun, 3/3 green on main. Suspected hydration/resync race on cold extension load — harden with an explicit wait-for-hydration in the test or store.
