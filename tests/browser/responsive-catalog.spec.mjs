import { test, expect } from '@playwright/test';

test('catalog layout and branch navigation fit all requested widths', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/public/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('sucursales') ? { success: true, pais: { id: 'bo', slug: 'bo' }, sucursales: [{ id: 'test', nombre: 'Sucursal de prueba' }] }
      : path.endsWith('tipos-producto') ? { success: true, tipos: [{ value: 'articulos', label: 'Artículos' }, { value: 'insumos', label: 'Insumos' }] }
      : { success: true, settings: { store_name: 'Importaciones GARBLAC' }, previews: {} };
    return route.fulfill({ json });
  });
  await page.goto('/bo');
  await expect(page.getByRole('link', { name: 'Ver productos de artículos' })).toBeVisible();
  for (const width of [320, 350, 375, 390, 414, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`).toBe(true);
    const link = page.getByRole('link', { name: 'Ver productos de artículos' });
    await expect(link).toHaveAttribute('href', '/bo/tipo/articulos');
    await expect(link).toBeVisible();
  }
  expect(errors).toEqual([]);
});
