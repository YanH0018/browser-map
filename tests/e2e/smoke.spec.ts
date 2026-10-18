import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
