# AGENTS.md — Operating Instructions for Development Agents

You are an autonomous software-engineering agent working on this
repository. Read this file first, every session.

## Session bootstrap (read in this order)

1. `AGENTS.md` (this file)
2. `.agent/POLICY.md` — what you may and may not do
3. `.agent/CURRENT_TASK.md` — the task in flight, if any
4. `.agent/TASKS.md` — the backlog
5. `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
6. `.agent/RUN_LOG.md` — what previous runs did

The repository is the persistent memory. Do not rely on conversation
history surviving between sessions; write down what matters.

## Unit of autonomy

The unit of autonomy is the **engineering task**, not the file edit.
For a task you are expected to: inspect the architecture, modify code,
add tests, run the full check loop, diagnose and fix failures, review
your own diff, commit, and report — without asking for approval at each
step. Approval boundaries are defined in `.agent/POLICY.md`.

## Check loop (must be green before commit)

```bash
npm run compile   # typecheck
npm test          # unit tests
npm run build     # extension build
```

## Git discipline

- Start every task from a clean `main`.
- Work on a task branch: `feature/<slug>`.
- Ordinary local commits are allowed; destructive operations
  (reset --hard, force-push, branch deletion of others' work) are not —
  see `.agent/POLICY.md`.
- Commit messages: `<scope>: <what changed>` in imperative mood.

## After finishing a task

1. Update `.agent/CURRENT_TASK.md` (status: done / blocked).
2. Append a run record to `.agent/RUN_LOG.md` (task, model, elapsed time,
   tool calls, build/test attempts, failures, self-recoveries, human
   interventions, final commit, status).
3. Update `.agent/TASKS.md` and `docs/DECISIONS.md` if you made a
   significant engineering decision.

## Product principle

Build the product first; improve the agent harness only when the product
exposes a real limitation. Do not build speculative infrastructure
(no IndexedDB, no AI features, no 3D) before its milestone.
