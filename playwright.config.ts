import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4177',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build -- --mode e2e --outDir dist-e2e && npm run preview -- --host 127.0.0.1 --port 4177 --strictPort --outDir dist-e2e',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: 'https://booking-test.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_only' },
  },
})
