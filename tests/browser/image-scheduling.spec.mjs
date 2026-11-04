import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('visible products load first and distant images wait for scrolling', async ({ page }) => {
  const requested = new Set();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const pixel = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#00D6D2' } }).png().toBuffer();
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/public/catalog-image') {
      const path = url.searchParams.get('path');
      if (path?.includes('/scheduling-')) requested.add(path);
      return route.fulfill({ contentType: 'image/png', body: pixel });
    }
    if (url.pathname.startsWith('/api/public/')) {
      const json = url.pathname.endsWith('sucursales') ? { success: true, pais: { id: 'bo', slug: 'bo' }, sucursales: [{ id: 'test', nombre: 'Prueba' }] }
        : url.pathname.endsWith('tipos-producto') ? { success: true, tipos: [{ value: 'articulos', label: 'Artículos' }] }
        : { success: true, settings: {}, previews: {} };
      return route.fulfill({ json });
    }
    if (url.pathname.includes('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      const products = Array.from({ length: 40 }, (_, index) => ({
        user_id: index + 1, producto_id: index + 1, nombre: `Producto ${index + 1}`,
        precio: 100, precio_base: 100, stock: 20, stock_total: 20, variantes: [], category_id: 1,
        imagen_base: `https://garblac.duckdns.org/storage/v1/object/public/product_images/public/scheduling-${index + 1}.png`,
      }));
      return route.fulfill({ json: table === 'productos' || table === 'v_productos_catalogo' ? products
        : table === 'categorias' ? [{ id: 1, categori: 'Prueba' }] : [] });
    }
    return route.continue();
  });
  await page.goto('/bo/productos');
  const cards = page.locator('.catalog-product-card');
  await expect(cards).toHaveCount(40);
  await expect.poll(() => requested.size).toBeGreaterThanOrEqual(4);
  await expect.poll(() => cards.first().locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(requested.size).toBeLessThan(16);
  expect([...requested].some(path => path.endsWith('scheduling-40.png'))).toBe(false);
  await cards.last().scrollIntoViewIfNeeded();
  await expect.poll(() => [...requested].some(path => path.endsWith('scheduling-40.png'))).toBe(true);
  await expect.poll(() => cards.last().locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(errors).toEqual([]);
});
