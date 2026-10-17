# DECISIONS.md — Engineering Decision Log

ADR-style. Newest last. Each entry: decision, rationale, consequences.

## D1 — Extension framework: WXT

- **Decision**: use WXT (MV3) rather than a hand-rolled manifest setup.
- **Rationale**: typed browser APIs, entrypoint conventions, dev server
  with hot reload, one codebase targeting Chromium now and Firefox later.
- **Consequences**: build output in `.output/`; entrypoint conventions
  under `entrypoints/`; WXT version pinned in `package.json`.

## D2 — Spatial canvas: XYFlow (React Flow v12)

- **Decision**: use `@xyflow/react` instead of a custom 2D canvas.
- **Rationale**: panning/zooming/dragging/grouping/viewport state are
  solved problems; development time belongs to the product, not canvas
  plumbing.
- **Consequences**: custom node types (`tab`, `cluster`); attribution
  hidden via `proOptions` (revisit licensing if the project goes public).

## D3 — State: Zustand

- **Decision**: single lightweight store (`stores/workspaceStore.ts`).
- **Rationale**: minimal boilerplate, easy to observe from the
  persistence layer, testable in plain node.
- **Consequences**: cross-component state lives here; derived data via
  selectors (`selectVisibleTabs`).

## D4 — Persistence: browser.storage.local

- **Decision**: MVP persistence on `browser.storage.local` via
  `wxt/utils/storage`.
- **Rationale**: sufficient for coordinates, clusters, preferences and
  viewport. IndexedDB only when history/snapshots/embeddings/thumbnails
  actually arrive.
- **Consequences**: pure (de)serialization in `lib/persistence.ts`;
  versioned snapshots (`SNAPSHOT_VERSION`); storage I/O isolated in
  `lib/workspaceStorage.ts`.

## D5 — No content script in the MVP

- **Decision**: no code injection into web pages.
- **Rationale**: the MVP needs none; it reduces permissions and
  simplifies the security model.
- **Consequences**: manifest requests only `tabs` + `storage`, no host
  permissions. Revisit only if a feature truly requires page access.

## D6 — Tab identity: URL-based persistence

- **Decision**: persisted tab metadata is keyed by URL, not `tabId`.
- **Rationale**: tab IDs are ephemeral across browser sessions.
- **Consequences**: duplicate URLs share one persisted position (known
  limitation; acceptable for MVP).

## D7 — Initial target: Chromium

- **Decision**: develop against Chromium first.
- **Rationale**: Playwright support and dev loop quality; architecture
  avoids Chromium-specific assumptions so Firefox/Safari stay possible.
- **Consequences**: `build:firefox` exists but is not part of the MVP
  check loop.

## D8 — Background worker stays stateless

- **Decision**: the service worker only broadcasts `bw:tabs-changed`;
  the workspace page re-queries state.
- **Rationale**: MV3 service workers are killed arbitrarily; stateless
  restart is free.
- **Consequences**: workspace page owns tab-state caching.
