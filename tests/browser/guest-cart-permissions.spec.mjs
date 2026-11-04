import { test, expect } from '@playwright/test';
import { guestOrderRoute } from '../helpers/guest-order-route.mjs';

for (const width of [390, 1440]) test(`guest cart CRUD and checkout survive denied financial permissions at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const backend = guestOrderRoute();
  const errors = [], forbidden = [], directWrites = [], authRequests = [], checkoutAuth = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.open = url => { window.auditGuestWhatsapp = url; return null; }; });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/carritos-pendientes-service-role') {
      checkoutAuth.push(request.headers().authorization || null);
      const response = await backend.post(new Request(request.url(), { method: 'POST', headers: request.headers(), body: request.postData() }));
      return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
    }
    if (url.pathname.startsWith('/api/public/')) {
      const json = url.pathname.endsWith('sucursales') ? { success: true, pais: { id: 'bo', slug: 'bo', whatsapp: '59170000000' }, sucursales: [{ id: 'test', nombre: 'Prueba' }] }
        : url.pathname.endsWith('tipos-producto') ? { success: true, tipos: [{ value: 'articulos', label: 'Artículos' }] }
        : { success: true, settings: { whatsapp_number: '59170000000' }, previews: {} };
      return route.fulfill({ json });
    }
    if (url.pathname.includes('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (url.pathname.includes('/rpc/') || ['stock_movimientos', 'ventas_pagos', 'password_resets'].includes(table)) {
        forbidden.push(url.pathname);
        return route.fulfill({ status: 403, json: { message: 'Permission denied by audit scenario' } });
      }
      if (request.method() !== 'GET') {
        directWrites.push({ path: url.pathname, method: request.method() });
        return route.fulfill({ status: 403, json: { message: 'No direct guest writes allowed' } });
      }
      const product = { user_id: 12, producto_id: 12, nombre: 'Producto invitado', precio: 100, precio_base: 100,
        stock: 20, stock_total: 20, unidad_base: 'unidad', variantes: [], vista_producto: 'articulos', category_id: 1, categoria: 'Prueba', imagen_base: '/brand/garblac-logo.png', imagen_url: '/brand/garblac-logo.png' };
      let data = table === 'productos' || table === 'v_productos_catalogo' ? [product]
        : table === 'categorias' ? [{ id: 1, categori: 'Prueba' }] : [];
      if (request.headers().accept?.includes('vnd.pgrst.object')) data = data[0] || null;
      return route.fulfill({ json: data });
    }
    if (url.pathname.includes('/auth/v1/')) {
      authRequests.push(url.pathname);
      return route.fulfill({ status: 401, json: { message: 'Guest has no login session' } });
    }
    return route.continue();
  });

  const basket = () => page.evaluate(() => JSON.parse(localStorage.getItem('carrito_temporal_bo_test') || '[]'));
  const quantity = async () => (await basket())[0]?.cantidad;
  const add = async () => {
    await page.getByTitle('Agregar a la cesta', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.getByRole('button', { name: 'Ver cesta' }).click();
  };
  await page.goto('/bo/productos');
  await add();
  await expect.poll(quantity).toBe(1);
  const dialog = page.getByRole('region', { name: 'Tu cesta (1)', exact: true });
  await expect(dialog.getByRole('img', { name: 'Producto invitado' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Seguir comprando' })).toBeVisible();
  await expect(dialog).toHaveCSS('background-color', 'rgb(16, 44, 50)');
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.screenshot({ path: `docs/audit-2026-11-04/cart-layout-${test.info().project.name}-${width}.png` });
  await page.getByTitle('Aumentar', { exact: true }).click();
  await page.getByTitle('Aumentar', { exact: true }).click();
  await expect.poll(quantity).toBe(3);
  await page.getByTitle('Disminuir', { exact: true }).click();
  await expect.poll(quantity).toBe(2);
  expect(backend.saved).toHaveLength(0);
  await page.locator('h1').first().click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver cesta' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Seguir comprando' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByTitle(/^Agregar más unidades/).first().waitFor();
  await page.getByRole('button', { name: 'Ver cesta' }).click();
  await expect.poll(quantity).toBe(2);
  await page.getByTitle('Eliminar', { exact: true }).click();
  await expect.poll(basket).toEqual([]);
  await expect(page.getByText('La cesta está vacía.', { exact: true })).toBeVisible();
  await page.getByTitle('Cerrar', { exact: true }).click();

  await add();
  await page.getByRole('button', { name: /Revisar y confirmar pedido/i }).click();
  await page.getByPlaceholder('Ingresa tu nombre completo').fill('Invitado de prueba');
  await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click();
  await expect.poll(() => backend.saved.length).toBe(1);
  await expect.poll(() => page.evaluate(() => window.auditGuestWhatsapp || '')).toContain('wa.me');
  expect(checkoutAuth).toEqual([null]);
  expect(backend.usedServiceClient()).toBe(true);
  expect(backend.saved[0].usuario_id).toBeNull();
  expect(backend.saved[0].estado).toBe('pendiente');
  expect(backend.saved[0].productos[0].cantidad).toBe(1);
  expect(backend.operations.filter(op => op.method === 'INSERT').map(op => op.table)).toEqual(['carritos_pendientes']);
  expect(forbidden).toEqual([]);
  expect(directWrites).toEqual([]);
  expect(authRequests).toEqual([]);
  expect(errors).toEqual([]);
  await test.info().attach('guest-permission-proof', { body: Buffer.from(JSON.stringify({ width, checkoutAuth,
    operations: backend.operations, forbidden, directWrites, authRequests, errors })), contentType: 'application/json' });
});
