import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const routeSource = readFileSync(new URL('../app/api/cash/closure/route.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replaceAll('export ', '');
const serviceSource = readFileSync(new URL('../services/cash.service.js', import.meta.url), 'utf8')
  .replaceAll('export ', '');
const body = { pais_id: 'country', sucursal_id: 'branch', start_date: '2026-10-14', end_date: '2026-10-14', real_cash: 9315, real_qr: 9746.25 };

function route({ auth = { userId: 'operator', role: 'admin' }, branch = { id: 'branch' } } = {}) {
  const calls = [];
  const db = { from() { return { select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: branch }; } }; } };
  const context = { supabaseAdmin: db,
    requireAdminAccess: async () => auth,
    createCashClosure: async (client, payload) => { calls.push({ client, payload }); return {}; },
    NextResponse: { json: (data, options) => ({ ...data, status: options.status }) },
  };
  vm.createContext(context); vm.runInContext(routeSource, context);
  return { calls, db, post: payload => context.POST({ json: async () => payload }) };
}
test('cierre autorizado usa el cliente del servidor y el operador autenticado', async () => {
  const { calls, db, post } = route();
  assert.equal((await post({ ...body, user_id: 'forged', opening_balance: 999 })).status, 201);
  assert.equal(calls[0].client, db);
  assert.equal(calls[0].payload.user_id, 'operator');
  assert.equal(calls[0].payload.opening_balance, undefined);
  assert.equal(calls[0].payload.sucursal_id, 'branch');
});
test('no escribe cuando faltan pais/sucursal, permiso o coincidencia de sucursal', async () => {
  for (const [options, payload, expected] of [
    [{}, { ...body, sucursal_id: null }, 400],
    [{ auth: { error: 'Unauthorized', status: 401 } }, body, 401],
    [{ auth: { error: 'Forbidden', status: 403 } }, body, 403],
    [{ branch: null }, body, 400],
  ]) {
    const { calls, post } = route(options);
    assert.equal((await post(payload)).status, expected);
    assert.equal(calls.length, 0);
  }
});

function service({ existing = [], error = null, missingBank = false } = {}) {
  const writes = [];
  const db = { from(table) {
    let operation = null, row;
    return {
      select() { return this; }, eq() { return this; }, limit() { return this; },
      async maybeSingle() { return { data: { id: 'branch', pais_id: 'country' } }; },
      delete() { throw new Error('No se deben borrar cierres antes de guardarlos'); },
      insert(value) { operation = 'insert'; row = value; return this; },
      update(value) { operation = 'update'; row = value; return this; },
      async single() {
        writes.push({ operation, row });
        if (missingBank && 'opening_qr' in row) return { error: { message: 'column opening_qr does not exist' } };
        return { data: error ? null : { ...row, id: 'closure' }, error };
      },
      then(resolve) { resolve({ data: table === 'cash_closures' ? existing : [], error: null }); },
    };
  } };
  const context = {};
  vm.createContext(context); vm.runInContext(serviceSource, context);
  vm.runInContext(`getCashSummary = async () => ({ opening_balance: 9315, opening_qr: 8965,
    expected_cash: 9315, expected_qr: 9746.25, expected_bank: 9746.25 });`, context);
  return { writes, close: payload => context.createCashClosure(db, payload) };
}
test('calcula diferencias con los importes de la captura', async () => {
  const { writes, close } = service();
  const result = await close(body);
  assert.equal(result.closure.difference, 0);
  assert.equal(result.closure.qr_difference, 0);
  assert.equal(writes[0].row.sucursal_id, 'branch');
});
test('permite cerrar con efectivo y banco contados en cero', async () => {
  const { close } = service();
  const result = await close({ ...body, real_cash: 0, real_qr: 0 });
  assert.equal(result.closure.real_cash, 0);
  assert.equal(result.closure.real_qr, 0);
  await assert.rejects(() => close({ ...body, real_cash: -1 }), /real_cash/);
  await assert.rejects(() => close({ ...body, real_cash: null }), /real_cash/);
});
test('si falla un cierre repetido, actualiza sin borrar el anterior', async () => {
  const { writes, close } = service({ existing: [{ id: 'old' }], error: { message: 'Error de permisos' } });
  await assert.rejects(() => close(body), /Error de permisos/);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].operation, 'update');
});
test('mantiene compatibilidad con el esquema actual sin columnas de banco', async () => {
  const { writes, close } = service({ missingBank: true });
  const result = await close(body);
  assert.equal(result.closure.real_cash, 9315);
  assert.equal(writes.length, 2);
});
