// @ts-check
// Tests the live timed-session flow end-to-end:
//   presenter starts timer → participant transitions within 3 s (polls every 2 s)
//   pause / resume / restart banners → participant submits → dot on presenter map
//   arrow saves and is visible live on presenter
const { test, expect } = require('@playwright/test');
const { ADMIN_PW, submitStory, drawArrow } = require('./helpers');

const TEST_AXES = {
  x: { name: 'Risk', low: 'Safe', high: 'Bold', lowDesc: 'The safe path', highDesc: 'The bold leap' },
  y: { name: 'Speed', low: 'Slow', high: 'Fast', lowDesc: 'Taking your time', highDesc: 'Moving quickly' },
};

// All session-flow tests share one live session created in beforeAll.
// They run serially so each test can rely on the state left by the previous one.
test.describe.serial('Session flow', () => {
  let sessionId;
  /** @type {import('@playwright/test').BrowserContext} */
  let adminCtx;
  /** @type {import('@playwright/test').BrowserContext} */
  let participantCtx;

  test.beforeAll(async ({ browser }) => {
    adminCtx = await browser.newContext();
    await adminCtx.request.post('/api/admin/login', { data: { password: ADMIN_PW } });

    // Create a fresh session for this test run
    const res = await adminCtx.request.post('/api/admin/sessions', {
      data: {
        title: 'E2E: Session Flow Test',
        prompt: 'You are deciding whether to change your career path.',
        minutes: 10,
      },
    });
    expect(res.ok()).toBeTruthy();
    const { id } = await res.json();
    sessionId = id;

    // Set axes so placement works
    await adminCtx.request.patch(`/api/admin/sessions/${sessionId}`, {
      data: { axes: TEST_AXES },
    });

    participantCtx = await browser.newContext();
  });

  test.afterAll(async () => {
    await adminCtx?.close();
    await participantCtx?.close();
  });

  // ── 1. Participant sees "closed" before the session opens ──────────────────
  test('participant sees closed stage before session is opened', async () => {
    const page = await participantCtx.newPage();
    await page.goto(`/s/${sessionId}`);
    await expect(page.getByText("hasn't started yet")).toBeVisible({ timeout: 8000 });
    await page.close();
  });

  // ── 2. Admin opens → participant transitions to write within 5 s ───────────
  test('participant transitions to write stage within 5 s after admin opens', async () => {
    const page = await participantCtx.newPage();
    await page.goto(`/s/${sessionId}`);
    await expect(page.getByText("hasn't started yet")).toBeVisible({ timeout: 5000 });

    // Admin opens (no timer yet — just sets status=open)
    await adminCtx.request.patch(`/api/admin/sessions/${sessionId}`, { data: { open: true } });

    // Participant polls every 2 s — should reach the write stage
    await expect(page.getByRole('button', { name: /Start my \d+ minutes/ })).toBeVisible({ timeout: 7000 });
    await page.close();
  });

  // ── 3. Timer banners: start / pause / resume / restart ────────────────────
  test('timer banners appear within 5 s of each admin action', async () => {
    const page = await participantCtx.newPage();
    await page.goto(`/s/${sessionId}`);

    // Session is now open — participant lands directly in write stage
    await expect(page.getByRole('button', { name: /Start my \d+ minutes/ })).toBeVisible({ timeout: 7000 });

    // Allow first poll cycle to initialise lastEndsAt/lastPausedAt
    await page.waitForTimeout(2500);

    const banner = page.locator('[role="status"]');

    // Start timer
    await adminCtx.request.patch(`/api/admin/sessions/${sessionId}`, { data: { start: true, minutes: 10 } });
    await expect(banner).toContainText('Timer started', { timeout: 6000 });

    // Pause
    await adminCtx.request.patch(`/api/admin/sessions/${sessionId}`, { data: { pause: true } });
    await expect(banner).toContainText('paused', { timeout: 6000 });

    // Resume
    await adminCtx.request.patch(`/api/admin/sessions/${sessionId}`, { data: { resume: true } });
    await expect(banner).toContainText('resumed', { timeout: 6000 });

    // Restart
    await adminCtx.request.patch(`/api/admin/sessions/${sessionId}`, { data: { restart: true } });
    await expect(banner).toContainText('restarted', { timeout: 6000 });

    await page.close();
  });

  // ── 4. Participant submits → dot appears on presenter map ─────────────────
  test('participant submits story and dot appears on presenter map', async ({ browser }) => {
    // Fresh participant page — navigate to site origin first so localStorage.clear reaches it
    const page = await participantCtx.newPage();
    await page.goto('/');
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sm-'))
        .forEach((k) => localStorage.removeItem(k))
    );
    await page.goto(`/s/${sessionId}`);

    await submitStory(page, {
      story:
        'I wake up and the morning is familiar. Five years on and the decision I kept circling ' +
        'has settled into a life I recognise. I make coffee. The light through the kitchen window ' +
        'is the same light. Only I am different now.',
      headline: 'The steady light',
      name: 'E2E Participant',
    });

    // Session not published → participant reaches "waiting" stage
    await expect(page.getByText('Your story is in')).toBeVisible({ timeout: 20_000 });

    // Admin opens the presenter page
    const presenterPage = await adminCtx.newPage();
    await presenterPage.goto(`/present/${sessionId}`);
    // Presenter loads its own auth check — wait for the map area
    await expect(presenterPage.locator('.bigcount, .mapwrap')).toBeVisible({ timeout: 10_000 });

    // Admin publishes so participant can see the map and presenter reveals
    await adminCtx.request.patch(`/api/admin/sessions/${sessionId}`, { data: { published: true } });

    // Click "Reveal the map" on the presenter
    const revealBtn = presenterPage.getByRole('button', { name: 'Reveal the map' });
    await expect(revealBtn).toBeVisible({ timeout: 5000 });
    await revealBtn.click();

    // Allow one presenter poll cycle (3 s) for the new dot to arrive
    await presenterPage.waitForTimeout(4000);

    // Dot should be visible as an SVG circle
    const circles = presenterPage.locator('.mapwrap svg circle');
    expect(await circles.count()).toBeGreaterThan(0);

    await page.close();
    await presenterPage.close();
  });

  // ── 5. Arrow saves and is visible live on the presenter ───────────────────
  test('arrow drawn by participant appears on presenter map without refresh', async () => {
    // The session is now published (from previous test).
    // Participant is in "waiting" stage — after publishing they should poll to "map".
    const page = await participantCtx.newPage();
    await page.goto(`/s/${sessionId}`);

    // Retrieve saved mine token from localStorage if present; otherwise resubmit.
    // In practice, the previous test's story token is in localStorage.
    // We just need to get to the map stage.
    const mineKey = `sm-mine-session-${sessionId}`;
    const hasMine = await page.evaluate(
      (k) => !!localStorage.getItem(k),
      mineKey
    );

    if (!hasMine) {
      // Need a fresh submission — submit another story
      await submitStory(page, {
        story:
          'The year is five years from now. I took the leap I had been avoiding. ' +
          'The morning commute is different now — shorter, louder, more alive. ' +
          'I think about the version of me that chose to stay and wonder if they are happy too.',
        headline: 'The other morning',
      });
    }

    // Session is published → participant polls to map stage
    await expect(page.locator('[data-stage="map"]')).toBeVisible({ timeout: 15_000 });

    // Count SVG lines before drawing (there might be none)
    const presenterPage = await adminCtx.newPage();
    await presenterPage.goto(`/present/${sessionId}`);
    await expect(presenterPage.locator('.mapwrap svg')).toBeVisible({ timeout: 10_000 });
    // Ensure map is revealed (may already be from previous test)
    const revealBtn = presenterPage.getByRole('button', { name: 'Reveal the map' });
    if (await revealBtn.isVisible({ timeout: 1000 }).catch(() => false)) await revealBtn.click();

    // Draw the arrow on the participant side
    await drawArrow(page);

    // The "Redraw my arrow" or "Think it through →" button confirms the arrow saved
    await expect(
      page.getByRole('button', { name: /Redraw my arrow|Think it through/ })
    ).toBeVisible({ timeout: 8000 });

    // Allow one presenter poll cycle (3 s) for the arrow to arrive
    await presenterPage.waitForTimeout(4000);

    // Presenter SVG should now include at least one <line> (arrow shaft)
    const lines = presenterPage.locator('.mapwrap svg line, .mapwrap svg polyline, .mapwrap svg path[marker-end]');
    expect(await lines.count()).toBeGreaterThan(0);

    await page.close();
    await presenterPage.close();
  });
});
