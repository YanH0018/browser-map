import { defineConfig } from '@playwright/test';

// End-to-end tests load the *built* extension (.output/chrome-mv3) into
// a persistent Chromium context. Run `npm run build` before `npm run test:e2e`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    headless: false, // extensions require a headed (or xvfb) Chromium
  },
});
