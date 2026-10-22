import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../app/api/admin/productos/archivar/route.js', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const body = { productId: 300, paisId: 'bolivia', sucursalId: 'central', archivado: true };
function harness({ auth = { email: 'admin@example.test' }, branch = { id: 'central' }, product = { user_id: 300, archivado: false }, updateError = null } = {}) {
  const queries = [];
  const db = { from(table) {
    const query = { table, filters: [], updateValue: null, insertValue: null,
      select() { return this; }, eq(...filter) { this.filters.push(filter); return this; },
      maybeSingle() { return this; }, single() { return this; },
      update(value) { this.updateValue = value; return this; }, insert(value) { this.insertValue = value; return this; },
      then(ok, fail) { return Promise.resolve(this.updateValue ? { data: { ...product, ...this.updateValue }, error: updateError } : { data: table === 'sucursales' ? branch : product, error: null }).then(ok, fail); },
    }; queries.push(query); return query;
  } };
  const exports = {};
  vm.runInNewContext(code, { exports, console, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } };
    if (name.includes('SupabaseAdminClient')) return { supabaseAdmin: db };
    if (name.includes('adminAccess')) return { requireAdminAccess: async (_request, options) => { assert.equal(options.allowedRoles[0], 'admin'); return auth; } };
    throw new Error(name);
  } });
  return { queries, post: (value = body) => exports.POST({ json: async () => value }) };
}
test('rejects invalid input and unauthorized callers before accessing products', async () => {
  const invalid = harness(); assert.equal((await invalid.post({ ...body, archivado: 'true' })).status, 400); assert.equal(invalid.queries.length, 0);
  const denied = harness({ auth: { error: 'Unauthorized', status: 401 } }); assert.equal((await denied.post()).status, 401); assert.equal(denied.queries.length, 0);
});
test('rejects a missing branch or product without any update', async () => {
  for (const options of [{ branch: null }, { product: null }]) {
    const h = harness(options); assert.ok((await h.post()).status >= 400);
    assert.equal(h.queries.filter(query => query.updateValue).length, 0);
  }
});
test('archives only the exact product in the authorized scope and records history', async () => {
  const h = harness(); const result = await h.post(); assert.equal(result.status, 200); assert.equal(result.data.product.archivado, true);
  const update = h.queries.find(query => query.updateValue);
  assert.equal(update.filters.find(([key]) => key === 'user_id')[1], 300);
  assert.equal(update.filters.find(([key]) => key === 'pais_id')[1], 'bolivia');
  assert.equal(update.filters.find(([key]) => key === 'sucursal_id')[1], 'central');
  const history = h.queries.find(query => query.table === 'productos_historial').insertValue;
  assert.equal(history.accion, 'ARCHIVE'); assert.equal(history.producto_id, 300); assert.equal(history.usuario_email, 'admin@example.test');
});
test('does not record success or history when the database rejects the update', async () => {
  const h = harness({ updateError: new Error('Database rejected update') });
  assert.equal((await h.post()).data.success, false);
  assert.equal(h.queries.filter(query => query.table === 'productos_historial').length, 0);
});
test('repeating an already completed archive does not create another write or history', async () => {
  const h = harness({ product: { user_id: 300, archivado: true } }); assert.equal((await h.post()).data.success, true);
  assert.equal(h.queries.filter(query => query.updateValue || query.insertValue).length, 0);
});
