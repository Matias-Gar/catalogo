import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { products, promotions, orderItems } from './fixtures/promotion-order8.mjs';
import { validateSaleDiscounts } from '../lib/validateSaleDiscounts.mjs';

dotenv.config({ path: '.env.local', quiet: true });
const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const errors = [], submitted = [], unexpectedWrites = [];
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'test@example.test', role: 'authenticated' };
  const expiration = Math.floor(Date.now() / 1000) + 86400;
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: user.id, exp: expiration, role: 'authenticated' })).toString('base64url'), 'test-signature'].join('.');
  await page.addInitScript(({ project, user, token, expiration, orderItems }) => {
    localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: token, refresh_token: 'test', expires_at: expiration, expires_in: 86400, token_type: 'bearer', user }));
    sessionStorage.setItem('pedido_a_efectivizar', JSON.stringify({ id: 8, pais_id: 'bo', sucursal_id: 'branch', productos: orderItems }));
    window.print = () => {};
    window.open = () => null;
  }, { project, user, token, expiration, orderItems });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/admin/sucursal-context') return route.fulfill({ json: { success: true,
      paises: [{ id: 'bo', nombre: 'Bolivia', slug: 'bo', rol_pais: 'admin' }],
      sucursales: [{ id: 'branch', pais_id: 'bo', nombre: 'Prueba' }] } });
    if (url.pathname === '/api/admin/ventas/crear') {
      const body = request.postDataJSON();
      validateSaleDiscounts({ venta: body.venta, items: body.items, products, promotions, packs: [] });
      submitted.push({ body, key: request.headers()['idempotency-key'] });
      return route.fulfill({ status: submitted.length === 1 ? 500 : 200,
        json: submitted.length === 1 ? { success: false, error: 'Fallo simulado sin venta ni stock' }
          : { success: true, venta: { id: 999 } } });
    }
    if (url.pathname.includes('/auth/v1/')) return route.fulfill({ json: user });
    if (url.pathname.includes('/rest/v1/')) {
      if (request.method() !== 'GET') { unexpectedWrites.push(url.pathname); return route.abort(); }
      const table = url.pathname.split('/').pop();
      const rows = products.map(p => ({ ...p, producto_id: p.user_id, precio_base: p.precio,
        stock: 30, stock_total: 30, unidad_base: 'unidad', pais_id: 'bo', sucursal_id: 'branch',
        variantes: p.producto_variantes.map(v => ({ ...v, variante_id: v.id, color: 'Unico', stock: 30, stock_decimal: 30 })),
        producto_variantes: p.producto_variantes.map(v => ({ ...v, color: 'Unico', stock: 30, stock_decimal: 30 })) }));
      let data = table === 'perfiles' ? [{ ...user, rol: 'admin' }]
        : table === 'productos' || table === 'v_productos_catalogo' ? rows
        : table === 'producto_variantes' ? rows.flatMap(p => p.producto_variantes.map(v => ({ ...v, producto_id: p.user_id })))
        : table === 'promociones' ? promotions : [];
      if (request.headers().accept?.includes('vnd.pgrst.object')) data = data[0] || null;
      return route.fulfill({ json: data });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true, settings: {}, tipos: [] } });
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  await page.goto('http://127.0.0.1:3100/admin/ventas/nueva');
  try {
    await page.getByRole('cell', { name: 'Bs 675.00', exact: true }).waitFor({ timeout: 45000 });
  } catch (error) { console.log((await page.locator('body').innerText()).slice(-4000), errors); throw error; }
  assert.ok((await page.locator('body').innerText()).includes('925.00'));
  assert.ok(!(await page.locator('body').innerText()).includes('703.78'));
  await page.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await page.getByPlaceholder('Monto', { exact: true }).fill('925');
  await page.getByLabel('efectivizar-venta', { exact: true }).click();
  await page.getByText('Error al crear venta: Fallo simulado sin venta ni stock', { exact: true }).waitFor();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].body.venta.total, 925);
  assert.equal(submitted[0].body.pending_order_id, 8);
  await page.getByRole('cell', { name: 'Bs 675.00', exact: true }).waitFor();
  await page.getByLabel('efectivizar-venta', { exact: true }).click();
  await page.getByText('Venta efectivizada y stock actualizado', { exact: true }).waitFor();
  assert.equal(submitted.length, 2);
  assert.equal(submitted[0].key, submitted[1].key, 'El reintento conserva su clave para no descontar stock dos veces');
  assert.deepEqual(unexpectedWrites, [], 'El navegador no debe escribir inventario, detalles ni caja por separado');
  assert.deepEqual(errors.filter(e => !e.includes('Navigator LockManager')), []);
  console.log('PASS pedido 8: UI Bs 925 -> API Bs 925; fallo conserva cesta; reintento conserva clave; ninguna escritura directa de stock');
} finally { await browser.close(); }
