import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { quotePendingOrder, orderTotal } from '../lib/orderPricing.mjs';

// Run against the local development server. All business APIs are intercepted.
const browser = await chromium.launch({ headless: true });
try {
  for (const scenario of [
    { name: '25% y cantidad 2', discount: 25, quantity: 2, expected: 150 },
    { name: 'sin promoción', discount: 0, quantity: 1, expected: 100 },
    { name: 'cesta antigua ya descontada', discount: 25, quantity: 2, expected: 150, restored: 75 },
    { name: 'cesta antigua al precio original', discount: 25, quantity: 2, expected: 150, restored: 100 },
    { name: 'variante con precio propio', discount: 25, quantity: 2, expected: 300, base: 200, variant: true },
    { name: 'venta fraccionaria recuperada', discount: 25, quantity: 0.5, expected: 37.5, restored: 100 },
    { name: 'precio fijo', discount: 60, type: 'precio_fijo', quantity: 2, expected: 120 },
    { name: 'descuento absoluto', discount: 30, type: 'descuento_absoluto', quantity: 2, expected: 140 },
    { name: 'promoción vencida', discount: 25, end: '2000-01-01', quantity: 1, expected: 100 },
    { name: 'promoción futura', discount: 25, start: '2099-01-01', quantity: 1, expected: 100 },
    { name: 'recarga conserva precio', discount: 25, quantity: 2, expected: 150, reload: true },
    { name: 'fallo al guardar conserva cesta', discount: 25, quantity: 1, expected: 75, failSave: true },
    { name: 'centavos coinciden con precio visible', discount: 25, quantity: 3, productBase: 99.99, expected: 224.97 },
    { name: 'descuento del 100%', discount: 100, quantity: 1, expected: 0 },
    { name: 'cambio de precio requiere revisar antes de enviar', discount: 25, quantity: 1, expected: 75, serverDiscount: 30, priceChange: true },
  ]) {
    const context = await browser.newContext({ viewport: process.env.CATALOG_MOBILE
      ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [], orders = [];
    page.on('pageerror', e => errors.push(e.message));
    const dialogs = [];
    page.on('dialog', dialog => { dialogs.push(dialog.message()); return dialog.dismiss(); });
    await page.addInitScript(({ restored, quantity }) => {
      window.open = url => { window.__orderUrl = url; return null; };
      if (restored) localStorage.setItem('carrito_temporal_bo_test', JSON.stringify([
        { user_id: 12, nombre: 'Producto prueba', precio: restored, cantidad: quantity, cantidad_base: quantity, stock: 20, unidad: 'unidad' },
      ]));
    }, scenario);
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/carritos-pendientes-service-role') {
        orders.push(route.request().postDataJSON());
        const quoted = quotePendingOrder(orders.at(-1).productos,
          [{ user_id: 12, nombre: 'Producto prueba', precio: scenario.productBase || 100,
            producto_variantes: scenario.variant ? [{ id: 3, precio: 200, color: 'Rojo' }] : [] }],
          scenario.discount ? [{ producto_id: 12, activa: true, tipo: scenario.type || 'descuento', valor: scenario.serverDiscount ?? scenario.discount,
            fecha_inicio: scenario.start, fecha_fin: scenario.end }] : []);
        return route.fulfill({ status: scenario.failSave ? 500 : scenario.priceChange ? 409 : 200,
          json: scenario.failSave || scenario.priceChange ? { success: false, error: scenario.priceChange ? 'Los precios o promociones cambiaron' : 'Fallo simulado' } : { success: true, id: 123,
            productos: quoted, total: orderTotal(quoted) } });
      }
      if (url.pathname.startsWith('/api/public/')) {
        const json = url.pathname.endsWith('sucursales')
          ? { success: true, pais: { id: 'bo', slug: 'bo', nombre: 'Bolivia', whatsapp: '59170000000' }, sucursales: [{ id: 'test', nombre: 'Prueba', telefono: '59170000000' }] }
          : url.pathname.endsWith('tipos-producto') ? { success: true, tipos: [{ value: 'articulos', label: 'Artículos' }] }
            : { success: true, settings: { whatsapp_number: '59170000000' }, previews: {} };
        return route.fulfill({ json });
      }
      if (url.pathname.includes('/rest/v1/')) {
        const table = url.pathname.split('/').pop();
        const product = { user_id: 12, producto_id: 12, nombre: 'Producto prueba', precio: scenario.productBase || 100, precio_base: scenario.productBase || 100,
          stock: 20, stock_total: 20, unidad_base: 'unidad', variantes: [], vista_producto: 'articulos', category_id: 1, categoria: 'Prueba' };
        const variant = { id: 3, variante_id: 3, producto_id: 12, color: 'Rojo', precio: 200, stock: 20, stock_decimal: 20 };
        if (scenario.variant) product.variantes = [variant];
        let data = table === 'productos' || table === 'v_productos_catalogo' ? [product]
          : table === 'producto_variantes' && scenario.variant ? [variant]
          : table === 'promociones' && scenario.discount ? [{ id: 4, producto_id: '12', activa: true, tipo: scenario.type || 'descuento', valor: scenario.discount, fecha_inicio: scenario.start, fecha_fin: scenario.end }]
            : table === 'categorias' ? [{ id: 1, nombre: 'Prueba' }] : [];
        if (route.request().headers().accept?.includes('vnd.pgrst.object')) data = data[0] || null;
        return route.fulfill({ json: data });
      }
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return route.abort();
      return route.continue();
    });
    await page.goto('http://127.0.0.1:3100/productos');
    try {
      await page.getByTitle(/Agregar a la cesta|Agregar más unidades/).first().waitFor();
    } catch (error) {
      console.log((await page.locator('body').innerText()).slice(0, 3000), errors);
      throw error;
    }
    if (!scenario.restored) {
      await page.getByTitle('Agregar a la cesta', { exact: true }).first().click();
      // The modal has a separate confirmation button.
      const add = page.getByRole('button', { name: 'Agregar', exact: true });
      await add.click();
      await page.getByRole('button', { name: 'Ver cesta' }).click();
      for (let count = 1; count < scenario.quantity; count++) await page.getByTitle('Aumentar', { exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Ver cesta' }).click();
    }
    if (scenario.reload) {
      await page.reload();
      await page.getByTitle(/Agregar más unidades/).first().waitFor();
      await page.getByRole('button', { name: 'Ver cesta' }).click();
    }
    await page.getByRole('button', { name: /Enviar pedido|Confirmar pedido/i }).first().click();
    await page.getByRole('heading', { name: 'Confirmar Pedido' }).waitFor();
    assert.ok((await page.locator('body').innerText()).includes(`Bs ${scenario.expected.toFixed(2)}`), `${scenario.name}: total visible`);
    await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click();
    if (scenario.failSave || scenario.priceChange) {
      await page.waitForFunction(() => document.body.innerText.includes('Enviar por WhatsApp'));
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.__orderUrl), undefined);
      assert.ok(dialogs.some(text => text.includes(scenario.priceChange ? 'Los precios o promociones cambiaron' : 'Fallo simulado')));
      assert.ok(await page.evaluate(() => localStorage.getItem('carrito_temporal_bo_test').includes('Producto prueba')));
      console.log(`PASS ${scenario.name}: no abre WhatsApp ni borra el pedido`);
      await context.close();
      continue;
    }
    await page.waitForFunction(() => window.__orderUrl);
    assert.equal(orders.length, 1, scenario.name);
    const item = orders[0].productos[0];
    assert.equal((item.precio_unitario * item.cantidad_base).toFixed(2), scenario.expected.toFixed(2), scenario.name);
    assert.equal(item.precio_original, scenario.base || scenario.productBase || 100, scenario.name);
    const url = await page.evaluate(() => window.__orderUrl);
    assert.ok(new URL(url).searchParams.get('text').includes(`*Total:* Bs ${scenario.expected.toFixed(2)}`), scenario.name);
    assert.deepEqual(errors.filter(e => !e.includes('Navigator LockManager')), [], scenario.name);
    console.log(`PASS ${scenario.name}: payload y WhatsApp Bs ${scenario.expected.toFixed(2)}`);
    await context.close();
  }
} finally {
  await browser.close();
}
