import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 240000, workers: 1, expect: { timeout: 15000 },
  use: { actionTimeout: 15000, navigationTimeout: 30000, baseURL: 'http://127.0.0.1:3000', hasTouch: true, viewport: { width: 390, height: 844 } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }, { name: 'firefox', use: { browserName: 'firefox' } }],
  webServer: { command: 'npm run start -- --hostname 127.0.0.1', url: 'http://127.0.0.1:3000', reuseExistingServer: true, timeout: 120000 },
});
