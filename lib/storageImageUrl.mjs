// This project's public Storage origin. Never route another Supabase project here.
export const DEFAULT_STORAGE_ORIGIN = 'https://garblac.duckdns.org';
const CLOUD_HOST = 'gzvtuenpwndodnetnmzi.supabase.co';
const PUBLIC_OBJECT = '/storage/v1/object/public/';

export function resolveStorageImageUrl(source, origin = process.env.NEXT_PUBLIC_STORAGE_URL || DEFAULT_STORAGE_ORIGIN) {
  if (typeof source !== 'string' || !source.trim()) return '';
  const value = source.trim();
  let target;
  try {
    target = new URL(origin);
    if (!['https:', 'http:'].includes(target.protocol)) return value;
  } catch { return value; }
  if (value.startsWith(PUBLIC_OBJECT)) return target.origin + value;
  if (/^(product_images|imagenes|perfiles)\//.test(value)) return target.origin + PUBLIC_OBJECT + value;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return value;
    const ownedHosts = [CLOUD_HOST, 'garblac.duckdns.org', '192.168.0.17'];
    if (!ownedHosts.includes(parsed.hostname) && parsed.origin !== target.origin) return value;
    if (!parsed.pathname.startsWith(PUBLIC_OBJECT)) return value;
    return target.origin + parsed.pathname + parsed.search + parsed.hash;
  } catch { return value; }
}
