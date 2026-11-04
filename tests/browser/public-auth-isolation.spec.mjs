import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import dotenv from 'dotenv';

for (const scenario of ['held-lock', 'expired-session']) test(`public catalog and basket remain usable with ${scenario}`, async ({ context, page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/audit-held-session', route => route.fulfill({ contentType: 'text/html', body: '<title>Session lock holder</title>' }));
  const owner = await context.newPage();
  await owner.goto('/audit-held-session');
  const local = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
  const privateHost = new URL(process.env.AUDIT_AUTH_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL || 'https://garblac.duckdns.org').hostname.split('.')[0];
  if (scenario === 'held-lock') await owner.evaluate(name => new Promise(resolve => {
    void navigator.locks.request(name, () => {
      resolve();
      return new Promise(release => { window.releaseSessionLock = release; });
    });
  }), `lock:sb-${privateHost}-auth-token`);
  if (scenario === 'expired-session') await page.addInitScript(host => {
    localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: 'expired-fixture', refresh_token: 'fixture-refresh',
      expires_at: 1, expires_in: 1, token_type: 'bearer', user: { id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.invalid' } }));
  }, privateHost);
  const calls = [];
  const applicationHost = new URL(test.info().project.use.baseURL).hostname;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 503, json: { message: 'Auth temporarily unavailable' } });
    if (url.pathname.startsWith('/api/public/')) {
      if (url.pathname.includes('catalog-image')) return route.fulfill({ status: 404 });
      const json = url.pathname.endsWith('sucursales')
        ? { success: true, pais: { id: 'bo', slug: 'bo', nombre: 'Bolivia' }, sucursales: [{ id: 'test', nombre: 'Prueba' }] }
        : url.pathname.endsWith('tipos-producto') ? { success: true, tipos: [{ value: 'articulos', label: 'Artículos' }] }
          : { success: true, settings: {}, previews: {} };
      return route.fulfill({ json });
    }
    if (url.pathname.includes('/rest/v1/')) {
      const table = url.pathname.split('/').pop(); calls.push(table);
      const product = { user_id: 12, producto_id: 12, nombre: 'Producto público sin sesión', precio: 100, precio_base: 100,
        stock: 20, stock_total: 20, unidad_base: 'unidad', variantes: [], vista_producto: 'articulos', category_id: 1, categoria: 'Prueba' };
      let data = ['productos', 'v_productos_catalogo'].includes(table) ? [product]
        : table === 'categorias' ? [{ id: 1, nombre: 'Prueba' }] : [];
      if (route.request().headers().accept?.includes('vnd.pgrst.object')) data = data[0] || null;
      return route.fulfill({ json: data });
    }
    if (url.hostname !== applicationHost) return route.abort();
    return route.continue();
  });
  try {
    await page.goto('/bo/productos');
    await expect(page.getByText('Producto público sin sesión', { exact: true }).first()).toBeVisible({ timeout: 7000 });
    expect(calls).toContain('promociones');
    expect(calls).toContain('packs');
    await page.getByTitle('Agregar a la cesta', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.getByRole('button', { name: 'Ver cesta' }).click();
    await expect(page.getByText('Producto público sin sesión', { exact: true }).last()).toBeVisible();
    if (scenario === 'held-lock') await page.waitForTimeout(11000);
    expect(errors).toEqual([]);
  } finally { if (scenario === 'held-lock') await owner.evaluate(() => window.releaseSessionLock()); await owner.close(); }
});

test('catalog read failures show a safe retry and recover without losing the page', async ({ page }) => {
  let unavailable = true;
  const applicationHost = new URL(test.info().project.use.baseURL).hostname;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/public/')) {
      const json = url.pathname.endsWith('sucursales')
        ? { success: true, pais: { id: 'bo', slug: 'bo' }, sucursales: [{ id: 'test', nombre: 'Prueba' }] }
        : url.pathname.endsWith('tipos-producto') ? { success: true, tipos: [{ value: 'articulos', label: 'Artículos' }] }
          : { success: true, settings: {}, previews: {} };
      return route.fulfill({ json });
    }
    if (url.pathname.includes('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (table === 'v_productos_catalogo' && unavailable) {
        return route.fulfill({ status: 503, json: { message: 'private SQL detail must not reach customer' } });
      }
      const product = { user_id: 12, producto_id: 12, nombre: 'Producto recuperado', precio: 100, precio_base: 100,
        stock: 20, stock_total: 20, unidad_base: 'unidad', variantes: [], vista_producto: 'articulos' };
      return route.fulfill({ json: ['productos', 'v_productos_catalogo'].includes(table) ? [product] : [] });
    }
    if (url.hostname !== applicationHost) return route.abort();
    return route.continue();
  });
  await page.goto('/bo/productos');
  await expect(page.getByRole('alert').filter({ hasText: 'No pudimos cargar los productos' })).toBeVisible();
  await expect(page.getByText('private SQL detail must not reach customer')).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Reintentar carga' }).click();
  await expect(page.getByText('Producto recuperado', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar carga' })).toHaveCount(0);
});
