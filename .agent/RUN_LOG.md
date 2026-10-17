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
