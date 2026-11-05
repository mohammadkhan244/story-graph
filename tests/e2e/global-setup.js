// @ts-check
// Runs once before all tests.
// 1. Gracefully stops any leftover embedded-postgres from a previous run.
// 2. Starts embedded Postgres on port 5544 (no system install needed).
// 3. Applies the full schema from lib/db.js.
// 4. Seeds the E2E fixture prompt used by card-flow / email / test-stories.
//
// Falls back to system postgres (apt-get) on Linux if embedded-postgres fails.
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { execSync } = require('child_process');
const { Client } = require('pg');
const {
  EMBEDDED_PORT, EMBEDDED_USER, EMBEDDED_PASS, EMBEDDED_DB,
  EMBEDDED_DIR, EMBEDDED_URL,
} = require('./db-config');

const E2E_PROMPT_SLUG = 'e2e-test-prompt-v1';
const PID_FILE = path.join(os.tmpdir(), 'pg-e2e-pid.json');

function newId(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Extract the SCHEMA string from lib/db.js at runtime — never duplicated here.
function extractSchema() {
  const src = fs.readFileSync(path.join(__dirname, '../../lib/db.js'), 'utf8');
  const m = src.match(/const SCHEMA = `([\s\S]*?)`;/);
  if (!m) throw new Error('[E2E setup] Could not extract SCHEMA from lib/db.js');
  return m[1];
}

// Return the path to the pg_ctl binary bundled with embedded-postgres.
function getPgCtlPath() {
  if (process.platform === 'win32') {
    return path.join(
      __dirname,
      '../../node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'
    );
  }
  // Linux / macOS: use the binary next to the EmbeddedPostgres package.
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
  } catch { /* already dead */ }
}

function killOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr ":${port} "`, { shell: 'cmd', encoding: 'utf8' });
      const pids = new Set(
        out.trim().split('\n')
          .map((l) => l.trim().split(/\s+/).pop())
          .filter((p) => p && p !== '0')
      );
      for (const pid of pids) {
        try { execSync(`taskkill /F /PID ${pid} /T`, { shell: 'cmd', stdio: 'ignore' }); } catch {}
      }
    } else {
      execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { shell: '/bin/sh', stdio: 'ignore' });
    }
  } catch { /* not in use */ }
}

// Stop any postgres left from a previous run, then wait for Windows to release shared memory.
async function cleanupPreviousRun() {
  const pgCtl = getPgCtlPath();

  // 1. Graceful pg_ctl stop against the known data directory (releases shared memory cleanly).
  if (pgCtl && fs.existsSync(pgCtl) && fs.existsSync(EMBEDDED_DIR)) {
    try {
      const cmd = process.platform === 'win32'
        ? `"${pgCtl}" stop -D "${EMBEDDED_DIR}" -m immediate`
        : `"${pgCtl}" stop -D "${EMBEDDED_DIR}" -m immediate`;
      execSync(cmd, { shell: process.platform === 'win32' ? 'cmd' : '/bin/sh', stdio: 'ignore', timeout: 6000 });
      console.log('[E2E setup] pg_ctl stop sent');
    } catch { /* data dir might have been deleted already */ }
  }

  // 2. Kill by saved PID as well.
  if (fs.existsSync(PID_FILE)) {
    try {
      const { pid } = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
      if (pid) killPid(pid);
    } catch {}
    try { fs.unlinkSync(PID_FILE); } catch {}
  }

  // 3. Kill anything still on the port as a final safety net.
  killOnPort(EMBEDDED_PORT);

  // 4. Wait for Windows to release the shared memory segment.
  //    taskkill is instantaneous but shared memory release on Windows takes ~1–2 s.
  await new Promise((r) => setTimeout(r, 2000));
}

async function startEmbeddedPostgres() {
  if (fs.existsSync(EMBEDDED_DIR)) {
    fs.rmSync(EMBEDDED_DIR, { recursive: true, force: true });
  }

  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pg = new EmbeddedPostgres({
    databaseDir: EMBEDDED_DIR,
    user: EMBEDDED_USER,
    password: EMBEDDED_PASS,
    port: EMBEDDED_PORT,
    persistent: true, // we manage deletion ourselves in teardown
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(EMBEDDED_DB);

  // Write PID to file so global-teardown can stop it reliably across process boundaries.
  const pid = pg.process?.pid;
  fs.writeFileSync(PID_FILE, JSON.stringify({ pid, dir: EMBEDDED_DIR }), 'utf8');

  return pg;
}

async function startSystemPostgresFallback() {
  if (process.platform === 'win32') {
    throw new Error('No system-postgres fallback available on Windows.');
  }
  const { spawn } = require('child_process');

  try { execSync('apt-get install -y postgresql', { stdio: 'inherit' }); } catch {}

  const pgBin = execSync(
    'pg_config --bindir 2>/dev/null || dirname $(which initdb)',
    { shell: '/bin/sh', encoding: 'utf8' }
  ).trim();
  const initdbBin   = path.join(pgBin, 'initdb');
  const postgresBin = path.join(pgBin, 'postgres');

  if (fs.existsSync(EMBEDDED_DIR)) {
    fs.rmSync(EMBEDDED_DIR, { recursive: true, force: true });
  }
  const pwFile = path.join(os.tmpdir(), 'pg-fallback-pw');
  fs.writeFileSync(pwFile, EMBEDDED_PASS + '\n');
  execSync(
    `${initdbBin} --pgdata=${EMBEDDED_DIR} --auth=password ` +
    `--username=${EMBEDDED_USER} --pwfile=${pwFile}`,
    { stdio: 'inherit' }
  );
  fs.unlinkSync(pwFile);

  const child = spawn(postgresBin, ['-D', EMBEDDED_DIR, '-p', String(EMBEDDED_PORT)], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const c = new Client({
        connectionString:
          `postgresql://${EMBEDDED_USER}:${EMBEDDED_PASS}@localhost:${EMBEDDED_PORT}/postgres`,
      });
      await c.connect();
      await c.end();
      break;
    } catch {}
  }

  execSync(
    `${pgBin}/createdb -p ${EMBEDDED_PORT} -U ${EMBEDDED_USER} ${EMBEDDED_DB}`,
    { env: { ...process.env, PGPASSWORD: EMBEDDED_PASS }, stdio: 'inherit' }
  );

  fs.writeFileSync(PID_FILE, JSON.stringify({ pid: child.pid, dir: EMBEDDED_DIR }), 'utf8');
}

module.exports = async function globalSetup() {
  const dbUrl = process.env.TEST_DATABASE_URL || EMBEDDED_URL;
  const useEmbedded = dbUrl === EMBEDDED_URL;

  if (useEmbedded) {
    await cleanupPreviousRun();

    try {
      await startEmbeddedPostgres();
      process.env.TEST_DATABASE_URL = EMBEDDED_URL;
      console.log(`\n[E2E setup] ✓ Embedded Postgres started on port ${EMBEDDED_PORT}\n`);
    } catch (embErr) {
      console.warn(`\n[E2E setup] embedded-postgres failed: ${embErr.message}`);
      console.warn('[E2E setup] Trying system postgres fallback...\n');
      try {
        await startSystemPostgresFallback();
        process.env.TEST_DATABASE_URL = EMBEDDED_URL;
        console.log(`\n[E2E setup] ✓ System Postgres started on port ${EMBEDDED_PORT}\n`);
      } catch (sysErr) {
        throw new Error(
          `[E2E setup] Both embedded and system Postgres failed.\n` +
          `  embedded-postgres: ${embErr.message}\n` +
          `  system fallback:   ${sysErr.message}`
        );
      }
    }
  }

  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();

  try {
    await client.query(extractSchema());

    await client.query(
      `DELETE FROM stories WHERE session_id IN (SELECT id FROM sessions WHERE slug = $1)`,
      [E2E_PROMPT_SLUG]
    );
    await client.query(`DELETE FROM sessions WHERE slug = $1`, [E2E_PROMPT_SLUG]);
    await client.query(
      `DELETE FROM stories WHERE session_id IN (SELECT id FROM sessions WHERE title LIKE 'E2E:%')`
    );
    await client.query(`DELETE FROM sessions WHERE title LIKE 'E2E:%'`);

    const id = newId(8);
    const axes = JSON.stringify({
      x: {
        name: 'Risk',
        low: 'Safe',
        high: 'Bold',
        lowDesc: 'Staying within what is known',
        highDesc: 'Stepping beyond the familiar',
      },
      y: {
        name: 'Control',
        low: 'Shared',
        high: 'Owned',
        lowDesc: 'Decisions made with others',
        highDesc: 'Decisions made alone',
      },
    });

    await client.query(
      `INSERT INTO sessions
         (id, title, prompt, signals, minutes, status, kind, slug, axes, hidden, big_question)
       VALUES ($1, $2, $3, '[]', 10, 'open', 'open', $4, $5::jsonb, false, $6)`,
      [
        id,
        'E2E: Work-Life Balance',
        'You are deciding how to balance your work and life outside of it.',
        E2E_PROMPT_SLUG,
        axes,
        'How do you balance work and life?',
      ]
    );

    console.log(`\n[E2E setup] ✓ /p/${E2E_PROMPT_SLUG} ready (id=${id})\n`);
  } finally {
    await client.end();
  }
};
