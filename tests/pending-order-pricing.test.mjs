import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { priceCatalogItem } from '../lib/catalogCartPricing.mjs';
import * as orderPricing from '../lib/orderPricing.mjs';

const code = ts.transpileModule(readFileSync(new URL('../app/api/carritos-pendientes-service-role/route.js', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

function harness({ insertError = null, missingBranch = false } = {}) {
  const saved = [], filters = [];
  const db = { from(table) {
    const where = [];
    let pending = null;
    const execute = async () => {
      if (table === 'sucursales') return { data: missingBranch ? null : { id: 'branch', pais_id: 'bo' } };
      if (table === 'productos') return { data: [{ user_id: 12, nombre: 'Producto', precio: 100 }] };
      if (table === 'promociones') return { data: [{ producto_id: '12', activa: true, tipo: 'descuento', valor: 25 }] };
      if (table === 'packs') return { data: [] };
      assert.equal(table, 'carritos_pendientes', 'El pedido no debe acceder al stock');
      if (pending) {
        if (insertError) return { error: insertError };
        if (saved.some(s => s.request_key === pending.request_key)) return { error: { code: '23505' } };
        const row = { ...pending, id: 123 };
        saved.push(row);
        return { data: row };
      }
      return { data: saved.find(row => where.every(([key, value]) => row[key] === value)) || null };
    };
    const query = {
      select() { return this; }, eq(...args) { filters.push([table, ...args]); where.push(args); return this; },
      in() { return this; },
      order() { return this; }, limit() { return this; },
      insert(rows) { pending = rows[0]; return this; },
      maybeSingle: execute, single: execute,
      then(ok, fail) { return execute().then(ok, fail); },
    };
    return query;
  } };
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-only' } },
    require(name) {
      if (name === '@supabase/supabase-js') return { createClient: () => db };
      if (name === 'next/server') return { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } };
      if (name.includes('orderPricing')) return orderPricing;
      throw new Error(name);
    } });
  return { saved, filters, post: body => exports.POST({ json: async () => body, headers: { get: () => 'test-request' } }) };
}

test('la API guarda el precio promocional y su referencia sin sustituirlos por el original', async () => {
  const item = priceCatalogItem({ user_id: 12, precio: 100 }, [{ producto_id: '12', activa: true, tipo: 'descuento', valor: 25 }]);
  const product = { producto_id: item.user_id, cantidad: 2, cantidad_base: 2,
    precio_unitario: item.precio, precio_original: item.precio_original, promocion_aplicada: item.promocion_aplicada };
  const h = harness();
  const result = await h.post({ pais_id: 'bo', sucursal_id: 'branch', productos: [product] });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.id, 123);
  assert.equal(h.saved[0].productos[0].precio_unitario, 75);
  assert.equal(h.saved[0].productos[0].precio_original, 100);
  assert.equal(h.saved[0].productos[0].promocion_aplicada.valor, 25);
  assert.equal(h.saved[0].productos[0].cantidad_base * h.saved[0].productos[0].precio_unitario, 150);
  assert.ok(h.filters.some(([table, field, value]) => table === 'sucursales' && field === 'pais_id' && value === 'bo'));
});

test('fallos de base de datos y cantidades inválidas no se reportan como pedidos guardados', async () => {
  const h = harness({ insertError: { message: 'Fallo simulado' } });
  const body = { pais_id: 'bo', sucursal_id: 'branch', productos: [{ producto_id: 12, cantidad: 1, precio_unitario: 75 }] };
  assert.equal((await h.post(body)).data.success, false);
  const invalid = harness();
  assert.equal((await invalid.post({ ...body, productos: [{ cantidad: 0 }] })).status, 400);
  assert.equal(invalid.saved.length, 0);
});

test('dos envíos concurrentes guardan un solo pedido con los mismos precios de respuesta', async () => {
  const h = harness();
  const body = { pais_id: 'bo', sucursal_id: 'branch', carrito_token: 'token', productos: [{ producto_id: 12, cantidad: 2, precio_unitario: 1 }] };
  const results = await Promise.all([h.post(body), h.post(body)]);
  assert.ok(results.every(r => r.status === 200), JSON.stringify(results));
  assert.equal(h.saved.length, 1);
  assert.ok(results.every(r => r.data.total === 150 && r.data.productos[0].precio_unitario === 75));
  assert.equal((await h.post(body)).data.duplicate, true);
  assert.equal(h.saved.length, 1);
  assert.equal((await h.post({ ...body, carrito_token: 'otro' })).status, 409);
  assert.equal((await h.post({ ...body, productos: [{ producto_id: 12, cantidad: 3 }] })).status, 409);
  assert.equal((await h.post({ ...body, total_esperado: 100 })).status, 409);
});

test('no cambia de sucursal silenciosamente si la solicitada no existe', async () => {
  const h = harness({ missingBranch: true });
  assert.equal((await h.post({ pais_id: 'bo', sucursal_id: 'inexistente', productos: [{ producto_id: 12, cantidad: 1 }] })).status, 400);
  assert.equal(h.saved.length, 0);
});

test('si cambió el precio desde la confirmación no guarda ni cobra un total distinto', async () => {
  const h = harness();
  const result = await h.post({ pais_id: 'bo', sucursal_id: 'branch', total_esperado: 100,
    productos: [{ producto_id: 12, cantidad: 1, precio_unitario: 100 }] });
  assert.equal(result.status, 409);
  assert.equal(h.saved.length, 0);
});
