import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolveStorageImageUrl } from '../../lib/storageImageUrl.mjs';

const views = ['articulos', 'insumos', 'productos', 'moldes', 'equipos-de-produccion', 'papeleria', 'insumos-para-velas', 'categoria-futura'];
const photo = 'https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/product_images/public/test.jpg';
const second = 'https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/product_images/public/second.jpg';

test('all country and dynamic catalog routes share the touch viewer', async ({ page }) => {
  await page.route('**/_next/image?**', route => route.fulfill({ status: 402, body: 'Payment Required' }));
  await page.route('**/storage/v1/object/public/**', route => route.fulfill({ contentType: 'image/jpeg', body: readFileSync('public/free-shopping-icons-vector.jpg') }));
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/public/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const payload = path.endsWith('sucursales') ? { success: true, sucursales: [{ id: 'test', nombre: 'Prueba' }], pais: { nombre: 'Prueba' } }
      : path.endsWith('tipos-producto') ? { success: true, tipos: views.map(value => ({ value, label: value })) }
      : { success: true, settings: {}, previews: {} };
    await route.fulfill({ json: payload });
  });
  await page.route('**/rest/v1/**', async (route) => {
    const table = new URL(route.request().url()).pathname.split('/').pop();
    const rows = views.flatMap((view, i) => [0, 1].map(n => ({ producto_id: i * 10 + n + 1, user_id: i * 10 + n + 1,
      nombre: `Producto ${view} ${n}`, descripcion: 'Producto de prueba', vista_producto: view, category_id: 1,
      categoria: 'Prueba', precio_base: 10, stock_total: 5, stock: 5, variantes: [], imagen_base: photo, unidad_base: 'unidad' })));
    const data = table === 'v_productos_catalogo' || table === 'productos' ? rows
      : table === 'categorias' ? [{ id: 1, categori: 'Prueba', nombre: 'Prueba' }]
      : table === 'packs' ? rows.filter(row => row.user_id % 10 === 1).map(row => ({ id: row.user_id, nombre: `Pack ${row.vista_producto}`, activo: true, precio_pack: 8, pack_productos: [{ cantidad: 1, productos: { ...row, precio: 10 } }] }))
      : table === 'producto_imagenes' ? rows.filter(row => row.user_id % 10 === 1).map(row => ({ producto_id: row.user_id, imagen_url: second })) : [];
    await route.fulfill({ json: data });
  });
  const paths = ['/productos', '/productos?categoria=1', '/insumos', '/insumos/productos', ...views.flatMap(view => [`/tipo/${view}`, `/tipo/${view}/productos`])];
  for (const prefix of ['', '/bo', '/cl']) {
    for (const path of paths) {
      await page.goto(prefix + path, { waitUntil: 'domcontentloaded' });
      const trigger = page.getByRole('button', { name: /^Ampliar imagen de/ }).first();
      await expect(trigger).toBeVisible();
      await trigger.tap();
      const viewer = page.getByRole('dialog');
      await expect(viewer).toBeVisible();
      await expect(viewer.getByRole('img').first()).toBeVisible();
      await expect(viewer.locator('.viewer-image')).toHaveAttribute('src', resolveStorageImageUrl(photo));
      await expect.poll(() => viewer.locator('.viewer-image').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
      await viewer.getByRole('button', { name: 'Ver imagen 2', exact: true }).tap();
      await expect(viewer.getByText(/\(2 \/ 2\)/)).toBeVisible();
      await viewer.getByRole('button', { name: 'Imagen siguiente' }).tap();
      await expect(viewer.getByText(/\(1 \/ 2\)/)).toBeVisible();
      await viewer.getByRole('button', { name: 'Cerrar visor' }).tap();
      await expect(viewer).toHaveCount(0);
      await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
      await page.getByRole('button', { name: /^Ampliar imagen de/ }).nth(1).tap();
      await expect(viewer.getByText(/\(1 \/ 1\)/)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(viewer).toHaveCount(0);
      if (prefix === '' && ['/productos', '/tipo/moldes'].includes(path)) {
        await page.getByTitle(/^Ver imagen de Producto/).first().tap();
        await expect(viewer.getByText(/\(1 \/ 2\)/)).toBeVisible();
        await viewer.getByRole('button', { name: 'Imagen siguiente' }).tap();
        await expect(viewer.getByText(/\(2 \/ 2\)/)).toBeVisible();
        await viewer.getByRole('button', { name: 'Cerrar visor' }).tap();
      }
      if (prefix === '' && path === '/productos') {
        await page.evaluate(() => window.scrollTo(0, 250));
        await trigger.scrollIntoViewIfNeeded();
        const scrollY = await page.evaluate(() => window.scrollY);
        await trigger.tap();
        const image = viewer.locator('.viewer-image');
        await image.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 300, clientY: 200 }] });
        await image.dispatchEvent('touchend', { touches: [], changedTouches: [{ identifier: 1, clientX: 100, clientY: 205 }] });
        await expect(viewer.getByText(/\(2 \/ 2\)/)).toBeVisible();
        await page.setViewportSize({ width: 844, height: 390 });
        const box = await image.boundingBox();
        expect(box.height).toBeLessThan(390);
        await viewer.getByRole('button', { name: 'Cerrar visor' }).tap();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
        await page.setViewportSize({ width: 1440, height: 900 });
        const search = page.getByPlaceholder(/^Buscar producto/);
        await search.fill('Producto articulos 0');
        await expect(page.getByRole('button', { name: /^Ampliar imagen de/ })).toHaveCount(1);
        await trigger.click();
        await page.keyboard.press('ArrowRight');
        await expect(viewer.getByText(/\(2 \/ 2\)/)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        await search.fill('');
        await page.setViewportSize({ width: 390, height: 844 });
      }

    }
  }
  const authLockError = /^Acquiring an exclusive Navigator LockManager lock "lock:sb-[^"]+-auth-token" immediately failed$/;
  const knownErrors = errors.filter(error => authLockError.test(error));
  if (knownErrors.length) test.info().annotations.push({ type: 'known-auth-issue', description: `${knownErrors.length} Supabase Navigator LockManager errors; viewer assertions completed` });
  expect(errors.filter(error => !authLockError.test(error))).toEqual([]);
});
