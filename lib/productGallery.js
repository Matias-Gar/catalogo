// Keep the displayed photo and the viewer's photo list in the same order.
export function getProductGallery(primary, images = []) {
  return [...new Set([primary, ...images].filter((url) => typeof url === 'string' && url.trim()).map((url) => url.trim()))];
}
