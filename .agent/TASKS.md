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

- [ ] Tab create/remove/title/URL sync hardening (M4)
- [ ] Multi-window behavior (M4)
- [ ] Real Playwright e2e suite per `tests/e2e/README.md` (M4)
- [ ] Visual test loop: screenshot → vision-model inspection (M5)
- [ ] Keyboard navigation + accessibility pass (M5)
- [ ] Automatic layout algorithms (M6)
- [ ] Local embeddings + semantic clustering (M7)
- [ ] Natural-language workspace commands via local model (M8)

## Known issues

- [ ] e2e `reload restores positions and clusters` flaked once right after a fresh build (clusterId undefined post-reload); passes on rerun, 3/3 green on main. Suspected hydration/resync race on cold extension load — harden with an explicit wait-for-hydration in the test or store.
