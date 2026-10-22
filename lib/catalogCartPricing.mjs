import { getPromotionPrice } from './saleDiscountPolicy.mjs';

// Conservar la base evita aplicar dos veces una promoción al restaurar la cesta.
export function priceCatalogItem(item, promotions, products = []) {
  if (item.tipo === 'pack') return item;
  const product = products.find(p => String(p.user_id) === String(item.user_id));
  const variant = item.variante_id == null ? null : product?.variantes?.find(
    v => String(v.variante_id ?? v.id) === String(item.variante_id));
  // Las cestas antiguas no guardaban el precio original; recuperarlo del catálogo.
  const original = variant?.precio ?? product?.precio ?? item.precio_original ?? item.precio;
  const price = getPromotionPrice({ ...item, precio_original: original }, promotions);
  return {
    ...item,
    precio: price.precioFinal,
    precio_original: price.precioOriginal,
    promocion_aplicada: price.promocion,
  };
}
