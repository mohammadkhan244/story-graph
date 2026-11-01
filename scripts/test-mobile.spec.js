/**
 * Mobile viewport smoke tests — 375 px wide, no horizontal scroll.
 *
 * Install first (one-time):
 *   npx playwright install --with-deps chromium
 *
 * Run:
 *   npx playwright test scripts/test-mobile.spec.js --project=chromium
 *
 * Requires the dev server running on http://localhost:3000
 * and at least one published decision prompt (slug in BASE_URL below).
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
// Change to a real slug if you have one, e.g. '/p/keep-circling'
const PROMPT_PATH = '/';

const VIEWPORT = { width: 375, height: 812 };

async function noHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontal scroll detected').toBe(0);
}

async function screenshot(page, name) {
  await page.screenshot({ path: `scripts/screenshots/${name}.png`, fullPage: false });
}

test.use({ viewport: VIEWPORT });

test.beforeAll(async ({ browser }) => {
  const { mkdir } = require('fs/promises');
  await mkdir(new URL('screenshots', import.meta.url).pathname, { recursive: true }).catch(() => {});
});

test('home — no horizontal scroll', async ({ page }) => {
  await page.goto(BASE_URL + PROMPT_PATH);
  await page.waitForLoadState('networkidle');
  await screenshot(page, '00-home');
  await noHorizontalScroll(page);
});

test('scene stage — no horizontal scroll', async ({ page }) => {
  await page.goto(BASE_URL + PROMPT_PATH);
  await page.waitForLoadState('networkidle');
  // Click first card to enter the flow
  const firstCard = page.locator('button.pcard').first();
  await firstCard.click();
  await page.waitForURL(/\/p\//);
  await page.waitForLoadState('networkidle');
  await screenshot(page, '01-scene');
  await noHorizontalScroll(page);
});

test('write stage — no horizontal scroll', async ({ page }) => {
  await page.goto(BASE_URL + PROMPT_PATH);
  await page.waitForLoadState('networkidle');
  const firstCard = page.locator('button.pcard').first();
  await firstCard.click();
  await page.waitForURL(/\/p\//);
  // Skip scene (click Write button or start)
  const startBtn = page.locator('button.big.primary').first();
  await startBtn.click();
  await screenshot(page, '02-write');
  await noHorizontalScroll(page);
});

test('name stage — no horizontal scroll', async ({ page }) => {
  await page.goto(BASE_URL + PROMPT_PATH);
  await page.waitForLoadState('networkidle');
  const firstCard = page.locator('button.pcard').first();
  await firstCard.click();
  await page.waitForURL(/\/p\//);
  const startBtn = page.locator('button.big.primary').first();
  await startBtn.click();
  await page.locator('textarea.page').fill('I wake up and the phone is full of messages. The project launched last night and the numbers are worse than expected. I sit at the kitchen table trying to decide whether to tell the team.');
  await page.locator('button:has-text("done writing")').click();
  await screenshot(page, '03-name');
  await noHorizontalScroll(page);
});

test('brandbar decision link is short on mobile', async ({ page }) => {
  await page.goto(BASE_URL + PROMPT_PATH);
  const firstCard = page.locator('button.pcard').first();
  await firstCard.click();
  await page.waitForURL(/\/p\//);
  await page.waitForLoadState('networkidle');
  // The full text span should be hidden at 375px
  const fullSpan = page.locator('.decision-full');
  await expect(fullSpan).toBeHidden();
  const shortSpan = page.locator('.decision-short');
  await expect(shortSpan).toBeVisible();
  await noHorizontalScroll(page);
});

test('inputs have font-size ≥ 16px (iOS zoom prevention)', async ({ page }) => {
  await page.goto(BASE_URL + PROMPT_PATH);
  const firstCard = page.locator('button.pcard').first();
  await firstCard.click();
  await page.waitForURL(/\/p\//);
  const startBtn = page.locator('button.big.primary').first();
  await startBtn.click();

  const fontSize = await page.locator('textarea.page').evaluate((el) =>
    parseFloat(window.getComputedStyle(el).fontSize)
  );
  expect(fontSize, 'textarea font-size should be ≥ 16px').toBeGreaterThanOrEqual(16);
});
