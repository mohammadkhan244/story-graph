# Story Graph — developer notes for Claude

## Testing policy

After every change, run `npm run test:e2e` and fix all failures before reporting the work as done.
Include the pass/fail summary (e.g. "18 passed, 0 failed") in your reply.
**Never run tests against production.** The command refuses to start unless `TEST_DATABASE_URL` is
set to a local/staging database that is explicitly not the production connection string.

### Running the tests

```
TEST_DATABASE_URL=postgresql://localhost/story_map_test npm run test:e2e
```

The first run builds the app (`npm run build`) and starts it on port 3000 with:
- `MOCK_CLAUDE=1` — all Anthropic calls return deterministic mocks; no real API key needed
- `ADMIN_PASSWORD` — set to the value of `TEST_ADMIN_PASSWORD` env var (default `e2e-test-secret`)
- `DATABASE_URL` — set to `TEST_DATABASE_URL`

Subsequent runs reuse the running server (unless `CI=1`).

### Pre-requisites

1. The test database must have the same schema as production. Run migrations before the first run.
2. Install Playwright browsers once: `npx playwright install chromium`
3. Stop any dev server on port 3000 before running (or set `BASE_URL=http://localhost:3001` and
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
