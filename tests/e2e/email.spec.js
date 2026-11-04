// @ts-check
// In MOCK_CLAUDE=1 mode (and no RESEND_API_KEY in env), the email route logs to console
// and returns {ok:true} rather than actually calling Resend.
// These tests verify: (a) the API accepts the request, (b) the UI shows success.
const { test, expect } = require('@playwright/test');
const { E2E_PROMPT_SLUG, submitStory, waitForMap, drawArrow } = require('./helpers');

// Helper: complete the full flow to the "end" stage and return the page.
async function reachEndStage(page) {
  await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sm-'))
      .forEach((k) => localStorage.removeItem(k))
  );

  await page.goto(`/p/${E2E_PROMPT_SLUG}`);
  await expect(page.getByRole('button', { name: /Start my \d+ minutes/ })).toBeVisible({ timeout: 8000 });

  await submitStory(page, { headline: 'The email test future' });
  await waitForMap(page, 15_000);

  // Dot must be placed
  await expect(page.getByRole('button', { name: /Draw where you.d rather be/ })).toBeVisible({ timeout: 8000 });

  await drawArrow(page);

  await expect(page.getByRole('button', { name: 'Think it through' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Think it through' }).click();

  // Click through all questions to reach the "Done" button
  const nextBtn = page.getByRole('button', { name: 'Next question' });
  while (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(200);
  }
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByText("A narrative only runs if nothing interrupts it")).toBeVisible({ timeout: 8000 });
}

test.describe('Email (MOCK mode)', () => {
  test('email form is present at the end stage for a card-flow story', async ({ page }) => {
    await reachEndStage(page);
    await expect(page.getByText('Email me my story')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#em-email')).toBeVisible();
  });

  test('submitting a valid email returns ok and shows "Sent" message', async ({ page }) => {
    await reachEndStage(page);

    await page.locator('#em-email').fill('e2e-test@example.com');
    await page.getByRole('button', { name: 'Send it to me' }).click();

    // MOCK_CLAUDE=1 + no RESEND_API_KEY → server logs and returns {ok:true}
    // UI transitions to the "sent" state
    await expect(page.getByText('Sent. Check your inbox.')).toBeVisible({ timeout: 10_000 });
  });

  test('API POST /api/stories/{id}/email returns {ok:true} in MOCK mode', async ({ page, request }) => {
    // Complete flow to get mine token
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sm-'))
        .forEach((k) => localStorage.removeItem(k))
    );
    await page.goto(`/p/${E2E_PROMPT_SLUG}`);
    await expect(page.getByRole('button', { name: /Start my \d+ minutes/ })).toBeVisible({ timeout: 8000 });
    await submitStory(page, { headline: 'API email test future' });
    await waitForMap(page, 15_000);

    // Extract story id and token from localStorage
    const mineKey = `sm-mine-prompt-${E2E_PROMPT_SLUG}`;
    const mine = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), mineKey);
    expect(mine).not.toBeNull();

    const res = await request.post(`/api/stories/${mine.story.id}/email`, {
      data: { token: mine.token, email: 'api-test@example.com' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('session story email: API returns ok for a session story', async ({ page, request }) => {
    // Use the custom route to get a visitor session, complete flow, then email
    // POST to /api/custom with non-career text
    const customRes = await request.post('/api/custom', {
      data: { text: 'Should I relocate to another country for work?' },
    });
    expect(customRes.ok()).toBeTruthy();
    const { id: sessionId } = await customRes.json();
    expect(sessionId).toBeTruthy();

    // Navigate to the visitor session and complete the flow
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sm-'))
        .forEach((k) => localStorage.removeItem(k))
    );
    await page.goto(`/s/${sessionId}`);
    await submitStory(page, { headline: 'The relocation future' });
    await waitForMap(page, 15_000);

    // Extract mine from localStorage
    const mineKey = `sm-mine-session-${sessionId}`;
    const mine = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), mineKey);
    expect(mine).not.toBeNull();

    const res = await request.post(`/api/stories/${mine.story.id}/email`, {
      data: { token: mine.token, email: 'session-test@example.com' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
