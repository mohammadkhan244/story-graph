// @ts-check
// At 375 px: no SVG text element extends past the map container,
// and no two dot labels overlap each other.
const { test, expect } = require('@playwright/test');
const { E2E_PROMPT_SLUG, submitStory, waitForMap } = require('./helpers');

test.describe('Map at 375px viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sm-'))
        .forEach((k) => localStorage.removeItem(k))
    );
  });

  test('no SVG text element extends past the map container', async ({ page }) => {
    await page.goto(`/p/${E2E_PROMPT_SLUG}`);
    await expect(page.getByRole('button', { name: /Start my \d+ minutes/ })).toBeVisible({ timeout: 8000 });
    await submitStory(page);
    await waitForMap(page, 15_000);

    // Allow one render cycle after map appears
    await page.waitForTimeout(400);

    const mapBox = await page.locator('.mapwrap').boundingBox();
    expect(mapBox).not.toBeNull();

    const textEls = await page.locator('.mapwrap svg text').all();
    for (const el of textEls) {
      const box = await el.boundingBox();
      if (!box || box.width === 0) continue;
      // Allow 2px tolerance for sub-pixel rendering
      expect(box.x).toBeGreaterThanOrEqual(mapBox.x - 2);
      expect(box.x + box.width).toBeLessThanOrEqual(mapBox.x + mapBox.width + 2);
    }
  });

  test('no two dot labels overlap at 375px', async ({ page }) => {
    await page.goto(`/p/${E2E_PROMPT_SLUG}`);
    await expect(page.getByRole('button', { name: /Start my \d+ minutes/ })).toBeVisible({ timeout: 8000 });
    await submitStory(page);
    await waitForMap(page, 15_000);

    await page.waitForTimeout(400);

    // On mobile only YOU label shows by default — tap a second dot to get two labels
    const dots = page.locator('.mapwrap svg .dot:not(.you)');
    const dotCount = await dots.count();
    if (dotCount > 0) await dots.first().click();

    await page.waitForTimeout(200);

    const labels = await page.locator('.mapwrap svg text.dlab').all();
    const boxes = [];
    for (const lbl of labels) {
      const box = await lbl.boundingBox();
      if (box && box.width > 1 && box.height > 1) boxes.push(box);
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlaps =
          a.x + a.width > b.x + 2 &&
          b.x + b.width > a.x + 2 &&
          a.y + a.height > b.y + 2 &&
          b.y + b.height > a.y + 2;
        expect(overlaps, `Labels at [${a.x.toFixed(0)},${a.y.toFixed(0)}] and [${b.x.toFixed(0)},${b.y.toFixed(0)}] overlap`).toBe(false);
      }
    }
  });
});
