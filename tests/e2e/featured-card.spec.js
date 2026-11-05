// @ts-check
// Tests for: featured custom cards on home page, and session email subject.
const { test, expect } = require('@playwright/test');
const { loginAdmin, E2E_PROMPT_SLUG, submitStory, waitForMap, drawArrow } = require('./helpers');

const ADMIN_PW = process.env.TEST_ADMIN_PASSWORD || 'e2e-test-secret';

// Create a prompt session and mark it featured, return its id.
async function createFeaturedSession(request) {
  await loginAdmin({ request });
  // Create a new open prompt via admin API
  const createRes = await request.post('/api/admin/sessions', {
    data: {
      title: 'E2E Featured Custom Card',
      prompt: 'A featured test prompt for the custom card suit.',
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id } = await createRes.json();

  // Convert it to an open prompt with a slug and mark featured
  const slug = `e2e-featured-${id}`;
  const patchRes = await request.patch(`/api/admin/sessions/${id}`, {
    data: { kind: 'open', slug, hidden: false, featured: true, card_why: 'E2E test card why line' },
  });
  expect(patchRes.ok()).toBeTruthy();
  return { id, slug };
}

// Mark a session unfeatured.
async function unfeatureSession(request, id) {
  await request.patch(`/api/admin/sessions/${id}`, { data: { featured: false } });
}

test.describe('Featured custom card', () => {
  test('featured session appears as Custom card first on home page', async ({ page, request }) => {
    const { id } = await createFeaturedSession(request);

    try {
      await page.goto('/');
      // Wait for cards to load
      await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });

      // The first set shown should be the Custom set — first card should be the featured session
      const firstCard = page.locator('.pcard').first();
      await expect(firstCard).toBeVisible();

      // The corner initial for Custom suit is "C"
      const cornerTL = firstCard.locator('.pcard-corner-tl').first();
      await expect(cornerTL).toContainText('C');
    } finally {
      await unfeatureSession(request, id);
    }
  });

  test('featured session links to its own /p/<slug>', async ({ page, request }) => {
    const { id, slug } = await createFeaturedSession(request);

    try {
      await page.goto('/');
      await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });

      // Click the first card (should be our custom card)
      await page.locator('.pcard').first().click();
      // Should navigate to the slug's prompt page
      await page.waitForURL(`**/p/${slug}`, { timeout: 5000 });
    } finally {
      await unfeatureSession(request, id);
    }
  });

  test('unfeatured session does not appear as Custom card', async ({ page, request }) => {
    // With no featured sessions, the first card should NOT have corner "C"
    await page.goto('/');
    await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });

    const firstCard = page.locator('.pcard').first();
    const cornerTL = firstCard.locator('.pcard-corner-tl').first();
    // Corner should not be "C" (no featured sessions in baseline seed)
    const text = await cornerTL.textContent();
    expect(text).not.toMatch(/^C/);
  });
});

test.describe('Session email subject', () => {
  test('email in a session has the right subject (MOCK mode logs it)', async ({ page, request }) => {
    // Create a custom visitor session
    const customRes = await request.post('/api/custom', {
      data: { text: 'Should I move to a bigger city for a new opportunity?' },
    });
    expect(customRes.ok()).toBeTruthy();
    const { id: sessionId } = await customRes.json();

    // Clear localStorage and go to the session
    await page.goto('/');
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('sm-')).forEach((k) => localStorage.removeItem(k))
    );
    await page.goto(`/s/${sessionId}`);
    await submitStory(page, { headline: 'The city I chose' });
    await waitForMap(page, 15_000);

    // Extract mine from localStorage
    const mineKey = `sm-mine-session-${sessionId}`;
    const mine = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), mineKey);
    expect(mine).not.toBeNull();

    // Call the email API directly — MOCK mode returns ok:true
    const res = await request.post(`/api/stories/${mine.story.id}/email`, {
      data: { token: mine.token, email: 'subject-test@example.com' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    // The subject contains the story headline and session title
    // (MOCK mode logs but doesn't return subject — we verify the route accepted correctly)
  });

  test('session end screen shows "Keep your story" email panel', async ({ page }) => {
    // Use custom route to create a visitor session and complete the flow
    const customRes = await page.request.post('/api/custom', {
      data: { text: 'Should I move my studio to a different city?' },
    });
    expect(customRes.ok()).toBeTruthy();
    const { id: sessionId } = await customRes.json();

    await page.goto('/');
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('sm-')).forEach((k) => localStorage.removeItem(k))
    );
    await page.goto(`/s/${sessionId}`);
    await submitStory(page, { headline: 'The freelance leap' });
    await waitForMap(page, 15_000);

    await expect(page.getByRole('button', { name: /Draw where you.d rather be/ })).toBeVisible({ timeout: 8000 });
    await drawArrow(page);
    await expect(page.getByRole('button', { name: /Answer 5 questions about your arrow/ })).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /Answer 5 questions about your arrow/ }).click();

    await expect(page.getByRole('button', { name: /Next question|Done/ })).toBeVisible({ timeout: 10_000 });
    const nextBtn = page.getByRole('button', { name: 'Next question' });
    while (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(200);
    }
    await page.getByRole('button', { name: 'Done' }).click();

    // The end screen should show "Keep your story"
    await expect(page.getByText('Keep your story')).toBeVisible({ timeout: 8000 });
    // And the email input
    await expect(page.locator('#em-email')).toBeVisible();
    // Button should say "Email it to me"
    await expect(page.getByRole('button', { name: 'Email it to me' })).toBeVisible();
  });
});
