const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOTS_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
  console.log('saved', name);
}

(async () => {
  const browser = await chromium.launch();
  const BASE = 'http://localhost:3002';

  async function screenshotSet(setIndex, setName, vp) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForSelector('button.pcard', { timeout: 10000 });
    for (let i = 0; i < setIndex; i++) {
      await page.locator('button.textlink').click();
      await page.waitForTimeout(700);
    }
    await shot(page, `${setIndex}-${setName}-${vp.width}`);
    await ctx.close();
  }

  const sets = ['at-work', 'your-future', 'your-team', 'your-field'];
  const viewports = [{ width: 1280, height: 900 }, { width: 375, height: 812 }];

  for (const vp of viewports) {
    for (let i = 0; i < sets.length; i++) {
      await screenshotSet(i, sets[i], vp);
    }
  }

  await browser.close();
  console.log('All done');
})().catch(e => { console.error(e.message); process.exit(1); });
