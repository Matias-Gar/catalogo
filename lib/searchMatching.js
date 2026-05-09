export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeBarcode(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isBarcodeSearch(value) {
  const code = normalizeBarcode(value);
  return code.length >= 6 && code === String(value || "").replace(/\s/g, "");
}

export function matchesSearchValue(value, term) {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return true;
  return normalizeSearchText(value).includes(normalizedTerm);
}

export function matchesBarcodeValue(value, term) {
  const searchCode = normalizeBarcode(term);
  const storedCode = normalizeBarcode(value);
  if (!searchCode || !storedCode) return false;
  return (
    searchCode === storedCode ||
    (searchCode.length === 13 && searchCode.slice(0, 12) === storedCode) ||
    (storedCode.length === 13 && storedCode.slice(0, 12) === searchCode)
  );
}

export function productMatchesSearch(product, term, extraValues = []) {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return true;

  const variants = Array.isArray(product?.variantes) ? product.variantes : [];
  const barcodeValues = [
    product?.codigo_barra,
    ...variants.flatMap((variant) => [
      variant?.sku,
      variant?.codigo_barra,
      variant?.codigo,
    ]),
  ];

  if (isBarcodeSearch(term)) {
    return barcodeValues.some((value) => matchesBarcodeValue(value, term));
  }

  const values = [
    product?.nombre,
    product?.descripcion,
    product?.categoria,
    product?.categorias?.categori,
    product?.user_id,
    product?.id,
    ...variants.flatMap((variant) => [
      variant?.color,
    ]),
    ...barcodeValues,
    ...extraValues,
  ];

  return values.some((value) => matchesSearchValue(value, normalizedTerm) || matchesBarcodeValue(value, normalizedTerm));
}
