import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIDY_GRID_DEFAULTS } from '../../lib/autoLayout';

/**
 * M1 acceptance smoke test: launch Chromium with the built extension,
 * confirm the background service worker registers, open the workspace
 * page and verify the app shell renders. A headed window appears briefly.
 *
 * Requires: npm run build   (extension at .output/chrome-mv3)
 */

/** Shape of the persisted snapshot as read from chrome.storage.local. */
interface SnapshotTab {
  url: string;
  title: string;
  position: { x: number; y: number };
  clusterId?: string;
  /** v2 snapshots key tabs by real browser tab id (D9). */
  tabId?: number;
}

interface SnapshotCluster {
  id: string;
  name: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface WorkspaceSnapshotLike {
  version: number;
  tabs: SnapshotTab[];
  clusters: SnapshotCluster[];
}

interface NamedSnapshotLike {
  id: string;
  name: string;
  tabs: SnapshotTab[];
}

/** Read the persisted workspace snapshot straight from extension storage. */
async function readSnapshot(page: Page): Promise<WorkspaceSnapshotLike | null> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const chromeApi = (window as unknown as { chrome: any }).chrome;
        // wxt/utils/storage resolves "local:workspaceSnapshot" to area
        // "local", key "workspaceSnapshot" — that is the real storage key.
        chromeApi.storage.local.get('workspaceSnapshot', (value: Record<string, unknown>) =>
          resolve((value['workspaceSnapshot'] as WorkspaceSnapshotLike | undefined) ?? null),
        );
      }),
  );
}

/** Read the persisted named snapshots straight from extension storage. */
async function readNamedSnapshots(page: Page): Promise<NamedSnapshotLike[]> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const chromeApi = (window as unknown as { chrome: any }).chrome;
        // wxt/utils/storage resolves "local:namedSnapshots" to area
        // "local", key "namedSnapshots".
        chromeApi.storage.local.get('namedSnapshots', (value: Record<string, unknown>) =>
          resolve((value['namedSnapshots'] as NamedSnapshotLike[] | undefined) ?? []),
        );
      }),
  );
}

/** Stable identity of a persisted tab entry (v2: real tabId, else URL). */
function tabKey(t: SnapshotTab): string {
  return t.tabId !== undefined ? `tab:${t.tabId}` : `url:${t.url}`;
}

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.output/chrome-mv3',
);

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
});

test.afterAll(async () => {
  await context?.close();
});

test('extension service worker starts', async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  expect(worker.url()).toContain('chrome-extension://');
});

test('workspace page renders the app shell', async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workspace.html`);

  await expect(page.locator('.bw-toolbar input[type="search"]')).toBeVisible();
  await expect(page.locator('.bw-canvas')).toBeVisible();
  await expect(page.locator('.bw-inspector')).toBeVisible();

  // Evidence for the visual-inspection loop (M5 builds on this).
  await page.screenshot({ path: 'test-results/m1-workspace.png', fullPage: true });
});

/**
 * M2 acceptance (item 4): drag a tab card onto a cluster, reload the
 * workspace page, and verify positions + clusters were restored.
 */
test('drag card onto cluster; reload restores positions and clusters', async () => {
  // Two uniquely-URL'd tabs: snapshot merge is keyed by URL, so the URLs
  // must not collide (two about:blank tabs would alias to one entry).
  const alphaUrl = 'data:text/html,<title>Alpha</title>';
  const betaUrl = 'data:text/html,<title>Beta</title>';
  await (await context.newPage()).goto(alphaUrl);
  await (await context.newPage()).goto(betaUrl);

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workspace.html`);

  const alphaCard = page.locator('.bw-tab-card', { hasText: 'Alpha' });
  const betaCard = page.locator('.bw-tab-card', { hasText: 'Beta' });
  await expect(alphaCard).toBeVisible();
  await expect(betaCard).toBeVisible();

  // Toolbar "New cluster" asks for a name via window.prompt.
  page.on('dialog', (dialog) => dialog.accept('Research'));
  await page.getByRole('button', { name: 'New cluster' }).click();
  const clusterNode = page.locator('.bw-cluster-node', { hasText: 'Research' });
  await expect(clusterNode).toBeVisible();

  // Drag the Alpha card from its center onto the cluster's center.
  const cardBox = (await alphaCard.boundingBox())!;
  const clusterBox = (await clusterNode.boundingBox())!;
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(clusterBox.x + clusterBox.width / 2, clusterBox.y + clusterBox.height / 2, {
    steps: 15,
  });
  await page.mouse.up();

  // The store debounces saves by 500ms; give it time, then read storage.
  await page.waitForTimeout(1200);
  const before = (await readSnapshot(page))!;
  expect(before.clusters).toHaveLength(1);
  const cluster = before.clusters[0]!;
  expect(cluster.name).toBe('Research');

  const alphaBefore = before.tabs.find((t) => t.url === alphaUrl)!;
  expect(alphaBefore.clusterId).toBe(cluster.id);
  // Card center (estimated with the fallback card size) must sit inside
  // the cluster rect in flow coordinates.
  const cx = alphaBefore.position.x + 120;
  const cy = alphaBefore.position.y + 34;
  expect(cx).toBeGreaterThan(cluster.position.x);
  expect(cx).toBeLessThan(cluster.position.x + cluster.size.width);
  expect(cy).toBeGreaterThan(cluster.position.y);
  expect(cy).toBeLessThan(cluster.position.y + cluster.size.height);

  const betaBefore = before.tabs.find((t) => t.url === betaUrl)!;
  expect(betaBefore.clusterId).toBeUndefined();

  // Reload the workspace page: positions + clusters must come back.
  await page.reload();
  await expect(alphaCard).toBeVisible();
  await expect(betaCard).toBeVisible();
  await expect(clusterNode).toBeVisible();

  // The assigned card must render inside the cluster again (screen space;
  // both nodes share the same viewport transform).
  const cardBox2 = (await alphaCard.boundingBox())!;
  const clusterBox2 = (await clusterNode.boundingBox())!;
  const overlapW =
    Math.min(cardBox2.x + cardBox2.width, clusterBox2.x + clusterBox2.width) -
    Math.max(cardBox2.x, clusterBox2.x);
  const overlapH =
    Math.min(cardBox2.y + cardBox2.height, clusterBox2.y + clusterBox2.height) -
    Math.max(cardBox2.y, clusterBox2.y);
  expect(overlapW).toBeGreaterThan(0);
  expect(overlapH).toBeGreaterThan(0);

  // No drift: the re-saved snapshot keeps positions and assignments.
  await page.waitForTimeout(1200);
  const after = (await readSnapshot(page))!;
  expect(after.clusters).toEqual(before.clusters);
  const alphaAfter = after.tabs.find((t) => t.url === alphaUrl)!;
  expect(alphaAfter.position).toEqual(alphaBefore.position);
  expect(alphaAfter.clusterId).toBe(cluster.id);
  const betaAfter = after.tabs.find((t) => t.url === betaUrl)!;
  expect(betaAfter.position).toEqual(betaBefore.position);
  expect(betaAfter.clusterId).toBeUndefined();

  await page.screenshot({ path: 'test-results/m2-cluster-restore.png', fullPage: true });
});

/**
 * M1/M2 boundary acceptance: clicking a card selects it in the inspector,
 * and "Activate tab" focuses the real browser tab behind the card.
 */
test('card click selects tab; Activate tab focuses the real browser tab', async () => {
  const gammaUrl = 'data:text/html,<title>Gamma</title>';
  const deltaUrl = 'data:text/html,<title>Delta</title>';
  await (await context.newPage()).goto(gammaUrl);
  await (await context.newPage()).goto(deltaUrl);

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workspace.html`);

  const gammaCard = page.locator('.bw-tab-card', { hasText: 'Gamma' });
  const deltaCard = page.locator('.bw-tab-card', { hasText: 'Delta' });
  await expect(gammaCard).toBeVisible();
  await expect(deltaCard).toBeVisible();

  // URLs of the active tab in each window, via the extension tabs API.
  // The workspace page is an extension page and holds the "tabs" permission,
  // so it can read real tab state even after it loses focus.
  const activeTabUrls = () =>
    page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const chromeApi = (window as unknown as { chrome: any }).chrome;
          chromeApi.tabs.query(
            { active: true },
            (tabs: Array<{ url?: string }>) => resolve(tabs.map((t) => t.url ?? '')),
          );
        }),
    );

  // Sanity: the freshly opened workspace page is the active tab right now.
  await expect.poll(activeTabUrls).toContain(`chrome-extension://${extensionId}/workspace.html`);

  // Clicking a card selects it: the inspector shows its metadata + actions.
  await gammaCard.click();
  const inspector = page.locator('.bw-inspector');
  await expect(inspector).toContainText('Gamma');
  const activateButton = inspector.getByRole('button', { name: 'Activate tab' });
  await expect(activateButton).toBeVisible();

  // Activate the real browser tab behind the card.
  await activateButton.click();

  // The Gamma tab is now active in its window (and Delta is not).
  await expect.poll(activeTabUrls).toContain(gammaUrl);
  const urls = await activeTabUrls();
  expect(urls).not.toContain(deltaUrl);

  await page.screenshot({ path: 'test-results/m1-card-activate.png', fullPage: true });
});

/**
 * M4 acceptance (item 4): the canvas is a live mirror of the browser.
 * Open a tab → its card appears without any reload; close it → the card
 * disappears; navigate a tab in place → position and cluster survive
 * (tabId identity, D9/D10). Asserted via the canvas DOM, the chrome.tabs
 * API and the persisted snapshot.
 */
test('live sync: open → card appears; close → gone; navigate keeps position/cluster', async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;

  // The workspace page hosts the live chrome.tabs listeners (useTabEvents).
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workspace.html`);
  await expect(page.locator('.bw-canvas')).toBeVisible();
  // Let the initial tab sync and any pending debounced saves settle.
  await page.waitForTimeout(700);

  // Look up a real tab's id by URL via the extension tabs API.
  const findTabIdByUrl = (url: string) =>
    page.evaluate(
      (targetUrl: string) =>
        new Promise<number>((resolve) => {
          const chromeApi = (window as unknown as { chrome: any }).chrome;
          chromeApi.tabs.query(
            {},
            (tabs: Array<{ id?: number; url?: string }>) => {
              resolve(tabs.find((t) => t.url === targetUrl)?.id ?? -1);
            },
          );
        }),
      url,
    );

  // --- Open: a new tab's card appears on the canvas without any reload.
  const liveUrl = 'data:text/html,<title>LiveTab</title>';
  const livePage = await context.newPage();
  await livePage.goto(liveUrl);

  const liveCard = page.locator('.bw-tab-card', { hasText: 'LiveTab' });
  await expect(liveCard).toBeVisible(); // via chrome.tabs.onCreated/onUpdated

  // --- Close: the card disappears (chrome.tabs.onRemoved).
  await livePage.close();
  await expect(liveCard).toHaveCount(0);

  // --- Navigate: position + cluster survive (tabId identity, D9).
  const navUrlA = 'data:text/html,<title>NavOne</title>';
  const navUrlB = 'data:text/html,<title>NavTwo</title>';
  const navPage = await context.newPage();
  await navPage.goto(navUrlA);

  const navCard = page.locator('.bw-tab-card', { hasText: 'NavOne' });
  await expect(navCard).toBeVisible();

  // Put the card into a cluster so "cluster preserved" is meaningful.
  page.on('dialog', (dialog) => dialog.accept('LiveSync'));
  await page.getByRole('button', { name: 'New cluster' }).click();
  const clusterNode = page.locator('.bw-cluster-node', { hasText: 'LiveSync' });
  await expect(clusterNode).toBeVisible();

  // The canvas fitView zooms to the cards present at load, so a cluster
  // created afterwards can land OFF-SCREEN (window-size dependent: headed
  // e2e windows differ across displays). An off-screen drop target cannot
  // receive the drag — re-fit the view so card and cluster are both
  // visible before computing drag coordinates.
  await page.locator('.react-flow__controls-fitview').click();
  await page.waitForTimeout(400); // fitView pan/zoom settles

  // The nav tab is active right now; bring the workspace page to front so
  // mouse events (the drag) reach it.
  await page.bringToFront();

  const cardBox = (await navCard.boundingBox())!;
  const clusterBox = (await clusterNode.boundingBox())!;
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(clusterBox.x + clusterBox.width / 2, clusterBox.y + clusterBox.height / 2, {
    steps: 15,
  });
  await page.mouse.up();

  // The store debounces saves by 500ms; give it time, then read storage.
  await page.waitForTimeout(1200);

  // Identity anchor: the real tab id behind the NavOne card.
  const navTabId = await findTabIdByUrl(navUrlA);
  expect(navTabId).toBeGreaterThan(0);

  const before = (await readSnapshot(page))!;
  const beforeEntry = before.tabs.find((t) => t.tabId === navTabId);
  expect(beforeEntry).toBeDefined();
  expect(beforeEntry!.url).toBe(navUrlA);
  expect(beforeEntry!.clusterId).toBeDefined(); // the drag landed

  const boxBefore = (await navCard.boundingBox())!;

  // Navigate the same real tab in place.
  await navPage.goto(navUrlB);

  // The card's text updates in place on the canvas (no reload).
  const navCardB = page.locator('.bw-tab-card', { hasText: 'NavTwo' });
  await expect(navCardB).toBeVisible();
  await expect(page.locator('.bw-tab-card', { hasText: 'NavOne' })).toHaveCount(0);

  // Same real tab (same id) now has the new URL.
  expect(await findTabIdByUrl(navUrlB)).toBe(navTabId);

  // The card stayed put on the canvas (fixed-size card, stable viewport).
  const boxAfter = (await navCardB.boundingBox())!;
  expect(Math.abs(boxAfter.x - boxBefore.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxAfter.y - boxBefore.y)).toBeLessThanOrEqual(1);

  // Persisted snapshot: same tabId, new URL, position + cluster preserved.
  await page.waitForTimeout(1200);
  const after = (await readSnapshot(page))!;
  const afterEntry = after.tabs.find((t) => t.tabId === navTabId);
  expect(afterEntry).toBeDefined();
  expect(afterEntry!.url).toBe(navUrlB);
  expect(afterEntry!.position).toEqual(beforeEntry!.position);
  expect(afterEntry!.clusterId).toBe(beforeEntry!.clusterId);

  // Cleanup: close the tab we opened; its (clustered) card goes with it.
  await navPage.close();
  await expect(navCardB).toHaveCount(0);

  await page.screenshot({ path: 'test-results/m4-live-sync.png', fullPage: true });
});

/**
 * M5 acceptance (item 1): keyboard navigation. Arrow keys move a visible
 * selection between cards (spatial-nearest, D12), Enter activates the real
 * tab behind the selected card (M3 path), Escape clears the selection.
 */
test('keyboard nav: arrows move selection, Enter activates real tab, Escape clears', async () => {
  const kappaUrl = 'data:text/html,<title>Kappa</title>';
  const lambdaUrl = 'data:text/html,<title>Lambda</title>';
  await (await context.newPage()).goto(kappaUrl);
  await (await context.newPage()).goto(lambdaUrl);

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workspace.html`);

  const kappaCard = page.locator('.bw-tab-card', { hasText: 'Kappa' });
  const lambdaCard = page.locator('.bw-tab-card', { hasText: 'Lambda' });
  await expect(kappaCard).toBeVisible();
  await expect(lambdaCard).toBeVisible();
  // Let the initial sync and any pending debounced saves settle.
  await page.waitForTimeout(700);

  const selectedCard = () => page.locator('.bw-tab-card--selected');
  await expect(selectedCard()).toHaveCount(0);

  // The two fresh cards land in the same cascade row (nextFreePositionFor).
  // Determine which is left/right from their on-screen boxes rather than
  // assuming absolute layout (earlier tests leave other cards behind).
  const kappaBox = (await kappaCard.boundingBox())!;
  const lambdaBox = (await lambdaCard.boundingBox())!;
  expect(Math.abs(kappaBox.y - lambdaBox.y)).toBeLessThan(5); // same row
  const kappaIsLeft = kappaBox.x < lambdaBox.x;
  const [leftCard, rightCard] = kappaIsLeft ? [kappaCard, lambdaCard] : [lambdaCard, kappaCard];
  const leftUrl = kappaIsLeft ? kappaUrl : lambdaUrl;
  const rightUrl = kappaIsLeft ? lambdaUrl : kappaUrl;

  // Clicking a card selects it (existing behavior) → visible highlight.
  await leftCard.click();
  await expect(selectedCard()).toHaveCount(1);
  await expect(leftCard).toHaveClass(/bw-tab-card--selected/);

  // ArrowRight → spatially nearest card to the right (the other fresh card,
  // same row beats any diagonal card from earlier tests).
  await page.keyboard.press('ArrowRight');
  await expect(rightCard).toHaveClass(/bw-tab-card--selected/);
  await expect(leftCard).not.toHaveClass(/bw-tab-card--selected/);

  // ArrowLeft → back to the left card.
  await page.keyboard.press('ArrowLeft');
  await expect(leftCard).toHaveClass(/bw-tab-card--selected/);

  // Escape clears the selection.
  await page.keyboard.press('Escape');
  await expect(selectedCard()).toHaveCount(0);

  // Enter activates the real tab behind the selected card (M3 path).
  await rightCard.click();
  const activeTabUrls = () =>
    page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const chromeApi = (window as unknown as { chrome: any }).chrome;
          chromeApi.tabs.query(
            { active: true },
            (tabs: Array<{ url?: string }>) => resolve(tabs.map((t) => t.url ?? '')),
          );
        }),
    );

  await page.keyboard.press('Enter');
  await expect.poll(activeTabUrls).toContain(rightUrl);
  const urls = await activeTabUrls();
  expect(urls).not.toContain(leftUrl);

  await page.screenshot({ path: 'test-results/m5-keyboard-nav.png', fullPage: true });
});

/**
 * M6 acceptance (items 1 + 3): "Tidy grid" snaps every card onto the
 * regular grid (lattice positions, no two cards share a slot), the safety
 * snapshot `before-autolayout` captures the pre-mutation arrangement, and
 * the tidied layout persists across a reload.
 */
test('tidy grid: cards land on the regular grid; safety snapshot; reload persists', async () => {
  const muUrl = 'data:text/html,<title>Mu</title>';
  const nuUrl = 'data:text/html,<title>Nu</title>';
  await (await context.newPage()).goto(muUrl);
  await (await context.newPage()).goto(nuUrl);

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workspace.html`);

  const muCard = page.locator('.bw-tab-card', { hasText: 'Mu' });
  const nuCard = page.locator('.bw-tab-card', { hasText: 'Nu' });
  await expect(muCard).toBeVisible();
  await expect(nuCard).toBeVisible();

  // Let hydration + live sync settle and their debounced saves flush, so
  // the pre-tidy storage read matches the in-memory state at click time.
  await page.waitForTimeout(1200);
  const pre = (await readSnapshot(page))!;
  expect(pre.tabs.length).toBeGreaterThan(0);

  // Click "Tidy grid" (M6 item 1).
  await page.getByRole('button', { name: 'Tidy grid' }).click();

  // The store debounces saves by 500ms; give it time, then read storage.
  await page.waitForTimeout(1200);
  const post = (await readSnapshot(page))!;

  // Same tab set, every card on the tidy lattice, no shared slots.
  expect(post.tabs.map(tabKey).sort()).toEqual(pre.tabs.map(tabKey).sort());
  const { origin, columnWidth, rowHeight } = TIDY_GRID_DEFAULTS;
  const seenSlots = new Set<string>();
  for (const t of post.tabs) {
    expect(t.position.x - origin.x).toBeGreaterThanOrEqual(0);
    expect((t.position.x - origin.x) % columnWidth).toBe(0); // on the lattice
    expect(t.position.y - origin.y).toBeGreaterThanOrEqual(0);
    expect((t.position.y - origin.y) % rowHeight).toBe(0); // on the lattice
    const slot = `${t.position.x}:${t.position.y}`;
    expect(seenSlots.has(slot)).toBe(false); // no two cards share a slot
    seenSlots.add(slot);
  }

  // Safety (M6 item 3): the before-autolayout snapshot captured the
  // PRE-tidy arrangement, one click of Restore would bring it back.
  const safety = (await readNamedSnapshots(page)).filter((s) => s.name === 'before-autolayout');
  expect(safety).toHaveLength(1); // overwritten in place, never duplicated
  const preByKey = new Map(pre.tabs.map((t) => [tabKey(t), t]));
  for (const snapTab of safety[0]!.tabs) {
    const preTab = preByKey.get(tabKey(snapTab));
    expect(preTab).toBeDefined(); // same tab set as before the click
    expect(snapTab.position).toEqual(preTab!.position); // pre-tidy positions
  }

  // Reload: the tidied layout must come back unchanged.
  await page.reload();
  await expect(muCard).toBeVisible();
  await expect(nuCard).toBeVisible();
  await page.waitForTimeout(1200);
  const reloaded = (await readSnapshot(page))!;
  expect(reloaded.tabs.map(tabKey).sort()).toEqual(post.tabs.map(tabKey).sort());
  const postByKey = new Map(post.tabs.map((t) => [tabKey(t), t]));
  for (const t of reloaded.tabs) {
    expect(t.position).toEqual(postByKey.get(tabKey(t))!.position); // no drift
  }

  await page.screenshot({ path: 'test-results/m6-tidy-grid.png', fullPage: true });
});

/**
 * M7 acceptance (items 3 + 4): the "Suggest clusters" toolbar button
 * exists, and when the local embedding endpoint is unreachable (mocked via
 * request interception — no live model in e2e, D18) a click surfaces the
 * failure notice and changes NOTHING: no new clusters, tabs stay
 * unclustered, the named-snapshot list is untouched (a failed run must not
 * even create the before-autolayout safety snapshot).
 */
test('suggest clusters: button exists; endpoint failure renders a notice, changes nothing', async () => {
  const xiUrl = 'data:text/html,<title>Xi</title>';
  const psiUrl = 'data:text/html,<title>Psi</title>';
  await (await context.newPage()).goto(xiUrl);
  await (await context.newPage()).goto(psiUrl);

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workspace.html`);

  const xiCard = page.locator('.bw-tab-card', { hasText: 'Xi' });
  const psiCard = page.locator('.bw-tab-card', { hasText: 'Psi' });
  await expect(xiCard).toBeVisible();
  await expect(psiCard).toBeVisible();

  // Item 3: the toolbar button exists.
  const suggestButton = page.getByRole('button', { name: 'Suggest clusters' });
  await expect(suggestButton).toBeVisible();

  // Let hydration + live sync settle and their debounced saves flush, so
  // the pre-click storage read matches the in-memory state at click time.
  await page.waitForTimeout(1200);
  const pre = (await readSnapshot(page))!;
  const preSnaps = await readNamedSnapshots(page);

  // Item 4: mock the local endpoint as unreachable (deterministic even if
  // LM Studio happens to be running on :1234).
  await page.route('**/v1/embeddings', (route) => route.abort());

  await suggestButton.click();

  // The failure notice renders in the toolbar (role=status, aria-live).
  const notice = page.locator('.bw-semantic-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/Semantic clustering unavailable/);

  // The run finished: the button is re-enabled (never hangs).
  await expect(suggestButton).toBeEnabled();

  // Nothing was mutated: same tab set, no new clusters, Xi/Psi still
  // unclustered, and the named-snapshot list is byte-identical (a failed
  // run must not create or touch before-autolayout).
  await page.waitForTimeout(1200);
  const post = (await readSnapshot(page))!;
  expect(post.tabs.map(tabKey).sort()).toEqual(pre.tabs.map(tabKey).sort());
  expect(post.clusters).toEqual(pre.clusters);
  for (const url of [xiUrl, psiUrl]) {
    expect(post.tabs.find((t) => t.url === url)!.clusterId).toBeUndefined();
  }
  expect(await readNamedSnapshots(page)).toEqual(preSnaps);

  await page.screenshot({ path: 'test-results/m7-semantic-failure.png', fullPage: true });
});
