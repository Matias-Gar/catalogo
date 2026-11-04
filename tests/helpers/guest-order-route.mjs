import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as pricing from '../../lib/orderPricing.mjs';

// Execute the actual POST handler. Only its database transport is isolated.
// Sensitive tables and all stock/money RPCs are unavailable in this harness.
export function guestOrderRoute() {
  const saved = [], operations = [];
  let serviceClientUsed = false;
  const allowed = new Set(['sucursales', 'carritos_pendientes', 'productos', 'promociones', 'packs']);
  const db = { from(table) {
    assert.ok(allowed.has(table), `Guest order accessed forbidden table ${table}`);
    let insert;
    const filters = [];
    async function execute() {
      operations.push({ table, method: insert ? 'INSERT' : 'SELECT' });
      if (insert) {
        assert.equal(table, 'carritos_pendientes');
        const row = { ...insert, id: 123 };
        saved.push(row);
        return { data: row };
      }
      if (table === 'sucursales') return { data: { id: 'test', pais_id: 'bo' } };
      if (table === 'productos') return { data: [{ user_id: 12, nombre: 'Producto invitado', precio: 100,
        unidad_base: 'unidad', producto_variantes: [] }] };
      if (table === 'carritos_pendientes') return { data: saved.find(row => filters.every(([key, value]) => row[key] === value)) || null };
      return { data: [] };
    }
    return {
      select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
      in() { return this; }, order() { return this; }, limit() { return this; },
      insert(rows) { insert = rows[0]; return this; },
      maybeSingle: execute, single: execute,
      then(resolve, reject) { return execute().then(resolve, reject); },
    };
  } };
  const exports = {};
  const source = fs.readFileSync(new URL('../../app/api/carritos-pendientes-service-role/route.js', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://isolated.invalid', SUPABASE_SERVICE_ROLE_KEY: 'isolated-service-key' } },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (data, options) => Response.json(data, options) } };
      if (name === '@/lib/orderPricing.mjs') return pricing;
      if (name === '@supabase/supabase-js') return { createClient(url, key, options) {
        assert.equal(key, 'isolated-service-key');
        assert.equal(options.auth.persistSession, false);
        serviceClientUsed = true;
        return db;
      } };
      assert.fail(`Unexpected dependency ${name}`);
    },
  });
  return { post: exports.POST, saved, operations, usedServiceClient: () => serviceClientUsed };
}
