const { defineConfig, devices } = require('@playwright/test')

const frontendUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173'
const backendUrl = process.env.E2E_API_HEALTH_URL || 'http://localhost:5000/api/health'

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:backend',
      url: backendUrl,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:frontend -- --host 127.0.0.1',
      url: frontendUrl,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
