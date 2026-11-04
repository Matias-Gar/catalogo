import { test, expect } from '@playwright/test';

test('public catalog defers the printer library and admin navigation loads it once', async ({ page }) => {
  const requests = [];
  const errors = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/qz-tray.js') requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/public/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('sucursales') ? { success: true, pais: { id: 'bo' }, sucursales: [{ id: 'test', nombre: 'Prueba' }] }
      : path.endsWith('tipos-producto') ? { success: true, tipos: [{ value: 'articulos', label: 'Artículos' }] }
      : { success: true, settings: {}, previews: {} };
    return route.fulfill({ json });
  });
  await page.goto('/bo');
  await expect(page.getByRole('link', { name: 'Ver productos de artículos' })).toBeVisible();
  expect(requests).toHaveLength(0);
  // Let link prefetches finish before replacing the document. WebKit reports
  // cancelled RSC prefetches as access-control errors during a hard navigation.
  await page.waitForLoadState('networkidle');
  await page.goto('/admin');
  await expect.poll(() => page.evaluate(() => Boolean(window.qz))).toBe(true);
  expect(requests).toHaveLength(1);
  await expect(page.locator('#qz-tray-script')).toHaveCount(1);
  expect(errors).toEqual([]);
});
