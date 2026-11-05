// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { EMBEDDED_URL } = require('./tests/e2e/db-config');

// Skip `npm run build` when .next is already newer than source files.
function needsBuild() {
  const nextDir = path.join(__dirname, '.next');
  if (!fs.existsSync(nextDir)) return true;
  const nextMtime = fs.statSync(nextDir).mtimeMs;
  function maxMtime(dir) {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).reduce((mx, f) => {
      const fp = path.join(dir, f);
      const st = fs.statSync(fp);
      return Math.max(mx, st.isDirectory() ? maxMtime(fp) : st.mtimeMs);
    }, 0);
  }
  const srcMtime = Math.max(...['app', 'components', 'lib', 'public'].map(d =>
    maxMtime(path.join(__dirname, d))
  ));
  return srcMtime > nextMtime;
}
const BUILD_CMD = needsBuild() ? 'npm run build && npm start' : 'npm start';

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
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 0,
  fullyParallel: false,
  workers: 2,
  reporter: [['dot']],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.js'),
  webServer: {
    command: BUILD_CMD,
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
