# ROADMAP.md — Milestones

- [x] **M0 — Agent environment**: repository initialized; sandboxed agent
  autonomy defined (`.agent/POLICY.md`); inference backend operational
  (local Qwen3.8-27B via Ollama / LM Studio); build/test loop working;
  Git recovery verified.
- [ ] **M1 — Spatial tab view**: query real open tabs; display as cards
  on the spatial canvas; click card → activate the real tab.
- [ ] **M2 — Spatial organization**: dragging; clusters; tab-to-cluster
  movement; persistent layout.
- [ ] **M3 — Workspace functionality**: search; workspace snapshots;
  improved restoration; better tab synchronization.
- [ ] **M4 — Robust browser synchronization**: creation/removal/URL &
  title updates/activation state; multi-window behavior.
- [ ] **M5 — Interaction quality**: keyboard navigation; visual polish;
  performance with many tabs; accessibility; cluster interaction.
- [ ] **M6 — Automatic layout**: algorithms that reorganize tabs.
- [ ] **M7 — Semantic clustering**: embeddings + local semantic grouping.
- [ ] **M8 — Local AI workspace assistant**: natural-language workspace
  manipulation (runs entirely on the local inference plane).
- [ ] **M9 — 2.5D / 3D experiments**: richer spatial representation.
- [ ] **M10 — Advanced HCI**: gesture / eye-tracking / spatial input /
  multimodal manipulation experiments.

Working agreement: each milestone lands as one or more task branches
with the check loop (`compile` + `test` + `build`) green before merge.
