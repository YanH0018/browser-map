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

## D9 — Tab identity: tabId-first with URL fallback (supersedes D6)

- **Decision**: persisted tab state is keyed by `tabId`; URL/title are
  display data plus a fallback for entries whose tabId is unknown (v1
  snapshots) or stale (tab closed, browser restarted). Snapshot version
  bumped to 2; v1 snapshots still load and migrate on next save.
- **Rationale**: URL-keyed matching (D6) made a navigating tab lose its
  position and cluster on every resync — the canvas could not be a live
  mirror of the browser. tabId is stable for the whole browser session,
  which covers all live-sync cases; the URL fallback covers restarts and
  legacy snapshots.
- **Consequences**: matching logic centralized in `lib/tabIdentity.ts`
  (`resolveTabState`, shared by snapshot restore and live resync);
  duplicate-URL tabs no longer alias one arrangement (each persisted
  entry is consumed at most once); `PersistedTabMetadata.tabId` is
  optional so v1 data stays valid.

## D10 — Live chrome.tabs events via pure reducers + debounce

- **Decision**: the workspace page subscribes directly to
  `tabs.onCreated/onRemoved/onUpdated/onActivated` and folds debounced
  (150 ms) event batches into the store through pure reducers
  (`lib/tabEvents.ts`, `applyTabEvent(s)`). The background's
  `bw:tabs-changed` full resync (D8) remains as a self-healing
  fallback.
- **Rationale**: the stateless background (D8) cannot reliably hold
  per-tab state; pure reducers keep event handling unit-testable without
  mocking the browser API, and debouncing absorbs bursts (restoring a
  closed window fires many events at once).
- **Consequences**: store gains `applyTabEvents`; reducers are
  idempotent (duplicate `created` is a no-op, unknown tabIds are no-ops,
  so the extension's own pages never become cards); `onActivated`
  follows the real active tab and clears selection when that tab has no
  card; `nextFreePositionFor` (lib/layout.ts) places fresh cards at the
  next free cascade slot so they never overlap; event-driven changes are
  persisted by the existing debounced snapshot save.

## D11 — Multi-window: derived W1..Wn badges, no grouping yet

- **Decision**: tabs from every browser window appear on the canvas;
  each card shows a small badge (W1, W2, …) with a stable per-window
  hue identifying its window. Badges are *derived* from the current tab
  list (`lib/windowBadge.ts`, labels by ascending windowId) and are only
  shown when two or more known windows exist. No per-window grouping.
- **Rationale**: the M4 task asks for a small badge/label, not
  grouping; deriving (instead of persisting) means no snapshot
  migration and labels stay consistent as windows open/close; hiding
  badges in single-window mode avoids pure noise.
- **Consequences**: `windowBadges` is a pure, unit-tested helper;
  TabNode renders the badge from node data; WorkspaceCanvas computes
  badges once per render from the *full* tab list so labels stay stable
  while a search filter hides cards; InspectorPanel shows the window
  label for the selected tab; persistence format unchanged (windowId was
  already on WorkspaceTab via normalizeTab).

## D12 — Keyboard navigation: spatial-nearest arrow movement

- **Decision**: arrow keys move a visible card selection by *spatial
  nearest* in the pressed direction (not reading order): candidates are
  visible cards whose position lies in front of the arrow (positive
  projection); among them the one minimizing
  `distance × (1 + |perpendicular| / forward)` wins, with the smaller
  tabId as deterministic tiebreak. Nothing selected → first visible card;
  no candidate in that direction → stay put (no wrap-around). Enter
  activates the real tab behind the selected card, reusing M3's
  `activateBrowserTab` path; Escape clears selection. The geometry is a
  pure reducer (`lib/keyboardNav.ts`, `nextSelectedTabId`); a
  document-level capture-phase keydown hook (`useKeyboardNav`) wires it,
  ignoring keys while an input/button/contenteditable has focus and never
  hijacking Cmd/Ctrl/Alt combos.
- **Rationale**: the canvas is free-form 2D — cards are dragged anywhere,
  so row-major reading order would jump unpredictably; spatial-nearest is
  the standard for 2D canvases (Figma/Keynote-style) and matches what the
  user sees. A pure reducer keeps the geometry unit-testable without a
  browser; capture phase guarantees we win over React Flow's own key
  handling.
- **Consequences**: the selection highlight is a CSS class on the card
  (`bw-tab-card--selected`), deliberately NOT XYFlow's `node.selected`,
  which would enable React Flow's arrow-move / delete key semantics;
  navigation respects the search filter (only visible cards are
  candidates); after Enter, the live `onActivated` event keeps selection
  on the activated card (D10); cards are uniform-sized, so top-left
  positions give the same relative vectors as center math.

## D13 — Clusters are draggable frames; member cards do not follow

- **Decision**: cluster nodes are draggable (M5 item 2); a drag updates
  `WorkspaceCluster.position` through the new store action
  `moveCluster`, which persists via the existing snapshot schema (cluster
  positions were already serialized in v2). Member cards do NOT follow a
  moving cluster: their `position` is independent, and membership is by
  explicit drop (M2), not geometric containment. Renaming a cluster is
  inline — double-click the title (or press ✎) to edit in place;
  Enter/blur commits, Escape cancels — replacing `window.prompt`.
- **Rationale**: containment-following would require re-laying out every
  member card on each drag frame (and deciding relative offsets), which
  fights the free-form canvas and makes drops ambiguous; keeping cards
  independent is simpler, predictable, and matches the drop-based
  assignment model. Inline rename avoids a blocking dialog inside the
  canvas and keeps focus on the node being edited.
- **Consequences**: `moveCluster` is a pure store update (unit-tested,
  including the no-follow guarantee); WorkspaceCanvas routes cluster-id
  position changes to it (tab ids are numeric, cluster ids start with
  `cluster-`); ClusterNode owns the inline-edit state; mousedown on the
  title/input/buttons stops propagation so editing never starts a node
  drag or canvas pan; persistence format unchanged.
