# TASKS.md — Development Backlog

Ordered roughly by milestone (details in `docs/ROADMAP.md`).
Format: `[ ] task (milestone)` — mark `[x]` with the commit hash when done.

## Now (M1 — Spatial tab view)

- [ ] Verify live tab query → card rendering on real Chromium (M1)
- [ ] Card click activates the real browser tab (M1)
- [ ] Favicon rendering fallbacks for chrome:// and missing icons (M1)

## Next (M2 — Spatial organization)

- [ ] Drag cards; persist positions (M2)
- [ ] Cluster creation / rename / delete UI (M2)
- [ ] Assign tab to cluster by drag (drop detection) (M2)
- [ ] Restore full layout after workspace reload (M2)

## Later

- [ ] Search box filters canvas live (M3)
- [ ] Named workspace snapshots (save / switch) (M3)
- [ ] Tab create/remove/title/URL sync hardening (M4)
- [ ] Multi-window behavior (M4)
- [ ] Real Playwright e2e suite per `tests/e2e/README.md` (M4)
- [ ] Visual test loop: screenshot → vision-model inspection (M5)
- [ ] Keyboard navigation + accessibility pass (M5)
- [ ] Automatic layout algorithms (M6)
- [ ] Local embeddings + semantic clustering (M7)
- [ ] Natural-language workspace commands via local model (M8)
