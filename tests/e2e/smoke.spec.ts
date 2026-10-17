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
