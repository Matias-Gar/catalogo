export function boxProductCode(product) {
  const primary = String(product.codigo_barra ?? '').trim();
  if (primary) return primary;
  return [...new Set((product.producto_variantes || [])
    .map(variant => String(variant.sku || '').trim())
    .filter(Boolean))].join(' / ');
}
