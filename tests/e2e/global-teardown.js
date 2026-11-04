// Runs once after all tests: removes everything created by global-setup + test runs.
const { Client } = require('pg');

module.exports = async function globalTeardown() {
  const dbUrl = process.env.TEST_DATABASE_URL;
  if (!dbUrl) return;

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
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
  } finally {
    await client.end();
  }
};
