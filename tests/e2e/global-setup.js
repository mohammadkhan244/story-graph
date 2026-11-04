// Runs once before all tests: seeds the test DB with the fixtures tests depend on.
// Requires TEST_DATABASE_URL to be set (checked in playwright.config.js).
const { Client } = require('pg');

const E2E_PROMPT_SLUG = 'e2e-test-prompt-v1';

function newId(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = async function globalSetup() {
  const dbUrl = process.env.TEST_DATABASE_URL;
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Confirm schema exists
    const { rows } = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='sessions') AS ok"
    );
    if (!rows[0].ok) {
      throw new Error(
        'sessions table not found in TEST_DATABASE_URL.\n' +
        'Run the application migrations on your test database first.'
      );
    }

    // Wipe any stale E2E data from previous runs
    await client.query(
      `DELETE FROM stories WHERE session_id IN (SELECT id FROM sessions WHERE slug = $1)`,
      [E2E_PROMPT_SLUG]
    );
    await client.query(`DELETE FROM sessions WHERE slug = $1`, [E2E_PROMPT_SLUG]);
    await client.query(
      `DELETE FROM stories WHERE session_id IN (SELECT id FROM sessions WHERE title LIKE 'E2E:%')`
    );
    await client.query(`DELETE FROM sessions WHERE title LIKE 'E2E:%'`);

    // Seed a known open prompt with axes so card-flow, email, and test-stories tests can use it
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
