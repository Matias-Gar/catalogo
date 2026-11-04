import { DEFAULT_STORAGE_ORIGIN, resolveStorageImageUrl } from './storageImageUrl.mjs';

// Route owned public raster images through our server before Next resizes them.
// Next's external image fetch has a fixed seven-second timeout.
export function getCatalogImageSource(source) {
  const original = resolveStorageImageUrl(source);
  try {
    const url = new URL(original);
    const origin = new URL(process.env.NEXT_PUBLIC_STORAGE_URL || DEFAULT_STORAGE_ORIGIN);
    if (url.origin === origin.origin && url.pathname.startsWith('/storage/v1/object/public/') && /\.(png|jpe?g|webp|avif|gif)$/i.test(url.pathname)) {
      return `/api/public/catalog-image?path=${encodeURIComponent(url.pathname + url.search)}`;
    }
  } catch { /* Local assets and external images keep their original source. */ }
  return original;
}
