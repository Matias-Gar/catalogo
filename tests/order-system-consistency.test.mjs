import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { quotePendingOrder, orderTotal, buildOrderWhatsappMessage, sameOrderRequest } from '../lib/orderPricing.mjs';
import { restorePendingOrderPricing } from '../lib/pendingOrderPricing.mjs';
import { getPromotionPrice, discountLimit } from '../lib/saleDiscountPolicy.mjs';
import { validateSaleDiscounts } from '../lib/validateSaleDiscounts.mjs';
import { products, promotions, orderItems } from './fixtures/promotion-order8.mjs';

const context = { exports: {}, require: name => name === './promociones' ? { calcularPrecioConPromocion: getPromotionPrice } : { discountLimit } };
vm.createContext(context);
vm.runInContext(ts.transpileModule(readFileSync(new URL('../lib/cartPricing.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const calculate = context.exports.calcularLineaVenta;

test('pedido 8: 1220 original, 925 con promoción, 703.78 reproduce el doble descuento', () => {
  const quoted = quotePendingOrder(orderItems, products, promotions);
  assert.equal(orderTotal(quoted), 925);
  assert.equal(orderItems.reduce((t, i) => t + i.precio_unitario * i.cantidad_base, 0), 925);
  assert.equal(orderItems.reduce((t, i) => t + getPromotionPrice({ user_id: i.producto_id, precio: i.precio_original }, promotions).precioFinal * i.cantidad_base, 0), 703.78);
  assert.equal(quoted.reduce((t, i) => t + i.precio_original * i.cantidad_base, 0), 1220);
  const rebuilt = quoted.map(item => ({ ...item, user_id: item.producto_id,
    ...restorePendingOrderPricing(item, products.find(p => p.user_id === item.producto_id)) }));
  const lines = rebuilt.map(item => calculate(item, promotions));
  assert.equal(lines.reduce((sum, line) => sum + line.total, 0), 925);
  const saleItems = rebuilt.map((item, index) => ({ ...item, precio_unitario: lines[index].precio }));
  const validation = validateSaleDiscounts({ venta: { total: 925, costos_extra: {} }, items: saleItems, products, promotions, packs: [] });
  assert.ok(validation.every(item => item.manual === 0));
  assert.match(buildOrderWhatsappMessage({ id: 8, productos: quoted }), /\*Total:\* Bs 925.00/);
  assert.equal(orderTotal(quotePendingOrder(quoted, products, promotions)), 925);
});

test('precios y metadatos manipulados no cambian la cotización del servidor', () => {
  const altered = orderItems.map(i => ({ ...i, precio_unitario: 1, precio_original: 1, promocion_aplicada: { valor: 99 } }));
  assert.equal(orderTotal(quotePendingOrder(altered, products, promotions)), 925);
});

test('rechaza variantes, cantidades y unidades que no corresponden al catálogo', () => {
  const first = orderItems[0];
  for (const change of [{ variante_id: 999 }, { variante_id: null }, { cantidad: -1 }, { cantidad_base: 'abc' }, { cantidad_base: 0.1 }, { unidad: 'metro' }])
    assert.throws(() => quotePendingOrder([{ ...first, ...change }], products, promotions));
});

test('conversión fraccionaria y packs usan la cantidad y precio de su fuente', () => {
  const product = { user_id: 1, nombre: 'Rollo', precio: 100, unidad_base: 'rollo', factor_conversion: 25, unidades_alternativas: ['metro'] };
  const items = quotePendingOrder([{ producto_id: 1, cantidad: 5, unidad: 'metro', cantidad_base: 0.2 }], [product], [{ producto_id: 1, activa: true, tipo: 'descuento', valor: 25 }]);
  assert.equal(orderTotal(items), 15);
  const packs = [{ id: 3, nombre: 'Pack', precio_pack: 80, pack_productos: [{ producto_id: 1, cantidad: 2 }] }];
  assert.equal(orderTotal(quotePendingOrder([{ tipo: 'pack', pack_id: 3, cantidad: 2, precio_unitario: 1 }], [], [], packs)), 160);
});

test('el servidor rechaza tanto un doble descuento como cobrar sin aplicar la promoción', () => {
  for (const price of [78.75, 140]) assert.throws(() => validateSaleDiscounts({
    venta: { total: price, costos_extra: {} }, items: [{ producto_id: 203, variante_id: 247, cantidad_base: 1, precio_unitario: price }],
    products, promotions, packs: [],
  }), /Debe ser Bs 105.00/);
});

test('la identidad del pedido tolera orden distinto pero detecta cantidades cambiadas', () => {
  assert.equal(sameOrderRequest(orderItems, [...orderItems].reverse()), true);
  assert.equal(sameOrderRequest(orderItems, orderItems.map((i, n) => n ? i : { ...i, cantidad: 2 })), false);
});

test('promociones con igual fecha eligen la misma oferta independientemente del orden de consulta', () => {
  const first = { id: 1, producto_id: 203, activa: true, tipo: 'descuento', valor: 10, fecha_inicio: '2026-01-01' };
  const second = { ...first, id: 2, valor: 25 };
  assert.equal(getPromotionPrice(products[0], [first, second]).precioFinal, 105);
  assert.equal(getPromotionPrice(products[0], [second, first]).precioFinal, 105);
});
