# CURRENT_TASK.md

- **Task**: M7 — Semantic clustering (branch `feature/m7`, create from `main`)
- **Status**: active (started 2026-10-18, engine: pi coding agent, 128K ctx)

## M7 task statement

Let the machine propose groupings a human wouldn't bother to make.
Use the LOCAL embedding model already served by LM Studio
(`text-embedding-nomic-embed-text-v1.5`, endpoint
`POST http://localhost:1234/v1/embeddings`, OpenAI-compatible). Scope:

1. **`lib/semantic.ts` (pure, unit-testable)** — cosine similarity and a
   greedy threshold clustering: sort pairs by similarity desc, merge
   into clusters while above a threshold; pick and document the
   threshold in docs/DECISIONS.md. No library; math by hand.
2. **Embedding pipeline** — embed each tab's `title + " " + hostname`
   via the embeddings endpoint; cache vectors by URL in the workspace
   storage so reloads don't re-embed. Failure handling: if the endpoint
   is unreachable or the model is not loaded, surface a notice in the
   UI and do nothing else (never crash, never block the canvas).
3. **"Suggest clusters" toolbar button** — runs the pipeline on
   UNCLUSTERED tabs only (never touches existing user clusters), creates
   clusters named by the dominant domain of each group (fallback:
   common title prefix), places them at free positions. Reuses the M6
   safety pattern: auto-save `before-autolayout` snapshot first.
4. **Tests** — unit tests for clustering math with fixed vectors
   (determinism, threshold behavior, singletons); store/pipeline tests
   with a MOCKED fetch (no live model in tests). No e2e against the
   live embedding endpoint; extend e2e only to assert the button exists
   and the failure notice path renders (mocked fetch failure).

Rules: check loop (`npm run compile && npm test && npm run build &&
npm run test:e2e`) green before each commit; work on `feature/m7`;
ordinary commits allowed; do NOT push or merge. See .agent/POLICY.md.

## M6 archive

M6 (tidy grid, group-by-domain, autolayout safety snapshot) — see
`.agent/RUN_LOG.md` and the merge commit on `main`.
