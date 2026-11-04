// @ts-check
// Tests the full public card flow:
//   /p/{slug} → write → name → map (dot without refresh) → draw arrow → questions → end
const { test, expect } = require('@playwright/test');
const { E2E_PROMPT_SLUG, submitStory, waitForMap, drawArrow } = require('./helpers');

test.beforeEach(async ({ page }) => {
  // Clear any leftover draft/mine so each test starts fresh
  await page.goto('/');
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sm-'))
      .forEach((k) => localStorage.removeItem(k));
  });
});

test('decision question shows on the prompt page', async ({ page }) => {
  await page.goto(`/p/${E2E_PROMPT_SLUG}`);
  await expect(page.getByText('How do you balance work and life')).toBeVisible({ timeout: 8000 });
});

test('write → name → place: dot appears on the map without a manual refresh', async ({ page }) => {
  await page.goto(`/p/${E2E_PROMPT_SLUG}`);
  // Wait for session to load (write stage — no signals/ask on this session)
  await expect(page.getByRole('button', { name: /Start my \d+ minutes/ })).toBeVisible({ timeout: 8000 });

  await submitStory(page);

  // After MOCK_CLAUDE placement (immediate) the map stage renders after a ~900 ms delay.
  // Verify the dot is in the SVG without any page reload.
  const svg = await waitForMap(page, 15_000);
  const circles = svg.locator('circle');
  await expect(circles.first()).toBeVisible({ timeout: 8000 });
  const count = await circles.count();
  expect(count).toBeGreaterThan(0);
});

test('draw arrow → "Think it through" → questions → end stage', async ({ page }) => {
  await page.goto(`/p/${E2E_PROMPT_SLUG}`);
  await expect(page.getByRole('button', { name: /Start my \d+ minutes/ })).toBeVisible({ timeout: 8000 });

  await submitStory(page, { headline: 'The arrow test future' });

  await waitForMap(page, 15_000);

  // Dot must be placed before arrow controls appear
  await expect(page.getByRole('button', { name: /Draw where you.d rather be/ })).toBeVisible({ timeout: 8000 });

  await drawArrow(page);

  // After saving the arrow, "Think it through →" becomes available
  await expect(page.getByRole('button', { name: 'Think it through' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Think it through' }).click();

  // Questions stage — at least one question visible
  await expect(page.locator('.q')).toBeVisible({ timeout: 8000 });

  // Advance to the last question and click Done
  const nextBtn = page.getByRole('button', { name: 'Next question' });
  while (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(200);
  }
  await page.getByRole('button', { name: 'Done' }).click();

  // End stage
  await expect(page.getByText("A narrative only runs if nothing interrupts it")).toBeVisible({ timeout: 8000 });
});
