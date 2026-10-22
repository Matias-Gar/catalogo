import test from 'node:test';
import assert from 'node:assert/strict';
import { discountLimit, getPromotionPrice } from '../lib/saleDiscountPolicy.mjs';
import { validateSaleDiscounts } from '../lib/validateSaleDiscounts.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = { exports: {}, require: path => path === './promociones'
  ? { calcularPrecioConPromocion: getPromotionPrice } : { discountLimit } };
vm.createContext(context);
vm.runInContext(ts.transpileModule(readFileSync(new URL('../lib/cartPricing.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const calculateCart = context.exports.calcularLineaVenta;

test('tope 25%: costo 150, venta 450 permite 112.50', () => {
  assert.equal(discountLimit({ price: 450, cost: 150, quantity: 1 }).max, 112.5);
});
test('el costo es un piso mas estricto que el 25%', () => {
  assert.equal(discountLimit({ price: 200, cost: 190, quantity: 2 }).max, 20);
  assert.equal(discountLimit({ price: 200, cost: 200, quantity: 1 }).max, 0);
  assert.equal(discountLimit({ price: 200, cost: 220, quantity: 1 }).max, 0);
});
test('cantidades fraccionarias y centavos no exceden el limite', () => {
  assert.equal(discountLimit({ price: 99.99, cost: 10, quantity: 0.5 }).max, 12.49);
});

test('la cesta y el servidor coinciden en los centavos de la rebaja máxima fraccionaria', () => {
  for (const quantity of [0.1, 0.3, 0.5, 0.333333, 1.01]) {
    const line = calculateCart({ user_id: 1, precio: 99.99, precio_compra: 10, cantidad_base: quantity, descuento_manual: 100 }, []);
    assert.ok(line.manual <= discountLimit({ price: 99.99, cost: 10, quantity }).max);
    const input = sale(line.precio);
    input.products[0].precio = 99.99;
    input.products[0].precio_compra = 10;
    input.items[0].cantidad_base = quantity;
    input.venta.total = line.total;
    validateSaleDiscounts(input);
  }
});

test('el precio unitario no cambia al redondear una cantidad convertida', () => {
  const line = calculateCart({ user_id: 1, precio: 100, cantidad_base: 0.333333 },
    [{ producto_id: 1, activa: true, tipo: 'descuento', valor: 25 }]);
  assert.equal(line.precio, 75);
  assert.equal(line.total, 25);
});
test('carrito y servidor coinciden al limitar un descuento heredado excesivo', () => {
  const cart = calculateCart({ user_id: 1, precio: 450, precio_compra: 150, cantidad: 1, descuento_manual: 400 }, []);
  assert.equal(cart.manual, 112.5);
  assert.equal(cart.total, 337.5);
  validateSaleDiscounts(sale(cart.precio));
});
test('una promocion nueva invalida la rebaja previamente guardada en el carrito', () => {
  const product = { user_id: 1, precio: 450, precio_compra: 150, cantidad: 1, descuento_manual: 100 };
  const promo = [{ producto_id: 1, activa: true, tipo: 'precio_fijo', valor: 350 }];
  const cart = calculateCart(product, promo);
  assert.equal(cart.manual, 0);
  assert.equal(cart.total, 350);
  const packCart = calculateCart(product, [], [{ pack_productos: [{ productos: { user_id: 1 } }] }]);
  assert.equal(packCart.manual, 0);
});
test('promocion, pack y costo desconocido bloquean rebaja manual', () => {
  for (const options of [{ promotion: true }, { pack: true }, { cost: undefined }])
    assert.equal(discountLimit({ price: 450, cost: 150, quantity: 1, ...options }).max, 0);
});

function sale(price = 337.5) {
  return { venta: { total: price, costos_extra: {} },
    items: [{ producto_id: 1, cantidad_base: 1, precio_unitario: price }],
    products: [{ user_id: 1, nombre: 'Producto', precio: 450, precio_compra: 150 }],
    promotions: [], packs: [] };
}
test('servidor acepta el limite exacto y guarda la rebaja real', () => {
  const input = sale();
  const result = validateSaleDiscounts(input);
  assert.equal(result[0].manual, 112.5);
  assert.equal(input.items[0].costo_unitario, 150);
  assert.equal(input.venta.costos_extra.descuentos_productos[0].total, 337.5);
});
test('servidor rechaza 400 de descuento aunque se manipule el navegador', () => {
  assert.throws(() => validateSaleDiscounts(sale(50)), /rebaja no permitida/);
  assert.throws(() => validateSaleDiscounts(sale(337.49)), /rebaja no permitida/);
});
test('servidor usa costo actual, no el costo enviado por el navegador', () => {
  const input = sale(337.5);
  input.products[0].precio_compra = 400;
  input.items[0].costo_unitario = 1;
  assert.throws(() => validateSaleDiscounts(input), /Maximo Bs 50.00/);
});
test('promociones permiten solo su precio, sin rebaja adicional', () => {
  const input = sale(350);
  input.promotions = [{ producto_id: 1, activa: true, tipo: 'precio_fijo', valor: 350 }];
  validateSaleDiscounts(input);
  input.items[0].precio_unitario = 349;
  assert.throws(() => validateSaleDiscounts(input), /promocion o pack/);
});
test('productos incluidos en pack vigente tampoco admiten rebaja individual', () => {
  const input = sale();
  input.packs = [{ id: 3, pack_productos: [{ producto_id: 1 }] }];
  assert.throws(() => validateSaleDiscounts(input), /promocion o pack/);
});
test('rebaja general sin limite porcentual y total verificado', () => {
  const global = sale(); global.venta.costos_extra.rebajas = 300;
  global.venta.total = 37.5;
  validateSaleDiscounts(global);
  global.venta.costos_extra.rebajas = 500;
  global.venta.total = 0;
  validateSaleDiscounts(global);
  const total = sale(); total.venta.total = 1;
  assert.throws(() => validateSaleDiscounts(total), /total no coincide/);
});
test('un pack conserva su precio y exige contenido y cantidades correctos', () => {
  const input = sale(300);
  input.packs = [{ id: 3, precio_pack: 300, pack_productos: [{ producto_id: 1, variante_id: null, cantidad: 1 }] }];
  input.items[0] = { producto_id: 1, cantidad_base: 1, precio_unitario: 0, pack_id: 3, pack_cantidad: 1 };
  validateSaleDiscounts(input);
  input.venta.total = 250;
  assert.throws(() => validateSaleDiscounts(input), /total no coincide/);
  input.items[0].cantidad_base = 2;
  assert.throws(() => validateSaleDiscounts(input), /contenido del pack/);
});
test('solo una promocion vigente bloquea las rebajas', () => {
  const p = { user_id: 1, precio: 450 };
  const promos = [{ producto_id: 1, activa: true, tipo: 'descuento', valor: 10, fecha_inicio: '2030-01-01' }];
  assert.equal(getPromotionPrice(p, promos, new Date('2026-10-14')).tienePromocion, false);
  assert.equal(getPromotionPrice(p, promos, new Date('2031-01-01')).precioFinal, 405);
});


test('70 Bs por unidad en 10 productos de 450 cobra 3800', () => {
  const cart = calculateCart({ user_id: 1, precio: 450, precio_compra: 150, cantidad: 10, descuento_manual: 70 }, []);
  assert.equal(cart.manualUnitario, 70);
  assert.equal(cart.manual, 700);
  assert.equal(cart.total, 3800);
  const input = sale(cart.precio);
  input.items[0].cantidad_base = 10;
  input.venta.total = 3800;
  assert.equal(validateSaleDiscounts(input)[0].manual, 700);
});

test('el limite por unidad no crece al aumentar cantidad', () => {
  const cart = calculateCart({ user_id: 1, precio: 450, precio_compra: 150, cantidad: 10, descuento_manual: 200 }, []);
  assert.equal(cart.maxManual, 112.5);
  assert.equal(cart.manualUnitario, 112.5);
  assert.equal(cart.manual, 1125);
  assert.equal(cart.total, 3375);
});

test('rebaja por producto y general se aplican juntas', () => {
  const input = sale(380);
  input.items[0].cantidad_base = 10;
  input.venta.costos_extra.rebajas = 1500;
  input.venta.total = 2300;
  validateSaleDiscounts(input);
});
