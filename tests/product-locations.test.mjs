import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync(new URL('../app/api/admin/inventario/ubicaciones/route.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replaceAll('export ', '');

function setup({ role = 'almacen', product = { user_id: 7 }, branch = { id: 'branch' } } = {}) {
  const writes = [];
  const db = {
    from(table) {
      const query = {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: table === 'sucursales' ? branch : product }; },
        async upsert(value) { writes.push(value); return {}; },
        delete() { writes.push('delete'); return this; },
        then(resolve) { resolve({}); },
      };
      return query;
    },
  };
  const context = { URL, Date, supabaseAdmin: db,
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
    requireAdminAccess: async (_request, options) => options.allowedRoles.includes(role)
      ? { userId: 'user', role } : { error: 'Forbidden', status: 403 },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { writes, put: body => context.PUT({ json: async () => body }) };
}
const body = { paisId: 'country', sucursalId: 'branch', productoId: 7, caja: ' Caja 1 ' };

test('guarda una caja por producto sin modificar stock', async () => {
  const { writes, put } = setup();
  const result = await put(body);
  assert.equal(result.status, 200);
  assert.equal(writes[0].caja, 'Caja 1');
  assert.equal(writes[0].producto_id, 7);
  assert.equal('stock' in writes[0], false);
});
test('vendedor consulta pero no modifica ubicaciones', async () => {
  const { writes, put } = setup({ role: 'vendedor' });
  assert.equal((await put(body)).status, 403);
  assert.equal(writes.length, 0);
});
test('rechaza producto ajeno a la sucursal', async () => {
  const { writes, put } = setup({ product: null });
  assert.equal((await put(body)).status, 404);
  assert.equal(writes.length, 0);
});
test('rechaza sucursal ajena al pais', async () => {
  const { writes, put } = setup({ branch: null });
  assert.equal((await put(body)).status, 403);
  assert.equal(writes.length, 0);
});
test('permite quitar la ubicacion y valida su longitud', async () => {
  const { writes, put } = setup();
  assert.equal((await put({ ...body, caja: ' ' })).status, 200);
  assert.equal(writes[0], 'delete');
  assert.equal((await put({ ...body, caja: 'x'.repeat(81) })).status, 400);
  assert.equal(writes.length, 1);
});
