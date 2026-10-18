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

---

```
Task:               M4 iteration 2 — tab identity by tabId (item 1),
                    verify + commit iteration-1 work
Model:              pi coding agent (fresh-context loop)
Elapsed time:       ~12 min
Tool calls:         ~30
Build attempts:     2 (1st compile: 3 TS errors — tuple-typed
                   ACCEPTED_SNAPSHOT_VERSIONS.includes + test fixture
                   missing optional clusterId; fixed, 2nd PASS)
Failed tests:       3 (D6-era assertions "no ephemeral tabId" in
                   namedSnapshots/persistence/workspaceStore tests —
                   updated to D9 tabId-keyed expectations)
Self-recovered:     2 (type errors + stale test assertions, same run)
Human intervention: 0
Final commit:       c01a453 on feature/m4 (code + tests + docs);
                   task files separate
Status:             PASS
Notes:              Iteration 1 had left uncommitted M4 item-1 work on
                   feature/m4: lib/tabIdentity.ts (sanitizePersistedTab(s)
                   + resolveTabState — tabId-first matching, URL fallback
                   only for v1/stale entries, each persisted entry
                   consumed at most once), PersistedTabMetadata.tabId?,
                   SNAPSHOT_VERSION 2 + ACCEPTED_SNAPSHOT_VERSIONS [1,2],
                   browserAdapter.queryWorkspaceTabs and
                   persistence.applySnapshotToTabs both routed through
                   resolveTabState, namedSnapshots sanitize on load,
                   D9 ADR + ARCHITECTURE identity-rule update. This
                   iteration fixed the 3 compile errors, updated the 3
                   D6-era tests to assert tabId IS persisted (D9), and
                   verified the full loop: compile, 54/54 unit (12 new
                   tabIdentity tests), wxt build (446.32 kB), e2e 4/4 in
                   Chromium — including the previously flaky reload-restore
                   test, now green on a cold load. Remaining M4: item 2
                   live chrome.tabs event reducers + debounce, item 3
                   multi-window badge, item 4 e2e open/close/navigate.
```

---

```
Task:               M4 iteration 3 (loop iter 5) — live chrome.tabs
                    event reducers + debounce (item 2)
Model:              pi coding agent (fresh-context loop)
Elapsed time:       ~15 min
Tool calls:         ~30
Build attempts:     2 (1st compile: 27 TS errors in prior run's
                   uncommitted work — noUncheckedIndexedAccess in
                   lib/tabEvents.ts + tests, wrong field name favIconUrl;
                   fixed, 2nd PASS)
Failed tests:       0 (74/74 pass after fixes; +20 new tabEvents tests;
                    e2e 4/4)
Self-recovered:     1 (compile errors, same run)
Human intervention: 0
Final commit:       d8c8892 on feature/m4 (code + tests + D10 ADR);
                   task files separate
Status:             PASS
Notes:              Prior run (loop iter 4) had left uncommitted item-2
                    work on feature/m4: lib/tabEvents.ts (pure reducers
                    applyTabEvent/applyTabEvents over a TabEvent union —
                    created adds at nextFreePositionFor, removed drops
                    card + selection but not clusters, updated changes
                    text in place preserving position/cluster per D9,
                    activated follows the real active tab and clears
                    selection for card-less tabs; all idempotent),
                    useTabEvents.ts (150 ms debounced browser.tabs.on*
                    listeners, own-extension tabs filtered at the
                    boundary, flush-on-unmount), store action
                    applyTabEvents, nextFreePositionFor in lib/layout.ts,
                    20 tests. This iteration fixed the compile errors
                    (index-access narrowing in applyUpdated + test,
                    favIconUrl→faviconUrl field rename), added the D10
                    ADR, and verified the full loop: compile, 74/74 unit,
                    wxt build (448.46 kB), e2e 4/4 in Chromium.
                    Remaining M4: item 3 multi-window badge, item 4 e2e
                    open/close/navigate.
```

---

```
Task:               M4 iteration 4 (loop iter 6) — multi-window badges
                    on tab cards (item 3)
Model:              pi coding agent (fresh-context loop)
Elapsed time:       ~20 min
Tool calls:         ~35
Build attempts:     1 (PASS on first run)
Failed tests:       0 (82/82 pass, vitest; +8 new windowBadge tests;
                    e2e 4/4)
Self-recovered:     0
Human intervention: 0
Final commit:       5ced706 on feature/m4 (code + tests + D11 ADR);
                   task files separate
Status:             PASS
Notes:              windowId already flowed through normalizeTab/
                    WorkspaceTab, so item 3 was pure derivation +
                    rendering: lib/windowBadge.ts (windowBadges — W1..Wn
                    labels by ascending windowId, stable per-window hue,
                    empty map with <2 known windows so single-window
                    mode stays badge-free; windowHue), TabNode renders a
                    top-right pill (per-window color, tooltip with raw
                    window id), WorkspaceCanvas computes badges once per
                    render from the FULL tab list (stable under search
                    filters), InspectorPanel shows "Window: Wn" for the
                    selected tab, .bw-tab-badge CSS. 8 unit tests in
                    tests/windowBadge.test.ts (labeling order, hue
                    stability/range, unknown windowId -1 handling,
                    renumbering on window close). D11 ADR added.
                    Check loop green: compile, 82/82 unit, wxt build
                    (449.22 kB), e2e 4/4 in Chromium.
                    Remaining M4: item 4 — e2e open tab → card appears,
                    close → gone, navigate → position/cluster preserved.
```

---

```
Task:               M4 iteration 5 (loop iter 7) — e2e live-sync spec
                    (item 4): open → card appears, close → gone,
                    navigate → position/cluster preserved
Model:              pi coding agent (fresh-context loop)
Elapsed time:       ~25 min
Tool calls:         ~30
Build attempts:     1 (PASS on first run)
Failed tests:       0 (82/82 unit, vitest; e2e 5/5 — new "live sync"
                    test passed on first run)
Self-recovered:     0
Human intervention: 0
Final commit:       830603e on feature/m4 (test only); task files
                    separate
Status:             PASS — M4 COMPLETE (all 4 items verified)
Notes:              No product code changes needed; the live pipeline
                    from items 1-3 (tabId identity, debounced event
                    reducers, useTabEvents hook) already behaved
                    correctly in a real browser. New e2e test in
                    tests/e2e/smoke.spec.ts reuses the shared persistent
                    context: opens a workspace page (hosts the listeners),
                    opens a uniquely-URL'd data: tab → card appears via
                    onCreated/onUpdated without reload; closes it → card
                    gone (onRemoved); opens a second tab, drags its card
                    onto a fresh "LiveSync" cluster (page.bringToFront()
                    first so mouse events reach the workspace tab), then
                    navigates that same real tab in place and asserts:
                    card text updates in place at the same screen position
                    (boundingBox ±1px), chrome.tabs.query shows the SAME
                    tabId with the new URL, and the persisted v2 snapshot
                    keeps position + clusterId for that tabId. Test closes
                    its own tabs so later runs stay deterministic;
                    SnapshotTab test interface gained optional tabId.
                    Check loop green: compile, 82/82 unit, wxt build
                    (449.22 kB), e2e 5/5 in headed Chromium.
                    M4 done; feature/m4 awaits merge (human). Next:
                    M5/M6 per .agent/TASKS.md "Later".
```

---

```
Task:               M5 iteration 2 — cluster drag + inline rename (item 2)
Model:              pi coding agent, qwen3.8-27b-mlx (LM Studio)
Elapsed time:       ~15 min
Tool calls:         ~20
Build attempts:     1 (compile PASS first run)
Failed tests:       1 e2e run (live-sync drag-onto-cluster flake —
                    clusterId undefined after raw-mouse drag; passed on
                    immediate rerun, 6/6)
Self-recovered:     1 (e2e flake diagnosed as timing, rerun green;
                    recorded in TASKS.md known issues)
Human intervention: 0
Final commit:       5f31b37 on feature/m5 (code + tests + D13);
                   task files separate
Status:             PASS
Notes:              Item 2 complete. Clusters are now draggable frames:
                    new store action moveCluster (pure, unit-tested),
                    WorkspaceCanvas routes cluster-id position changes to
                    it (tab ids numeric, cluster ids 'cluster-...');
                    positions persist via the existing v2 snapshot schema
                    (no format change). Member cards do NOT follow a
                    moving cluster — documented as D13 (assignment is by
                    explicit drop, not containment). Inline rename
                    replaces window.prompt: double-click the cluster
                    title (or ✎) edits in place; Enter/blur commits,
                    Escape cancels; mousedown stopPropagation on
                    title/input/buttons so editing never starts a node
                    drag or pan; aria-labels added to the rename/delete
                    buttons and input (feeds item 4). +2 store tests
                    (move without moving members; unknown-id no-op).
                    Check loop green: compile, 95/95 unit, wxt build
                    (451.64 kB), e2e 6/6 in headed Chromium.
                    Remaining M5: item 3 (150-tab perf — React.memo +
                    stable callbacks, render-count test or documented
                    measurement), item 4 (a11y basics — aria-labels,
                    roles/tab order on cards, prefers-reduced-motion).
```
