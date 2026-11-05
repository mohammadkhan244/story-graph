// @ts-check
// Tests that is_test stories:
//   - are hidden on public maps by default (not returned by promptMap / sessionMap)
//   - appear on public maps (without isTest flag) after show_public is set via admin toggle
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

  test('test story does not appear on the public map by default', async ({ browser }) => {
    // 1. Submit a regular (non-test) story first so the map has at least one dot
    const regularCtx = await browser.newContext();
    const regularPage = await regularCtx.newPage();

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
    const mapRes = await publicCtx.request.get(`/api/sessions/${visitorSessionId}`);
    expect(mapRes.ok()).toBeTruthy();
    const { map } = await mapRes.json();
    expect(map).not.toBeNull();

    // Public API must not expose any isTest points when show_public is false (default)
    const testPoints = (map.points || []).filter((p) => p.isTest);
    expect(testPoints).toHaveLength(0);

    await publicCtx.close();
  });

  test('test story appears on public map after "Show publicly" admin toggle', async ({ browser }) => {
    // Submit a TEST story
    await adminCtx.addCookies([{ name: 'sm_test', value: '1', url: 'http://localhost:3000' }]);
    const adminPage = await adminCtx.newPage();

    await adminPage.goto('/');
    await adminPage.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sm-'))
        .forEach((k) => localStorage.removeItem(k))
    );
    await adminPage.goto(`/s/${visitorSessionId}`);
    await submitStory(adminPage, { headline: 'TEST: show_public test' });
    await waitForMap(adminPage, 15_000);
    await adminPage.close();

    // Clear sm_test, re-login
    await adminCtx.clearCookies();
    await adminCtx.request.post('/api/admin/login', { data: { password: ADMIN_PW } });

    // Find the test story id via admin API
    const detRes = await adminCtx.request.get(`/api/admin/sessions/${visitorSessionId}`);
    expect(detRes.ok()).toBeTruthy();
    const { stories } = await detRes.json();
    const testStory = stories.find((s) => s.is_test && s.headline === 'TEST: show_public test');
    expect(testStory).toBeTruthy();

    // Verify it is NOT in the public map before toggling
    const publicCtx = await browser.newContext();
    const beforeRes = await publicCtx.request.get(`/api/sessions/${visitorSessionId}`);
    const beforeMap = await beforeRes.json();
    const beforeIds = (beforeMap.map && beforeMap.map.points || []).map((p) => p.id);
    expect(beforeIds).not.toContain(testStory.id);

    // Toggle show_public = true via admin API
    const patchRes = await adminCtx.request.patch(`/api/admin/stories/${testStory.id}`, {
      data: { show_public: true },
    });
    expect(patchRes.ok()).toBeTruthy();

    // Now the story should appear in the public map
    const afterRes = await publicCtx.request.get(`/api/sessions/${visitorSessionId}`);
    expect(afterRes.ok()).toBeTruthy();
    const afterMap = await afterRes.json();
    const afterIds = (afterMap.map && afterMap.map.points || []).map((p) => p.id);
    expect(afterIds).toContain(testStory.id);

    // It must NOT have isTest flag (renders as normal dot, no TEST label)
    const shownPoint = (afterMap.map.points || []).find((p) => p.id === testStory.id);
    expect(shownPoint.isTest).toBeFalsy();

    // Restore: set show_public back to false
    await adminCtx.request.patch(`/api/admin/stories/${testStory.id}`, {
      data: { show_public: false },
    });

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
    await expect(presenterPage.locator('.bigcount, .mapwrap').first()).toBeVisible({ timeout: 10_000 });

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
