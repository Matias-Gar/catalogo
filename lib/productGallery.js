import { resolveStorageImageUrl } from './storageImageUrl.mjs';
// Keep the displayed photo and the viewer's photo list in the same order.
export function getProductGallery(primary, images = []) {
  return [...new Set([primary, ...images].map((url) => resolveStorageImageUrl(url)).filter(Boolean))];
}
