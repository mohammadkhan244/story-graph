// @ts-check
// Tests that is_test stories:
//   - are hidden on public maps (not returned by promptMap / sessionMap)
//   - are shown on the presenter map only after the "Include my test stories" toggle is on
const { test, expect } = require('@playwright/test');
const { ADMIN_PW, SAMPLE_STORY, submitStory, waitForMap } = require('./helpers');

test.describe('Test stories', () => {
  /** @type {import('@playwright/test').BrowserContext} */
  let adminCtx;
  let visitorSessionId;

  test.beforeAll(async ({ browser }) => {
    // Create an admin browser context (login via API)
    adminCtx = await browser.newContext();
    await adminCtx.request.post('/api/admin/login', { data: { password: ADMIN_PW } });

    // Create a fresh visitor session to use as the base for this test suite
    // (non-career text → no match → new session)
    const res = await adminCtx.request.post('/api/custom', {
      data: { text: 'Should I build a home studio for my photography hobby?' },
    });
    expect(res.ok()).toBeTruthy();
    const { id } = await res.json();
    visitorSessionId = id;

    // Publish it so the map is accessible
    await adminCtx.request.patch(`/api/admin/sessions/${visitorSessionId}`, {
      data: { published: true },
    });
  });

  test.afterAll(async () => {
    await adminCtx?.close();
  });

  test('test story does not appear on the public map', async ({ browser }) => {
    // 1. Submit a regular (non-test) story first so the map has at least one dot
    const regularCtx = await browser.newContext();
    const regularPage = await regularCtx.newPage();

    // Navigate to origin before clearing localStorage
    await regularPage.goto('/');
    await regularPage.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sm-'))
        .forEach((k) => localStorage.removeItem(k))
    );
    await regularPage.goto(`/s/${visitorSessionId}`);
    await submitStory(regularPage, { headline: 'The studio dream' });
    await waitForMap(regularPage, 15_000);

    const regularCirclesBefore = await regularPage.locator('[data-stage="map"] .mapwrap svg circle').count();
    expect(regularCirclesBefore).toBeGreaterThan(0);
    await regularCtx.close();

    // 2. Submit a TEST story using admin context (needs sm_admin + sm_test cookies)
    const adminPage = await adminCtx.newPage();
    // Set the sm_test cookie so the server marks the story as is_test=true
    await adminCtx.addCookies([{ name: 'sm_test', value: '1', url: 'http://localhost:3000' }]);

    await adminPage.goto('/');
    await adminPage.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sm-'))
        .forEach((k) => localStorage.removeItem(k))
    );
    await adminPage.goto(`/s/${visitorSessionId}`);
    await submitStory(adminPage, { headline: 'TEST: should be hidden' });
    await waitForMap(adminPage, 15_000);
    await adminPage.close();

    // Remove sm_test cookie so it doesn't bleed into other requests
    const cookies = await adminCtx.cookies();
    if (cookies.find((c) => c.name === 'sm_test')) {
      await adminCtx.clearCookies();
      await adminCtx.request.post('/api/admin/login', { data: { password: ADMIN_PW } });
    }

    // 3. Load the map as a fresh anonymous visitor — test story must NOT appear
    const publicCtx = await browser.newContext();
    const publicPage = await publicCtx.newPage();

    // Fetch the map via API and count non-test points
    const mapRes = await publicCtx.request.get(`/api/sessions/${visitorSessionId}`);
    expect(mapRes.ok()).toBeTruthy();
    const { map } = await mapRes.json();
    expect(map).not.toBeNull();

    // All points returned by the public API must have is_test falsy
    const testPoints = (map.points || []).filter((p) => p.isTest);
    expect(testPoints).toHaveLength(0);

    await publicCtx.close();
  });

  test('"Include my test stories" toggle shows test story on presenter map', async ({ browser }) => {
    // Submit another test story to ensure at least one test dot exists
    const adminPage = await adminCtx.newPage();
    await adminCtx.addCookies([{ name: 'sm_test', value: '1', url: 'http://localhost:3000' }]);

    await adminPage.goto('/');
    await adminPage.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sm-'))
        .forEach((k) => localStorage.removeItem(k))
    );
    await adminPage.goto(`/s/${visitorSessionId}`);
    await submitStory(adminPage, { headline: 'TEST: presenter toggle check' });
    await waitForMap(adminPage, 15_000);
    await adminPage.close();

    // Clear sm_test, re-login
    await adminCtx.clearCookies();
    await adminCtx.request.post('/api/admin/login', { data: { password: ADMIN_PW } });

    // Open the presenter page
    const presenterPage = await adminCtx.newPage();
    await presenterPage.goto(`/present/${visitorSessionId}`);
    await expect(presenterPage.locator('.bigcount, .mapwrap')).toBeVisible({ timeout: 10_000 });

    // Reveal the map
    const revealBtn = presenterPage.getByRole('button', { name: 'Reveal the map' });
    if (await revealBtn.isVisible({ timeout: 3000 }).catch(() => false)) await revealBtn.click();

    // Allow one poll cycle for data to arrive
    await presenterPage.waitForTimeout(4000);

    // Count circles WITHOUT test stories (default state: showTestStories=false)
    const circlesWithout = await presenterPage.locator('.mapwrap svg circle').count();

    // Click "Include my test stories" toggle
    await presenterPage.getByRole('button', { name: 'Include my test stories' }).click();

    // Allow re-render
    await presenterPage.waitForTimeout(1000);

    // Circle count should increase (test stories merged in)
    const circlesWith = await presenterPage.locator('.mapwrap svg circle').count();
    expect(circlesWith).toBeGreaterThan(circlesWithout);

    await presenterPage.close();
  });
});
