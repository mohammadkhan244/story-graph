# Story Graph — developer notes for Claude

## Testing policy

**Only run E2E tests when explicitly asked.** When asked, run only the spec file(s) related to the
change — not the whole suite. Reply with only "X passed, Y failed" plus a one-line reason per
failure. Never paste full test output.

**Never run tests against production or Neon.** E2E tests use the embedded Postgres started by
`global-setup.js` — no manual database setup is required. The test runner refuses to start if
`TEST_DATABASE_URL` contains `neon.tech` or matches `DATABASE_URL`.

When tests fail: read only the first failing test's error message. Make at most 2 fix attempts,
then stop and report what's failing rather than continuing to guess.

### Running the tests

```
npm run test:e2e                                        # full suite
npm run test:quick                                      # home + card-flow only
npx playwright test tests/e2e/card-flow.spec.js        # single spec
```

`global-setup.js` automatically starts an embedded Postgres on port 5544, applies the schema, and
seeds fixtures. `global-teardown.js` stops it and cleans up the data directory.

The first run builds the app (`npm run build`) and starts it on port 3000 with:
- `MOCK_CLAUDE=1` — all Anthropic calls return deterministic mocks; no real API key needed
- `ADMIN_PASSWORD` — set to the value of `TEST_ADMIN_PASSWORD` env var (default `e2e-test-secret`)
- `DATABASE_URL` — set to the embedded Postgres URL (`postgresql://postgres:password@localhost:5544/story_map_test`)

Subsequent runs reuse the running server (unless `CI=1`).

### Pre-requisites

1. Install Playwright browsers once: `npx playwright install chromium`
2. Stop any dev server on port 3000 before running (or set `BASE_URL=http://localhost:3001` and
   update `webServer.env.PORT=3001` in `playwright.config.js`).

### Test files

| File | What it covers |
|------|----------------|
| `tests/e2e/home.spec.js` | Cards render, deck cycles, no horizontal scroll at 375 px |
| `tests/e2e/card-flow.spec.js` | Full prompt flow: write → name → place → dot without refresh → arrow → questions → end |
| `tests/e2e/session-flow.spec.js` | Live session: closed→write transition, timer banners (start/pause/resume/restart), submission, dot on presenter, arrow live |
| `tests/e2e/custom-session.spec.js` | "My decision isn't here" → visitor session, card match, "No, mine is different" |
| `tests/e2e/email.spec.js` | Email submit in MOCK mode returns ok; UI shows "Sent" |
| `tests/e2e/test-stories.spec.js` | Test stories hidden on public map; shown on presenter after toggle |
| `tests/e2e/map-mobile.spec.js` | At 375px: no SVG text past container bounds; no two dot labels overlap |

## Key architecture notes

- All Claude calls are gated by `process.env.MOCK_CLAUDE === '1'` in `lib/claude.js`. Mock mode:
  - `matchCard` matches `/career|job|role/i` → returns `{slug:'your-career', question:...}`; else `{slug:null}`
  - `generateAxesForDecision` returns two hard-coded axes
  - `placeOne` returns deterministic coordinates (hash-based)
  - `askQuestions` returns five fixed questions
- Database schema: `sessions`, `stories`, `emails`. All server-side queries go through `lib/db.js`.
- Admin auth uses HMAC cookie `sm_admin` (value = `createHmac('sha256', ADMIN_PASSWORD).update('story-map-admin-v1').digest('hex')`).
- Test stories: set `sm_test=1` cookie while admin-logged-in to mark stories `is_test=true`. They
  are filtered out of all public map API responses but visible in the presenter with the toggle.
- Visitor sessions: created by `POST /api/custom` when no card matches. `kind='visitor'`, `hidden=true`.
  Appear in the Admin "Missing cards" list; can be promoted to `kind='open'` cards.
