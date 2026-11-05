// @ts-check
// Shared constants for the embedded Postgres used by E2E tests.
// playwright.config.js and global-setup/teardown all import from here
// so the port and credentials stay in sync automatically.
const path = require('path');
const os = require('os');

const EMBEDDED_PORT = 5544;
const EMBEDDED_USER = 'postgres';
const EMBEDDED_PASS = 'password';
const EMBEDDED_DB   = 'story_map_test';
const EMBEDDED_DIR  = path.join(os.tmpdir(), 'pg-e2e-data');
const EMBEDDED_URL  =
  `postgresql://${EMBEDDED_USER}:${EMBEDDED_PASS}@localhost:${EMBEDDED_PORT}/${EMBEDDED_DB}`;

module.exports = { EMBEDDED_PORT, EMBEDDED_USER, EMBEDDED_PASS, EMBEDDED_DB, EMBEDDED_DIR, EMBEDDED_URL };
