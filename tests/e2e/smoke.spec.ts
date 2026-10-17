import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';

/**
 * Smoke test: launch Chromium with the built extension and confirm the
 * background service worker registers. Skipped until M1 — the real e2e
 * scenarios are listed in tests/e2e/README.md.
 *
 * Requires: npm run build   (extension at .output/chrome-mv3)
 */

const extensionPath = path.resolve(__dirname, '../../.output/chrome-mv3');

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

test.fixme('extension service worker starts', async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  expect(worker.url()).toContain('chrome-extension://');
});
