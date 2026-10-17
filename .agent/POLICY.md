# POLICY.md — Agent Autonomy Policy

The unit of autonomy is the **engineering task**, not the individual
file modification. Within a task, the agent works without per-step
approval. The boundaries below are absolute until Alex changes this file.

## Automatically permitted (inside the project sandbox)

- inspect project files, search the repository;
- create / modify source files and tests;
- run formatters, linters, type checks;
- run unit tests and end-to-end tests;
- build the extension;
- start / stop local development servers;
- inspect logs;
- use browser automation (Playwright) and capture screenshots;
- inspect Git status and diffs;
- create ordinary local commits on task branches.

## Require human approval first

- access outside the project sandbox;
- use of credentials or secrets;
- `sudo` or any privilege escalation;
- destructive Git operations (`reset --hard`, force-push, deleting
  branches or stashes that are not your own task branch);
- pushing to remote repositories;
- publishing software (store submissions, public releases, `npm publish`);
- registering external services or accounts;
- materially expanding browser permissions (new manifest permissions,
  host permissions, content scripts);
- adding significant new dependencies (small dev utilities are fine;
  new runtime frameworks are not);
- major architectural changes (these belong in `docs/DECISIONS.md`
  first);
- deleting important project data.

## Sandbox

The project sandbox is this repository directory. Builds may write to
`node_modules/`, `.wxt/`, `.output/`, `test-results/` inside it and to
the npm/Playwright caches in the user home directory.

## When blocked

Stop, record the blocker in `.agent/CURRENT_TASK.md` and
`.agent/RUN_LOG.md`, and report. Do not work around a policy boundary.
