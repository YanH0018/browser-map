# RUN_LOG.md — Autonomous Run Records

One record per significant run. Template:

```
Task:               <name>
Model:              <model + runtime>
Elapsed time:       <min>
Tool calls:         <n>
Build attempts:     <n>
Failed tests:       <n>
Self-recovered:     <n>
Human intervention: <n>
Final commit:       <hash>
Status:             PASS | FAIL | BLOCKED
```

---

```
Task:               M0 — repository scaffold + environment verification
Model:              Kimi (cloud agent), setup run supervised by Alex
Elapsed time:       ~30 min
Tool calls:         ~55
Build attempts:     2 (1st: TS strict + wxt/testing import path; 2nd: PASS)
Failed tests:       0 (17/17 pass, vitest)
Self-recovered:     2 (import path fix; strict-index fixes)
Human intervention: 1 (macOS authorization restart)
Final commit:       17d277d (main)
Status:             PASS
Notes:              WXT + React + XYFlow + Zustand + Vitest scaffold;
                    docs/ and .agent/ memory structure established;
                    build: .output/chrome-mv3 (440 KB, MV3, tabs+storage only);
                    inference verified: Ollama qwen3.8:27b real inference OK
                    (~37 tok/s warm), running as persistent brew service;
                    LM Studio 0.4.26 installed, quarantine removed, daemon
                    needs one GUI launch before `lms server start` works.
```

---

```
Task:               Inference plane — LM Studio primary runtime online
Model:              Kimi (cloud agent), Alex opened LM Studio GUI once
Elapsed time:       ~10 min
Human intervention: 1 (GUI first launch + server toggle)
Final commit:       (this entry)
Status:             PASS
Notes:              lms server ON :1234. Qwen3.8-27B-MLX-5bit (19.44 GB)
                    fetched via aria2 16-connection download (~160 MiB/s vs
                    5.3 MB/s single-stream) directly into ~/.lmstudio/models;
                    loaded in 17.45 s; live inference verified via
                    /v1/chat/completions (identifier "qwen3.8-27b-mlx").
                    Ollama qwen3.8:27b remains as fallback (:11434).
                    Superseded: partial MLX-8bit download (5.28 GB) pending
                    cancellation + cleanup.
```

---

```
Task:               M1 — spatial tab view (own-tab exclusion, favicon fallback)
Model:              Qwen Code (local CLI agent), LM Studio MLX-5bit runtime available
Elapsed time:       ~10 min
Tool calls:         ~12
Build attempts:     1 (PASS on first run)
Failed tests:       0 (22/22 pass, vitest; +5 new isOwnExtensionTab tests)
Self-recovered:     0
Human intervention: 0
Final commit:       (this entry)
Status:             PASS
Notes:              lib/browserAdapter.ts excludes the extension's own tabs
                    via isOwnExtensionTab(url, browser.runtime.getURL('')) so
                    workspace.html never renders as a canvas card;
                    components/TabNode.tsx falls back to a colored letter
                    avatar (deterministic hue from domain/title) when
                    favIconUrl is empty; tests/browserAdapter.test.ts covers
                    own-origin match, sub-pages, web pages, undefined url,
                    and foreign extension origin. Check loop green:
                    compile + 22/22 tests + wxt build (.output/chrome-mv3,
                    441 kB). Remaining M1: manual verification in real
                    Chromium.
```

---

```
Task:               M1 acceptance — real-Chromium verification + merge
Model:              Kimi (cloud agent) supervising; Playwright headed run
Elapsed time:       ~3 min
Build attempts:     0 (reused green build)
Failed tests:       1 (ESM __dirname in smoke spec — fixed with
                    import.meta.url, self-recovered)
Self-recovered:     1
Human intervention: 0 (Alex pre-authorized acceptance + merge)
Final commit:       (merge into main — see git log)
Status:             PASS
Notes:              2/2 e2e in headed Chromium: MV3 service worker
                    registers; workspace.html renders toolbar/canvas/
                    inspector; about:blank appears as card with the
                    letter-avatar fallback; workspace.html itself
                    correctly excluded. Evidence: docs/assets/m1-workspace.png
```

---

```
Task:               M2 iteration 4 — cluster drop detection + resync leak fix
Model:              Qwen Code (local CLI agent)
Elapsed time:       ~12 min
Tool calls:         ~25
Build attempts:     2 (1st compile: 3 TS errors — node.measured optional
                   fields + test excess property; fixed, 2nd PASS)
Failed tests:       0 (30/30 pass after fix; +8 new clusterDrop tests)
Self-recovered:     1 (type errors, same run)
Human intervention: 0
Final commit:       a911fff (resync leak fix, prior iteration's uncommitted
                   work) + 35c7e76 (cluster drop feature) on feature/clusters
Status:             PASS
Notes:              lib/clusterDrop.ts — pure AABB overlap resolution
                    (largest-overlap wins, edge-touch = no drop), unit-tested;
                    WorkspaceCanvas onNodeDragStop assigns/unassigns only when
                    target differs from current clusterId (no state churn);
                    clusters set draggable:false until their positions persist;
                    viewport persisted via onMoveEnd (prior iteration hunk).
                    Check loop green: compile, 30/30 unit, wxt build
                    (441.82 kB), e2e smoke 2/2 in headed Chromium.
                    Remaining M2: item 3 cluster rename/delete UI;
                    item 4 e2e extension (drag + reload restore proof).
```

---

```
Task:               M2 iteration 5 — cluster rename/delete UI (item 3)
Model:              Qwen Code (local CLI agent)
Elapsed time:       ~10 min
Tool calls:         ~25
Build attempts:     1 (compile PASS first try)
Failed tests:       0 (32/32 pass; +2 new workspaceStore tests)
Self-recovered:     0
Human intervention: 0
Final commit:       67b72f1 on feature/clusters (code + task files);
                   this run-log entry committed separately
Status:             PASS
Notes:              renameCluster/deleteCluster store actions; delete
                    unassigns member cards (clusterId -> undefined) and
                    never closes real browser tabs. ClusterNode now shows
                    ✎ (prompt rename) and × (confirm delete, message states
                    member cards are unassigned, not closed); node data
                    carries the full cluster object. CSS for action row.
                    Check loop green: compile, 32/32 unit, wxt build
                    (443.04 kB), e2e smoke 2/2 in headed Chromium.
                    Remaining M2: item 4 e2e extension (drag card onto
                    cluster, reload workspace page, assert positions +
                    clusters restored) — last M2 slice.
```

---

```
Task:               M2 iteration 7 — e2e reload-restore proof (item 4),
                    closes M2
Model:              Qwen Code (local CLI agent)
Elapsed time:       ~15 min
Tool calls:         ~20
Build attempts:     1 (compile PASS first try)
Failed tests:       1 e2e run (new M2 test failed: snapshot key missing
                   from chrome.storage.local — root cause was the test
                   helper reading 'local:workspaceSnapshot' while
                   wxt/utils/storage stores under raw key
                   'workspaceSnapshot'; app persistence was correct)
Self-recovered:     1 (test helper key fix, same run)
Human intervention: 0
Final commit:       60e9463 on feature/clusters (test); this run-log
                   entry + task files committed separately
Status:             PASS
Notes:              tests/e2e/smoke.spec.ts gains the M2 acceptance test:
                    two uniquely-URL'd data: tabs, create cluster via
                    toolbar (prompt), mouse-drag Alpha card onto the
                    cluster node, read snapshot from storage (assign +
                    geometry), reload workspace page, assert cards and
                    cluster render back with the card inside the cluster
                    rect, then re-read storage to prove no position drift.
                    Check loop green: compile, 32/32 unit, wxt build
                    (443.04 kB), e2e smoke 3/3 in headed Chromium.
                    M2 complete — all four items verified end-to-end.
                    Branch feature/clusters ready for human merge;
                    next backlog: M1-boundary card-click e2e, then M3.
```

---

```
Task:               M3 iteration 2 — named snapshots unit tests, closes M3
Model:              pi coding agent (fresh-context loop)
Elapsed time:       ~10 min
Tool calls:         ~25
Build attempts:     1 (compile PASS first try)
Failed tests:       0 (41/41 pass after adding 9 new; e2e 4/4)
Self-recovered:     0
Human intervention: 0
Final commit:       a880f4a (feat + tests) on main; task files separate
Status:             PASS
Notes:              Iteration 1 (same loop) had left uncommitted M3 item-2
                    work on main: NamedSnapshot type, lib/namedSnapshots.ts
                    (pure create/deserialize), workspaceStorage key
                    'namedSnapshots' (separate from live workspaceSnapshot),
                    store actions save/restore/deleteNamedSnapshot, Toolbar
                    Save-snapshot prompt + Restore/Delete chips, debounced
                    persistence in App. This iteration added the required
                    unit tests: tests/namedSnapshots.test.ts (4) and a
                    named-snapshot describe block in workspaceStore.test.ts
                    (5: capture, same-name update-in-place, restore replaces
                    canvas state without resurrecting closed tabs / touching
                    new live tabs, unknown-id no-op, delete by id).
                    Check loop green: compile, 41/41 unit, wxt build
                    (445.25 kB), e2e 4/4 in Chromium.
                    M3 complete: item 1 search filter (scaffold 17d277d +
                    tests/search.test.ts), item 2 named snapshots (a880f4a),
                    item 3 card-click activate (3213892, e2e).
                    Next backlog: M4 — tab sync hardening, multi-window.
```
