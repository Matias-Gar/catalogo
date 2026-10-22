import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { restorePendingOrderPricing } from '../lib/pendingOrderPricing.mjs';
import { discountLimit, getPromotionPrice } from '../lib/saleDiscountPolicy.mjs';
import { validateSaleDiscounts } from '../lib/validateSaleDiscounts.mjs';

const context = { exports: {}, require: path => path === './promociones'
  ? { calcularPrecioConPromocion: getPromotionPrice } : { discountLimit } };
vm.createContext(context);
vm.runInContext(ts.transpileModule(readFileSync(new URL('../lib/cartPricing.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const calculate = context.exports.calcularLineaVenta;
const promotions = [{ producto_id: 204, activa: true, tipo: 'descuento', valor: 25 }];
const product = { user_id: 204, nombre: 'El Secreto de las Calaveras', precio: 190,
  precio_compra: 80, producto_variantes: [{ id: 248, precio: null }] };
const oldOrder = { producto_id: 204, variante_id: 248, cantidad: 2, cantidad_base: 2,
  precio_unitario: 142.5, precio_original: 142.5, promocion_aplicada: null };

function validate(line, variant = 248, currentProduct = product, promos = promotions) {
  return validateSaleDiscounts({ venta: { total: line.total, costos_extra: {} },
    items: [{ producto_id: 204, variante_id: variant, cantidad_base: 2, precio_unitario: line.precio }],
    products: [currentProduct], promotions: promos, packs: [] });
}

test('reproduce el rechazo del pedido original: aplicar dos veces 25% envía 106.88', () => {
  const broken = calculate({ ...oldOrder, user_id: 204, precio: 142.5 }, promotions);
  assert.equal(broken.precio, 106.88);
  assert.throws(() => validate(broken), /rebaja no permitida/);
});

for (const metadata of [
  { precio_original: 142.5, promocion_aplicada: null },
  { precio_original: undefined, promocion_aplicada: undefined },
  { precio_original: 190, promocion_aplicada: promotions[0] },
]) {
  test(`pedido a venta recupera base 190 (referencia guardada: ${metadata.precio_original})`, () => {
    const pricing = restorePendingOrderPricing({ ...oldOrder, ...metadata }, product, product.producto_variantes[0]);
    const line = calculate({ ...oldOrder, user_id: 204, ...pricing }, promotions);
    assert.equal(pricing.precio_original, 190);
    assert.equal(line.precio, 142.5);
    assert.equal(line.total, 285);
    assert.equal(validate(line)[0].manual, 0);
  });
}

test('la variante con precio propio usa su base, no el precio general ni el descontado', () => {
  const variant = { id: 248, precio: 240 };
  const pricing = restorePendingOrderPricing(oldOrder, product, variant);
  const line = calculate({ ...oldOrder, user_id: 204, ...pricing }, promotions);
  assert.equal(line.precio, 180);
  assert.equal(line.total, 360);
  validate(line, 248, { ...product, producto_variantes: [variant] });
});

test('precio fijo y 100% se convierten sin rebaja manual adicional', () => {
  for (const promo of [{ ...promotions[0], tipo: 'precio_fijo', valor: 120 }, { ...promotions[0], valor: 100 }]) {
    const pricing = restorePendingOrderPricing({ ...oldOrder, precio_unitario: 0 }, product);
    assert.equal(pricing.precio, 0);
    const line = calculate({ ...oldOrder, user_id: 204, ...pricing }, [promo]);
    assert.equal(line.precio, promo.tipo === 'precio_fijo' ? 120 : 0);
    validate(line, 248, product, [promo]);
  }
});

test('sin precio verificable bloquea la conversión en lugar de reutilizar un precio descontado', () => {
  assert.throws(() => restorePendingOrderPricing(oldOrder, {}), /verificar el precio/);
});

test('el servidor sigue rechazando una rebaja extra bajo el precio de promoción', () => {
  assert.throws(() => validate({ precio: 140, total: 280 }), /rebaja no permitida/);
});

test('endpoint real de efectivización acepta Bs 285 y llega al guardado sin descuento duplicado', async () => {
  const source = readFileSync(new URL('../app/api/admin/ventas/crear/route.js', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const calls = [];
  const db = {
    from(table) {
      const query = { select() { return this; }, in() { return this; }, eq() { return this; },
        then(ok, fail) { return Promise.resolve({ data: table === 'productos' ? [product] : table === 'promociones' ? promotions : [] }).then(ok, fail); } };
      return query;
    },
    async rpc(name, args) { calls.push({ name, args }); return { data: { id: 999, estado: 'efectivizada' } }; },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } };
    if (name.includes('SupabaseAdminClient')) return { supabaseAdmin: db };
    if (name.includes('adminAccess')) return { requireAdminAccess: async () => ({ userId: 'test', role: 'admin', email: 'test@example.test' }) };
    if (name.includes('validateSaleDiscounts')) return { validateSaleDiscounts };
    if (name === 'node:crypto') return { randomUUID: () => 'test-id' };
    throw new Error(name);
  } });
  const post = async line => exports.POST({ headers: { get: () => 'test-id' }, json: async () => ({
    venta: { pais_id: 'bo', sucursal_id: 'test', total: line.total, costos_extra: {} },
    items: [{ producto_id: 204, variante_id: 248, cantidad_base: 2, precio_unitario: line.precio }],
    pagos: [{ metodo_pago: 'efectivo', monto: line.total }], pending_order_id: 5,
  }) });
  const broken = calculate({ ...oldOrder, user_id: 204, precio: 142.5 }, promotions);
  assert.equal((await post(broken)).status, 400);
  assert.equal(calls.length, 0);
  const fixed = calculate({ ...oldOrder, user_id: 204, ...restorePendingOrderPricing(oldOrder, product) }, promotions);
  const result = await post(fixed);
  assert.equal(result.status, 200);
  assert.equal(result.data.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'crear_venta_completa_segura');
  assert.equal(calls[0].args.p_venta.total, 285);
  assert.equal(calls[0].args.p_items[0].precio_unitario, 142.5);
  assert.equal(calls[0].args.p_venta.costos_extra.descuentos_productos[0].manual, 0);
  assert.equal(calls[0].args.p_pending_order_id, 5);
});
