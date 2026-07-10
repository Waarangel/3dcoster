import { defineConfig, devices } from '@playwright/test';

// Phase 42 GDPR-01/D-14 — minimal E2E harness scoped to the consent-gate spec.
// Chromium only (not the full 3-browser matrix) — this is the project's first
// E2E tooling and stays deliberately minimal. Targets the pinned :4173 preview
// server (vite.config.ts `server.port`), not the dev server.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
