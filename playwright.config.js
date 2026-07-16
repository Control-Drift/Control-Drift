import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node mock_database.js',
      url: 'http://127.0.0.1:3001/', // Wait for this URL to be ready
      reuseExistingServer: true,
      timeout: 10 * 1000,
    },
    {
      command: 'npx vite --port 5173 --host 127.0.0.1',
      url: 'http://127.0.0.1:5173', // Wait for this URL to be ready
      reuseExistingServer: true,
      timeout: 15 * 1000,
    }
  ],
});
