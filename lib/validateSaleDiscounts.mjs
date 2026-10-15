import { discountLimit, getPromotionPrice } from './saleDiscountPolicy.mjs';

const cents = n => Math.round(Number(n) * 100);
const key = (product, variant) => `${product}:${variant ?? ''}`;

// Se valida con precios/costos actuales de la base, nunca con los datos del navegador.
export function validateSaleDiscounts({ venta, items, products, promotions, packs }) {
  for (const field of ['envio', 'comision', 'impuestos', 'publicidad', 'rebajas']) {
    const value = Number(venta.costos_extra?.[field] || 0);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Importe invalido en ${field}.`);
  }
  if (Number(venta.costos_extra?.rebajas || 0) !== 0)
    throw new Error('Aplica las rebajas por producto para respetar el limite del 25% y el costo.');
  const snapshots = [];
  const packGroups = new Map();
  let productTotal = 0;
  for (const item of items) {
    const product = products.find(p => String(p.user_id) === String(item.producto_id));
    if (!product) throw new Error('Producto no disponible en esta sucursal.');
    const quantity = Number(item.cantidad_base ?? item.cantidad);
    const price = Number(item.precio_unitario);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0)
      throw new Error('Cantidad o precio de venta invalido.');
    if (item.pack_id != null) {
      const pack = packs.find(p => String(p.id) === String(item.pack_id));
      const count = Number(item.pack_cantidad);
      if (!pack || !Number.isFinite(count) || count <= 0 || price !== 0)
        throw new Error('Pack invalido o con una rebaja adicional no permitida.');
      const group = packGroups.get(String(pack.id)) || { pack, count, quantities: new Map() };
      if (group.count !== count) throw new Error('Cantidad de pack inconsistente.');
      const id = key(item.producto_id, item.variante_id);
      group.quantities.set(id, (group.quantities.get(id) || 0) + quantity);
      packGroups.set(String(pack.id), group);
      continue;
    }
    const variant = item.variante_id == null ? null
      : product.producto_variantes?.find(v => String(v.id) === String(item.variante_id));
    if (item.variante_id != null && !variant) throw new Error('Variante no disponible.');
    const original = Number(variant?.precio ?? product.precio);
    const info = getPromotionPrice({ ...product, precio: original }, promotions);
    const inPack = packs.some(p => p.pack_productos?.some(i => String(i.producto_id) === String(product.user_id)));
    const limit = discountLimit({ price: original, cost: product.precio_compra, quantity,
      promotion: info.tienePromocion, pack: inPack });
    const manual = Math.max(0, cents((info.precioFinal - price) * quantity)) / 100;
    if (manual > limit.max + 0.000001)
      throw new Error(`${product.nombre}: rebaja no permitida. Maximo Bs ${limit.max.toFixed(2)}. ${limit.reason}`);
    productTotal += cents(price * quantity) / 100;
    snapshots.push({ producto_id: String(product.user_id), variante_id: item.variante_id == null ? null : String(item.variante_id),
      bruto: original * quantity, total: cents(price * quantity) / 100, manual, maxManual: limit.max,
      precioOriginal: original, precio: price, descuento: (original - price) * quantity,
      descuentoUnitario: original - price });
    item.costo_unitario = Number(product.precio_compra || 0);
  }
  for (const { pack, count, quantities } of packGroups.values()) {
    const expected = new Map();
    for (const i of pack.pack_productos || []) {
      const id = key(i.producto_id, i.variante_id);
      expected.set(id, (expected.get(id) || 0) + Number(i.cantidad) * count);
    }
    if (!expected.size || expected.size !== quantities.size || [...expected].some(([id, qty]) => Math.abs(qty - (quantities.get(id) || 0)) > 0.0001))
      throw new Error('El contenido del pack no coincide con su configuracion actual.');
    productTotal += Number(pack.precio_pack) * count;
  }
  const extras = venta.costos_extra || {};
  const expectedTotal = productTotal + Number(extras.envio || 0) + Number(extras.comision || 0)
    + Number(extras.impuestos || 0) - Number(extras.publicidad || 0);
  if (!Number.isFinite(expectedTotal) || !Number.isFinite(Number(venta.total)) || Math.abs(cents(Math.max(0, expectedTotal)) - cents(venta.total)) > 1)
    throw new Error('El total no coincide con los precios autorizados. Actualiza el carrito e intenta otra vez.');
  venta.costos_extra = { ...extras, descuentos_productos: snapshots };
  return snapshots;
}
