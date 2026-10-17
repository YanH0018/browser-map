# ARCHITECTURE.md — Current Technical Structure

## Subsystems

    Browser APIs → Browser Adapter → Workspace Store → Spatial UI
                                          ↕
                                    Persistence

- **Browser APIs** (`tabs.query/update/remove`, `tabs.onCreated/onUpdated/
  onRemoved/onActivated`) — touched only by the background worker and the
  adapter.
- **Browser adapter** (`lib/browserAdapter.ts`) — normalizes browser tabs
  into `WorkspaceTab` domain objects. The rest of the app never sees
  browser-specific shapes.
- **Workspace store** (`stores/workspaceStore.ts`, Zustand) — tabs,
  clusters, selection, viewport, search query, plus actions
  (`moveTab`, `createCluster`, `assignTab`, `removeTab`, …).
- **Spatial UI** (`components/`, XYFlow) — panning, zooming, dragging,
  selection and viewport state without a custom canvas.
- **Persistence** (`lib/persistence.ts` pure + `lib/workspaceStorage.ts`
  I/O) — serializes to `WorkspaceSnapshot` in `browser.storage.local`.

## Extension entrypoints

    entrypoints/
      background.ts        tab-event listeners → broadcast "bw:tabs-changed";
                           stateless so MV3 service-worker restarts are safe
      workspace/           full extension page (index.html, main.tsx, App.tsx)

No content script. The MVP does not inject code into web pages.

## Core data model (`lib/types.ts`)

- `WorkspaceTab` — ephemeral `tabId`/`windowId` plus stable metadata
  (title, url, domain, favicon), `position`, optional `clusterId`.
- `WorkspaceCluster` — `id`, `name`, `position`, `size`.
- `WorkspaceSnapshot` — `version`, `PersistedTabMetadata[]` (keyed by URL,
  **never by tabId**), clusters, viewport. `SNAPSHOT_VERSION = 1`.

## Identity rule

Browser tab IDs change between sessions. Persistence and restoration
match on URL; live tab identity is re-established at query time
(`applySnapshotToTabs`).

## Component hierarchy

    App
     ├─ Toolbar (Search, cluster creation; workspace selector later)
     ├─ WorkspaceCanvas (XYFlow)
     │    ├─ ClusterNode
     │    └─ TabNode × n
     └─ InspectorPanel (TabMetadata, actions: activate / close)

## Testing levels

- Unit (`tests/*.test.ts`, Vitest, node env): persistence round-trips,
  store transitions, adapter normalization, search.
- Component: later (M5) — card/cluster/toolbar behavior.
- E2E (`tests/e2e/`, Playwright): launch Chromium with the built
  extension; scenario list in `tests/e2e/README.md`.
- Visual: screenshot → vision-model inspection loop, built on the e2e
  harness (M5+).
