import test from 'node:test';
import assert from 'node:assert/strict';
import { priceCatalogItem } from '../lib/catalogCartPricing.mjs';

const promotions = [{ producto_id: '12', activa: true, tipo: 'descuento', valor: 25 }];

test('restaura una cesta antigua sin descontar dos veces', () => {
  const item = priceCatalogItem({ user_id: 12, precio: 75 }, promotions, [{ user_id: 12, precio: 100 }]);
  assert.equal(item.precio, 75);
  assert.equal(item.precio_original, 100);
});

test('el precio cobrado usa los mismos centavos que el precio publicado', () => {
  const item = priceCatalogItem({ user_id: 12, precio: 99.99 }, promotions);
  assert.equal(item.precio, 74.99);
  assert.equal((item.precio * 3).toFixed(2), '224.97');
});

test('corrige el precio original descontado de una cesta antigua usando el catálogo', () => {
  const item = priceCatalogItem({ user_id: 204, precio: 142.5, precio_original: 142.5 },
    [{ producto_id: 204, activa: true, tipo: 'descuento', valor: 25 }], [{ user_id: 204, precio: 190 }]);
  assert.equal(item.precio_original, 190);
  assert.equal(item.precio, 142.5);
});

test('la cesta y el pedido respetan el 25% con identificadores de distinto tipo', () => {
  const item = priceCatalogItem({ user_id: 12, precio: 100, cantidad_base: 2 }, promotions);
  assert.equal(item.precio, 75);
  assert.equal(item.precio * item.cantidad_base, 150);
  assert.equal(item.precio_original, 100);
  assert.equal(item.promocion_aplicada.valor, 25);
  assert.equal(priceCatalogItem(item, promotions).precio, 75);
  assert.equal(priceCatalogItem(item, []).precio, 100);
});

test('aplica promociones a variantes y cantidades fraccionarias sin modificar packs', () => {
  const item = priceCatalogItem({ user_id: 12, variante_id: 3, precio: 200, cantidad_base: 0.5 }, promotions);
  assert.equal(item.precio * item.cantidad_base, 75);
  const pack = { tipo: 'pack', precio: 90 };
  assert.equal(priceCatalogItem(pack, promotions), pack);
});

test('una promoción futura no cambia el pedido y una rebaja fija usa la misma base', () => {
  const item = { user_id: 12, precio: 100 };
  assert.equal(priceCatalogItem(item, [{ ...promotions[0], fecha_inicio: '2099-01-01' }]).precio, 100);
  assert.equal(priceCatalogItem(item, [{ ...promotions[0], tipo: 'precio_fijo', valor: 60 }]).precio, 60);
});
