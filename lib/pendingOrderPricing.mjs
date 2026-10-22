// El precio guardado en pedidos antiguos puede estar descontado incluso en
// precio_original. Recuperar la base de la BD evita aplicar dos veces la oferta.
export function restorePendingOrderPricing(orderItem, product, variant = null) {
  const original = Number(variant?.precio ?? product.precio ?? product.precio_base);
  if (!Number.isFinite(original) || original < 0) {
    throw new Error('No se pudo verificar el precio original del producto del pedido.');
  }
  return {
    precio: Number(orderItem.precio_unitario ?? original),
    precio_original: original,
    promocion_aplicada: orderItem.promocion_aplicada || null,
  };
}
