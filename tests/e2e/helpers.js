// @ts-check
const { createHmac } = require('node:crypto');

const ADMIN_PW = process.env.TEST_ADMIN_PASSWORD || 'e2e-test-secret';
const E2E_PROMPT_SLUG = 'e2e-test-prompt-v1';

// Compute the value the server uses for the sm_admin cookie.
// Matches adminToken() in lib/auth.js.
function adminCookieValue() {
  return createHmac('sha256', ADMIN_PW).update('story-map-admin-v1').digest('hex');
}

// Log in via the API so the browser context receives the real Set-Cookie header.
// Works for both page.request and browserContext.request.
async function loginAdmin(reqOrPage) {
  const req = reqOrPage.request ?? reqOrPage;
  const res = await req.post('/api/admin/login', { data: { password: ADMIN_PW } });
  if (!res.ok()) throw new Error(`Admin login failed (${res.status()}): ${await res.text().catch(() => '')}`);
}

// A story body long enough to pass the 20-character minimum.
const SAMPLE_STORY =
  'I wake up and the sun is already coming through the blinds. ' +
  'Five years have passed and the choice I kept circling is now just the life I live. ' +
  'The office feels familiar in a way it never did before. ' +
  'I pour coffee and think about what I would tell the person I was back then.';

// Step through the write → name stages and submit a story.
// Returns when the page reaches "placing" or "waiting" or "map" stage.
async function submitStory(page, { story = SAMPLE_STORY, headline = 'The steady morning', name = '' } = {}) {
  // Write stage — click the start button if the timer hasn't begun yet
  const startBtn = page.getByRole('button', { name: /Start my \d+ minutes/ });
  if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startBtn.click();
  }
  await page.getByLabel('Your story').fill(story);
  await page.getByRole('button', { name: "I'm done writing" }).click();

  // Name stage
  await page.getByLabel('Scenario headline').fill(headline);
  if (name) await page.locator('#nm').fill(name);
  await page.getByRole('button', { name: 'Place my story on the map' }).click();
}

// Wait for the map stage and return the map SVG locator.
async function waitForMap(page, timeout = 15_000) {
  await page.locator('[data-stage="map"]').waitFor({ timeout });
  return page.locator('[data-stage="map"] .mapwrap svg');
}

// Draw an arrow by clicking in the centre of the map SVG.
async function drawArrow(page) {
  await page.getByRole('button', { name: /Draw where you.d rather be|Redraw my arrow/ }).click();
  const svg = page.locator('[data-stage="map"] .mapwrap svg').first();
  // Click slightly off-centre to land in a valid quadrant
  await svg.click({ position: { x: 400, y: 200 } });
}

module.exports = {
  ADMIN_PW,
  E2E_PROMPT_SLUG,
  adminCookieValue,
  loginAdmin,
  SAMPLE_STORY,
  submitStory,
  waitForMap,
  drawArrow,
};
