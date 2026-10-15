/** Limite para una rebaja manual de toda la linea, siempre redondeado hacia abajo. */
export function discountLimit({ price, cost, quantity, promotion = false, pack = false }) {
  const p = Number(price), c = Number(cost), q = Number(quantity);
  if (pack || promotion) return { max: 0, reason: 'No admite rebaja: producto con promocion o pack.' };
  if (cost == null || !Number.isFinite(c) || c < 0)
    return { max: 0, reason: 'Falta el costo de compra para autorizar una rebaja.' };
  if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0)
    return { max: 0, reason: 'Precio o cantidad no valido.' };
  const max = Math.floor((Math.max(0, Math.min(p * 0.25, p - c)) * q + 1e-8) * 100) / 100;
  return { max, reason: max === 0 ? 'El precio ya esta en el costo de compra o por debajo.' : 'Maximo 25% y sin vender por debajo del costo.' };
}

export function getPromotionPrice(product, promotions, now = new Date()) {
  const base = Number(product.precio_original ?? product.precio ?? 0);
  const promo = [...(promotions || [])].filter(p => String(p.producto_id) === String(product.user_id ?? product.id)
    && p.activa === true && (!p.fecha_inicio || new Date(p.fecha_inicio) <= now)
    && (!p.fecha_fin || new Date(p.fecha_fin) >= now))
    .sort((a, b) => new Date(b.fecha_inicio || 0) - new Date(a.fecha_inicio || 0))[0];
  let final = base;
  if (promo?.tipo === 'descuento') final = base * (1 - Number(promo.valor) / 100);
  if (promo?.tipo === 'precio_fijo') final = Number(promo.valor);
  if (promo?.tipo === 'descuento_absoluto') final = base - Number(promo.valor);
  final = Math.max(0, final);
  const discount = Math.max(0, base - final);
  return { precioOriginal: base, precioFinal: final, tienePromocion: !!promo,
    promocion: promo || null, descuento: discount,
    porcentajeDescuento: base > 0 ? (discount / base * 100).toFixed(0) : '0' };
}
