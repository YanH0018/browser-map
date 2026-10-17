# Browser Workspace

A spatial browser tab and workspace management system — browser tabs as
cards on a 2D canvas instead of a one-dimensional strip, where
**position itself encodes meaning** ("the robotics papers are over there").


## Stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript |
| UI | React 19 |
| Extension framework | WXT (MV3) |
| Spatial canvas | XYFlow (React Flow v12) |
| State | Zustand |
| Persistence | `browser.storage.local` |
| Unit tests | Vitest |
| E2E tests | Playwright |

## Commands

```bash
npm run dev        # dev mode with hot reload (Chromium)
npm run build      # production build → .output/chrome-mv3
npm run compile    # typecheck only
npm test           # unit tests (Vitest)
npm run test:e2e   # browser-level tests (Playwright; build first)
```

## Documentation map

- `docs/PRODUCT.md` — what the software is intended to become
- `docs/ARCHITECTURE.md` — current technical structure
- `docs/DECISIONS.md` — significant engineering decisions (ADR-style)
- `docs/ROADMAP.md` — milestones M0–M10
- `.agent/` — live agent state: current task, backlog, run log, policy
- `AGENTS.md` — operating instructions for development agents
