// @ts-check
// Tests the "My decision isn't here" flow:
//   visitor enters custom decision → POST /api/custom → visitor session created
//   → redirect to /s/{id} → title/scene shows on every stage
const { test, expect } = require('@playwright/test');
const { submitStory, waitForMap } = require('./helpers');

// A decision that won't match the MOCK matchCard (which only matches career|job|role)
const CUSTOM_DECISION = 'Should I move to a bigger apartment in the city?';

test.describe('Custom (visitor) session', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sm-'))
        .forEach((k) => localStorage.removeItem(k))
    );
  });

  test('non-matching decision creates a visitor session and redirects to /s/{id}', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });

    // Open the custom form
    await page.getByRole('button', { name: "My decision isn't here" }).click();
    await expect(page.locator('#custom-text')).toBeVisible();

    await page.locator('#custom-text').fill(CUSTOM_DECISION);
    await page.getByRole('button', { name: /Continue/ }).click();

    // MOCK_CLAUDE returns no match for this text → generateAxesForDecision is called
    // → session inserted → {id} returned → redirect to /s/{id}
    await page.waitForURL('**/s/**', { timeout: 15_000 });
    expect(page.url()).toMatch(/\/s\/[a-z0-9]+$/);
  });

  test('career-related text matches a card and shows the match UI', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: "My decision isn't here" }).click();
    await page.locator('#custom-text').fill('Should I change my career and try a new job?');
    await page.getByRole('button', { name: /Continue/ }).click();

    // MOCK matchCard returns {slug:'your-career', question:...} for career|job|role
    await expect(page.getByText('This sounds like:')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Yes, use it' })).toBeVisible();
    await expect(page.getByRole('button', { name: "No, mine is different" })).toBeVisible();
  });

  test('"No, mine is different" creates a session even when a match was found', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: "My decision isn't here" }).click();
    await page.locator('#custom-text').fill('I need to decide about my job situation right now');
    await page.getByRole('button', { name: /Continue/ }).click();

    // Match found → show card suggestion
    await expect(page.getByText('This sounds like:')).toBeVisible({ timeout: 10_000 });

    // User declines → force=true re-POST → new session
    await page.getByRole('button', { name: "No, mine is different" }).click();
    await page.waitForURL('**/s/**', { timeout: 15_000 });
  });

  test('custom session title / scene shows on write and map stages', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: "My decision isn't here" }).click();
    await page.locator('#custom-text').fill(CUSTOM_DECISION);
    await page.getByRole('button', { name: /Continue/ }).click();

    await page.waitForURL('**/s/**', { timeout: 15_000 });

    // Write stage — the scene text embeds the user's decision
    // scene = "It's five years from now. {text} has played out."
    await expect(page.locator('.scene')).toContainText('five years from now', { timeout: 8000 });
    // The decision text itself should appear in the scene
    await expect(page.locator('.scene')).toContainText('bigger apartment', { timeout: 5000 });

    // Go through the flow
    await submitStory(page, { headline: 'The bigger space' });

    // Map stage — visitor note confirms "your own map"
    await waitForMap(page, 15_000);
    await expect(page.getByText('Your own map')).toBeVisible({ timeout: 8000 });
  });
});
