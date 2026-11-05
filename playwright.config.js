// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { EMBEDDED_URL } = require('./tests/e2e/db-config');

// Default to the embedded Postgres started by global-setup. Only override
// TEST_DATABASE_URL if you explicitly want a different local/staging DB.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || EMBEDDED_URL;

// Safety: refuse Neon (production cloud) and the production DATABASE_URL.
const PROD_DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

if (TEST_DATABASE_URL.includes('neon.tech')) {
  process.stderr.write(
    '\nERROR: TEST_DATABASE_URL must not point at Neon (production cloud database).\n' +
    'Leave TEST_DATABASE_URL unset — global-setup starts an embedded database automatically.\n\n'
  );
  process.exit(1);
}

if (PROD_DB_URL && TEST_DATABASE_URL === PROD_DB_URL) {
  process.stderr.write(
    '\nERROR: TEST_DATABASE_URL must not match DATABASE_URL (production).\n' +
    'Leave TEST_DATABASE_URL unset — global-setup starts an embedded database automatically.\n\n'
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
