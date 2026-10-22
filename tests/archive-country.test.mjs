import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../app/admin/productos/archivar/page.js', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const product = { user_id: 1, pais_id: 'bo', sucursal_id: 'branch-bo', nombre: 'Prueba', precio: 10, stock: 2 };
function harness(context, resolveQuery = table => ({ data: table === 'productos' ? [product] : [], error: null })) {
  const states = [], effects = [], queries = [], alerts = [];
  let cursor = 0;
  const react = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useMemo: fn => fn(), useRef: () => ({}), useEffect: fn => effects.push(fn) };
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) }, from(table) { const query = { table, filters: [], mutation: null, select() { return this; }, order() { return this; }, limit() { return this; }, in() { return this; }, eq(...args) { this.filters.push(args); return this; }, update(value) { this.mutation = value; return this; }, single() { return this; }, then(ok, fail) { return Promise.resolve(resolveQuery(table, this)).then(ok, fail); } }; queries.push(query); return query; } };
  const exports = {};
  vm.runInNewContext(code, { exports, console, fetch: async () => ({ ok: false, json: async () => ({ success: false, error: 'No matching row' }) }), window: { confirm: () => true }, alert: message => alerts.push(message), require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return require(name);
    if (name.includes('SupabaseClient')) return { supabase: client };
    if (name.includes('SucursalContext')) return { useSucursalActiva: () => context };
    if (name.includes('/ui/button')) return { Button: 'button' };
    if (name.includes('/ui/card')) return Object.fromEntries(['Card', 'CardContent', 'CardFooter', 'CardHeader', 'CardTitle'].map(key => [key, 'div']));
    if (name.includes('imageOptimization')) return { getOptimizedImageUrl: value => value, buildImageSrcSet: value => value };
    if (name.includes('searchMatching')) return { productMatchesSearch: () => true };
    if (name.includes('productosHistorial')) return { registrarHistorialProducto: async () => {} };
    throw new Error(name);
  } });
  return { states, queries, alerts, render() { cursor = 0; return exports.default(); }, start() { this.render(); return effects[0](); } };
}
const scope = { activePaisId: 'bo', activeSucursalId: 'branch-bo', activePais: { nombre: 'Bolivia', moneda_simbolo: 'Bs' }, activeSucursal: { nombre: 'Central' }, loading: false };
const flush = () => new Promise(resolve => setImmediate(resolve));
function buttons(node) { if (!node || typeof node !== 'object') return []; return [...(node.type === 'button' ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(buttons)]; }

test('does not query without a fully selected country and branch', async () => {
  for (const context of [{ ...scope, loading: true }, { ...scope, activePaisId: '' }, { ...scope, activeSucursalId: '' }]) {
    const h = harness(context); h.start(); await flush(); assert.equal(h.queries.length, 0);
  }
});
test('all product, image and variant reads stay inside the selected country and branch', async () => {
  const h = harness(scope); h.start(); await flush();
  assert.equal(h.queries.length, 3);
  for (const query of h.queries) {
    assert.ok(query.filters.some(([key, value]) => key === 'pais_id' && value === 'bo'));
    assert.ok(query.filters.some(([key, value]) => key === 'sucursal_id' && value === 'branch-bo'));
  }
});
test('ignores a response that arrives after the country changes or the page unmounts', async () => {
  let resolve; const pending = new Promise(done => { resolve = done; });
  const h = harness(scope, () => pending); const cleanup = h.start(); cleanup();
  resolve({ data: [product], error: null }); await flush();
  assert.equal(h.states[0].length, 0); assert.equal(h.queries.length, 1);
});
test('hides stale country products and does not report a rejected server archive as success', async () => {
  const h = harness(scope, (table, query) => query.mutation ? { data: null, error: new Error('No matching row') } : { data: product, error: null });
  h.states[0] = [product]; h.states[4] = false;
  const action = buttons(h.render()).find(button => button.props.children === 'Archivar');
  await action.props.onClick();
  assert.equal(h.alerts.length, 1); assert.equal(h.states[0][0].archivado, undefined);
  const other = harness({ ...scope, activePaisId: 'cl', activeSucursalId: 'branch-cl' });
  other.states[0] = [product]; other.states[4] = false;
  assert.equal(buttons(other.render()).filter(button => button.props.children === 'Archivar').length, 0);
});
