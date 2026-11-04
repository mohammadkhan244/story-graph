// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
  process.stderr.write(
    '\nERROR: TEST_DATABASE_URL is not set.\n' +
    'Point it at a local test database — never production.\n' +
    'Example:\n' +
    '  TEST_DATABASE_URL=postgresql://localhost/story_map_test npm run test:e2e\n\n'
  );
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_ADMIN_PW = process.env.TEST_ADMIN_PASSWORD || 'e2e-test-secret';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.js'),
  webServer: {
    command: 'npm run build && npm start',
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      MOCK_CLAUDE: '1',
      DATABASE_URL: TEST_DATABASE_URL,
      ADMIN_PASSWORD: TEST_ADMIN_PW,
      NEXT_PUBLIC_BASE_URL: BASE_URL,
      NODE_ENV: 'production',
    },
  },
});
