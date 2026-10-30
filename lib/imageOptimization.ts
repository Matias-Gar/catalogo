import { resolveStorageImageUrl } from './storageImageUrl.mjs'

type ImageFormat = 'origin' | 'webp' | 'avif' | 'jpg' | 'png'

type OptimizeOptions = {
  quality?: number
  format?: ImageFormat
}

const SUPABASE_STORAGE_HOST_FRAGMENT = '.supabase.co'
const SUPABASE_STORAGE_PATH_FRAGMENT = '/storage/v1/object/'

export function isSupabaseStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname.includes(SUPABASE_STORAGE_HOST_FRAGMENT) &&
      parsed.pathname.includes(SUPABASE_STORAGE_PATH_FRAGMENT)
    )
  } catch {
    return false
  }
}

export function getOptimizedImageUrl(
  url?: string,
  _width = 800,
  _options: OptimizeOptions = {}
): string {
  // Storage object endpoints serve originals. Next/image owns actual resizing.
  return resolveStorageImageUrl(url)
}

export function buildImageSrcSet(
  url?: string,
  widths: number[] = [400, 800, 1200],
  options: OptimizeOptions = {}
): string {
  if (!url) return ""

  return widths
    .map((w) => `${getOptimizedImageUrl(url, w, options)} ${w}w`)
    .join(', ')
}
