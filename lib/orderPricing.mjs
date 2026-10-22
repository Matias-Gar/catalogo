import { getPromotionPrice } from './saleDiscountPolicy.mjs';

export const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const orderLineTotal = item => money(Number(item.precio_unitario) * Number(item.cantidad_base ?? item.cantidad));
export const orderTotal = items => money(items.reduce((total, item) => total + orderLineTotal(item), 0));

export function sameOrderRequest(first, second) {
  const identity = items => items.map(item => JSON.stringify([item.tipo === 'pack' ? 'pack' : 'producto',
    String(item.pack_id ?? item.producto_id), String(item.variante_id ?? ''), item.tipo === 'pack' ? '' : (item.unidad || item.unidad_base || 'unidad'),
    Number(item.cantidad)])).sort();
  return JSON.stringify(identity(first)) === JSON.stringify(identity(second));
}

// Cotización del servidor: ni los precios ni las conversiones del navegador son autoridad.
export function quotePendingOrder(items, products, promotions, packs = [], now = new Date()) {
  return items.map(item => {
    const quantity = Number(item.cantidad);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Cantidad inválida en el pedido.');
    if (item.tipo === 'pack') {
      const pack = packs.find(p => String(p.id) === String(item.pack_id));
      if (!pack || pack.activo === false || (pack.fecha_inicio && new Date(pack.fecha_inicio) > now)
          || (pack.fecha_fin && new Date(pack.fecha_fin) < now) || !Number.isInteger(quantity))
        throw new Error('Pack no disponible o cantidad inválida.');
      const price = Number(pack.precio_pack);
      if (!Number.isFinite(price) || price < 0) throw new Error('Precio de pack inválido.');
      return { tipo: 'pack', pricing_version: 1, pack_id: pack.id, nombre: pack.nombre,
        cantidad: quantity, cantidad_base: quantity, precio_unitario: price,
        productos: (pack.pack_productos || []).map(p => ({ producto_id: p.producto_id,
          variante_id: p.variante_id ?? null, cantidad: Number(p.cantidad) })) };
    }
    const product = products.find(p => String(p.user_id) === String(item.producto_id));
    if (!product) throw new Error('Producto no disponible en esta sucursal.');
    const variants = product.producto_variantes || [];
    const variant = item.variante_id == null ? null : variants.find(v => String(v.id) === String(item.variante_id));
    if ((item.variante_id != null && (!variant || variant.activo === false))
        || (item.variante_id == null && variants.some(v => v.activo !== false)))
      throw new Error('Selecciona una variante válida para el producto.');
    const original = Number(variant?.precio ?? product.precio);
    if (!Number.isFinite(original) || original < 0) throw new Error('Precio de producto inválido.');
    const baseUnit = product.unidad_base || 'unidad';
    const unit = item.unidad || baseUnit;
    const factor = Number(product.factor_conversion);
    const alternatives = product.unidades_alternativas || [];
    if (unit !== baseUnit && (!alternatives.includes(unit) || !Number.isFinite(factor) || factor <= 0))
      throw new Error('Unidad de venta inválida.');
    const baseQuantity = unit === baseUnit ? quantity : quantity / factor;
    if (item.cantidad_base != null && (!Number.isFinite(Number(item.cantidad_base)) || Math.abs(Number(item.cantidad_base) - baseQuantity) > 0.0001))
      throw new Error('La cantidad base del pedido no coincide con su unidad.');
    const price = getPromotionPrice({ ...product, precio_original: original }, promotions, now);
    return { tipo: 'producto', pricing_version: 1, producto_id: product.user_id,
      variante_id: variant?.id ?? null, color: variant?.color ?? null, nombre: product.nombre,
      unidad: unit, unidad_base: baseUnit, unidades_alternativas: alternatives,
      factor_conversion: factor > 0 ? factor : null, cantidad: quantity, cantidad_base: baseQuantity,
      precio_unitario: price.precioFinal, precio_original: price.precioOriginal, promocion_aplicada: price.promocion };
  });
}

// El mensaje usa el pedido devuelto por el servidor, nunca otra cesta recalculada.
export function buildOrderWhatsappMessage({ id, productos, nombre = '', nit = '' }) {
  const lines = productos.map(item => {
    const quantity = item.tipo === 'pack' ? `x${item.cantidad}` : `${item.cantidad} ${item.unidad || item.unidad_base || 'unidad'}`;
    const promotion = item.promocion_aplicada
      ? ` [Promoción: antes Bs ${money(Number(item.precio_original) * Number(item.cantidad_base ?? item.cantidad)).toFixed(2)}]` : '';
    return `*${quantity}* ${item.nombre} - (Bs ${orderLineTotal(item).toFixed(2)})${promotion}`;
  });
  return `¡Hola! Me gustaría hacer el siguiente pedido:\n\nN° Pedido: ${id}\n${nombre ? `Nombre: ${nombre}\n` : ''}${nit ? `NIT/CI: ${nit}\n` : ''}\n${lines.join('\n')}\n\n*Total:* Bs ${orderTotal(productos).toFixed(2)}\n\n¡Gracias!`;
}
