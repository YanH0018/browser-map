import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * M1 acceptance smoke test: launch Chromium with the built extension,
 * confirm the background service worker registers, open the workspace
 * page and verify the app shell renders. A headed window appears briefly.
 *
 * Requires: npm run build   (extension at .output/chrome-mv3)
 */

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
