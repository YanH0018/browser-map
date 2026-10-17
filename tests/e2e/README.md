# End-to-end tests

Browser-level tests live here (Playwright). They are **excluded from the
unit-test run** (`vitest.config.ts`) and executed via:

```bash
npm run build        # produces .output/chrome-mv3
npm run test:e2e     # loads the built extension into Chromium
```

Target scenario for the first real e2e suite (see docs/ROADMAP.md, M4):

1. launch Chromium with the extension loaded;
2. create test tabs;
3. open the Browser Workspace page;
4. verify tabs appear as cards;
5. move a card, create a cluster;
6. reload the workspace page;
7. verify positions and clusters were restored;
8. activate and close a real tab from the workspace.

A smoke spec is provided in `smoke.spec.ts` (skipped until the product
reaches M1). Visual regression loops (screenshot → vision-model inspection)
build on top of these specs later.
