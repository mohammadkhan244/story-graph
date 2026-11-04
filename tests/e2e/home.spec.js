// @ts-check
const { test, expect } = require('@playwright/test');
const { loginAdmin, E2E_PROMPT_SLUG } = require('./helpers');

test.describe('Home page', () => {
  test('decision cards render after API load', async ({ page }) => {
    await page.goto('/');
    // Cards come from /api/public via useEffect — wait for at least one .pcard button
    await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });
    const count = await page.locator('.pcard').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(4);
  });

  test('"Show me other decisions" cycles the deck', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });

    const cycleBtn = page.getByRole('button', { name: /Show me other decisions/ });
    if (!(await cycleBtn.isVisible())) {
      test.skip(true, 'Only one card set in this DB — cycle button not shown');
    }

    // Record the text of the first card before cycling
    const before = await page.locator('.pcard').first().textContent();
    await cycleBtn.click();

    // Deck re-animates with the key={deal} prop; wait for a fresh render
    await page.waitForTimeout(400);
    const after = await page.locator('.pcard').first().textContent();
    expect(after).not.toBe(before);
  });

  test('no horizontal scroll at 375 px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('.pcard').first()).toBeVisible({ timeout: 10_000 });

    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    // Allow 1 px rounding tolerance
    expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1);
  });

  test('clicking a card navigates to /p/{slug}', async ({ page }) => {
    await page.goto('/');
    // Find the E2E test card seeded in global-setup
    const testCard = page.locator('.pcard').filter({ hasText: 'work and life' }).first();

    // If the E2E card is visible in the current set, click it; otherwise cycle to find it
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await testCard.isVisible()) break;
      const cycleBtn = page.getByRole('button', { name: /Show me other decisions/ });
      if (await cycleBtn.isVisible()) {
        await cycleBtn.click();
        await page.waitForTimeout(300);
      } else {
        break;
      }
    }

    if (await testCard.isVisible()) {
      await testCard.click();
      await page.waitForURL(`**/p/${E2E_PROMPT_SLUG}`, { timeout: 5000 });
    } else {
      // E2E card not surfaced in home deck (may be in a later set); skip
      test.skip(true, 'E2E test card not visible in home deck sets');
    }
  });
});
