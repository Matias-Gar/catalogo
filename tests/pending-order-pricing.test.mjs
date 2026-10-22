import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { priceCatalogItem } from '../lib/catalogCartPricing.mjs';

const code = ts.transpileModule(readFileSync(new URL('../app/api/carritos-pendientes-service-role/route.js', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function harness({ insertError = null } = {}) {
  const saved = [], filters = [];
  const db = { from(table) {
    const query = {
      select() { return this; }, eq(...args) { filters.push([table, ...args]); return this; },
      order() { return this; }, limit() { return this; },
      insert(rows) { saved.push(...rows); return this; },
      async maybeSingle() { return { data: { id: 'branch', pais_id: 'bo' } }; },
      async single() { return insertError ? { error: insertError } : { data: { id: 123 } }; },
    };
    return query;
  } };
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-only' } },
    require(name) {
      if (name === '@supabase/supabase-js') return { createClient: () => db };
      if (name === 'next/server') return { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } };
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
  assert.equal(result.status, 200);
  assert.equal(result.data.id, 123);
  assert.equal(h.saved[0].productos[0].precio_unitario, 75);
  assert.equal(h.saved[0].productos[0].precio_original, 100);
  assert.equal(h.saved[0].productos[0].promocion_aplicada.valor, 25);
  assert.equal(h.saved[0].productos[0].cantidad_base * h.saved[0].productos[0].precio_unitario, 150);
  assert.ok(h.filters.some(([table, field, value]) => table === 'sucursales' && field === 'pais_id' && value === 'bo'));
});

test('fallos de base de datos y cantidades inválidas no se reportan como pedidos guardados', async () => {
  const h = harness({ insertError: { message: 'Fallo simulado' } });
  const body = { pais_id: 'bo', sucursal_id: 'branch', productos: [{ cantidad: 1, precio_unitario: 75 }] };
  assert.equal((await h.post(body)).data.success, false);
  const invalid = harness();
  assert.equal((await invalid.post({ ...body, productos: [{ cantidad: 0 }] })).status, 400);
  assert.equal(invalid.saved.length, 0);
});
