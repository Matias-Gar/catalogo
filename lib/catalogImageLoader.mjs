import { getCatalogImageSource } from './catalogImageSource.mjs';

// Keep the same bounded sizes in Next's srcset and in the image service.
export const CATALOG_IMAGE_WIDTHS = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

export function catalogImageLoader({ src, width, quality = 75 }) {
  const source = getCatalogImageSource(src);
  if (!source.startsWith('/api/public/catalog-image?')) return source;
  const size = CATALOG_IMAGE_WIDTHS.find(value => value >= width) || 3840;
  const url = new URL(source, 'https://catalog.invalid');
  url.searchParams.set('w', String(size));
  url.searchParams.set('q', quality === 90 ? '90' : '75');
  return url.pathname + url.search;
}

export function catalogImageSrcSet(src, widths, quality = 75) {
  if (!getCatalogImageSource(src).startsWith('/api/public/catalog-image?')) return '';
  const urls = [...new Set(widths.map(width => catalogImageLoader({ src, width, quality })))];
  return urls.map(url => `${url} ${new URL(url, 'https://catalog.invalid').searchParams.get('w')}w`).join(', ');
}
