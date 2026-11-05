// @ts-check
// Runs once after all tests:
// 1. Removes all E2E sessions / stories / emails created during the run.
// 2. Stops the embedded Postgres started by global-setup via pg_ctl (graceful) + PID file.
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { execSync } = require('child_process');
const { Client } = require('pg');
const { EMBEDDED_DIR } = require('./db-config');

const PID_FILE = path.join(os.tmpdir(), 'pg-e2e-pid.json');

function getPgCtlPath() {
  if (process.platform === 'win32') {
    return path.join(
      __dirname,
      '../../node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'
    );
  }
  const candidates = [
    path.join(__dirname, '../../node_modules/@embedded-postgres/linux-x64/native/bin/pg_ctl'),
    path.join(__dirname, '../../node_modules/@embedded-postgres/darwin-arm64/native/bin/pg_ctl'),
    path.join(__dirname, '../../node_modules/@embedded-postgres/darwin-x64/native/bin/pg_ctl'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try { return execSync('which pg_ctl', { encoding: 'utf8', stdio: 'pipe' }).trim(); } catch { return null; }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /PID ${pid} /T`, { shell: 'cmd', stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch {}
}

module.exports = async function globalTeardown() {
  const dbUrl = process.env.TEST_DATABASE_URL;

  // 1. Remove E2E fixture data.
  if (dbUrl) {
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      const { rows } = await client.query(
        `SELECT id FROM sessions WHERE slug = 'e2e-test-prompt-v1' OR title LIKE 'E2E:%'`
      );
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        await client.query(
          `DELETE FROM emails WHERE story_id IN (SELECT id FROM stories WHERE session_id = ANY($1))`,
          [ids]
        );
        await client.query(`DELETE FROM stories WHERE session_id = ANY($1)`, [ids]);
        await client.query(`DELETE FROM sessions WHERE id = ANY($1)`, [ids]);
      }
      console.log(`\n[E2E teardown] ✓ Removed ${ids.length} E2E session(s)\n`);
    } catch (e) {
      console.warn(`[E2E teardown] DB cleanup warning: ${e.message}`);
    } finally {
      await client.end().catch(() => {});
    }
  }

  // 2. Stop embedded Postgres: prefer pg_ctl stop (graceful = releases Windows shared memory).
  if (!fs.existsSync(PID_FILE)) return;

  let pid, dataDir;
  try {
    ({ pid, dir: dataDir } = JSON.parse(fs.readFileSync(PID_FILE, 'utf8')));
  } catch {
    return;
  }

  dataDir = dataDir || EMBEDDED_DIR;
  const pgCtl = getPgCtlPath();

  // pg_ctl stop is preferred: it tells postgres to release shared memory before exiting.
  if (pgCtl && fs.existsSync(pgCtl) && fs.existsSync(dataDir)) {
    try {
      const cmd = `"${pgCtl}" stop -D "${dataDir}" -m immediate`;
      execSync(cmd, {
        shell: process.platform === 'win32' ? 'cmd' : '/bin/sh',
        stdio: 'ignore',
        timeout: 8000,
      });
    } catch { /* fall through to taskkill */ }
  }

  // Also kill the PID directly (belt-and-suspenders).
  if (pid) killPid(pid);

  // Brief wait so Windows can release the shared memory before the next run.
  await new Promise((r) => setTimeout(r, 500));

  // Delete data directory and PID file.
  if (fs.existsSync(dataDir)) {
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
  }
  try { fs.unlinkSync(PID_FILE); } catch {}

  console.log('[E2E teardown] ✓ Embedded Postgres stopped\n');
};
