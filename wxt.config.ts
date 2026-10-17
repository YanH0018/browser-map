import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Browser Workspace',
    description: 'Spatial browser tab and workspace management.',
    // MVP permission set: read/manage tabs + local persistence.
    // No host permissions, no content scripts (see docs/DECISIONS.md).
    permissions: ['tabs', 'storage'],
  },
});
