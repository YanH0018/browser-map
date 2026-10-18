# CURRENT_TASK.md

- **Task**: M7 — Semantic clustering (branch `feature/m7`)
- **Status**: done (2026-10-18, engine: pi coding agent, qwen3.8-27b-mlx via LM Studio) —
  all four items implemented and verified at `37aa208`; branch awaits
  human merge. Next milestone per ROADMAP: M8 (natural-language workspace
  commands via local model).

## What was done (iteration 3 of the fresh-context loop)

A prior iteration had left a complete-but-red M7 implementation
uncommitted on `feature/m7`. This iteration:

1. **Diagnosed 5 failing unit tests** — all test-data bugs, not
   algorithm bugs:
   - `tests/semantic.test.ts`: vector `e=[0,1]` has cos 0.8 with
     `b=[3,4]`, so "separate" groups merged (3 tests); in
     `buildSuggestedClusters` tab 4 reused `V.b` (identical to tab 1's
     vector) and `a=[1,0]` bridged the two intended groups via
     cos(a,b)=0.6 → all four tabs formed one group.
   - `tests/embeddings.test.ts`: the `tab()` fixture defaults to
     `domain: 'a.example.com'`; tabs 2/3 overrode the URL but not the
     domain, so embedded texts were "Fresh one a.example.com".
2. **Fixed the test data**: added vectors `p=[1,-2]`, `q=[2,-3]`
   (cos ≈ 0.99, both < 0.5 from the github group) and `h=[-1,-1]`
   (≤ 0.32 from everything) to the fixed-vector set; swapped `e`→`f`
   (cos ≤ -0.6 from a and b) in the three threshold tests; added domain
   overrides to the embeddings fixture.
3. **Wrote D18** in `docs/DECISIONS.md` (referenced by the code but
   missing): threshold 0.5 calibration, single-linkage rationale,
   URL-keyed cache as optimization-not-truth, failure contract.
4. **Added the missing M7 e2e slice** (`tests/e2e/smoke.spec.ts`):
   "Suggest clusters" button exists; endpoint mocked unreachable via
   `page.route('**/v1/embeddings', abort)` (deterministic even if LM
   Studio is running); click → `role=status` notice renders, button
   re-enables, and NOTHING is mutated (same tab set, no new clusters,
   Xi/Psi still unclustered, named-snapshot list byte-identical — a
   failed run must not even create `before-autolayout`).

## Verification (full check loop green at 37aa208)

- `npm run compile` — PASS
- `npm test` — 179/179 unit (was 132 before M7: +24 semantic, +13
  embeddings, +9 store, +1 e2e spec)
- `npm run build` — PASS (.output/chrome-mv3, 460.28 kB)
- `npm run test:e2e` — 8/8 in headed Chromium

## M7 task statement (archive)

Let the machine propose groupings a human wouldn't bother to make.
Use the LOCAL embedding model already served by LM Studio
(`text-embedding-nomic-embed-text-v1.5`, endpoint
`POST http://localhost:1234/v1/embeddings`, OpenAI-compatible). Scope:

1. **`lib/semantic.ts` (pure, unit-testable)** — cosine similarity and a
   greedy threshold clustering; pick and document the threshold in
   docs/DECISIONS.md (→ D18: 0.5). No library; math by hand.
2. **Embedding pipeline** — embed each tab's `title + " " + hostname`;
   cache vectors by URL in workspace storage; failure → UI notice, never
   crash/block the canvas.
3. **"Suggest clusters" toolbar button** — unclustered tabs only, named
   by dominant domain (fallback: common title prefix), free positions,
   `before-autolayout` safety snapshot first (M6 pattern).
4. **Tests** — unit tests for clustering math with fixed vectors;
   store/pipeline tests with MOCKED fetch; e2e only asserts the button
   exists and the failure notice path renders (mocked fetch failure).

All four items: see `.agent/TASKS.md` M7 section (all `[x]`, `37aa208`).

## M6 archive

M6 (tidy grid, group-by-domain, autolayout safety snapshot) — see
`.agent/RUN_LOG.md` and the merge commit on `main`.
