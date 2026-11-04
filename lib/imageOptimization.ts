import { resolveStorageImageUrl } from './storageImageUrl.mjs'
import { catalogImageLoader, catalogImageSrcSet } from './catalogImageLoader.mjs'

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
  width = 800,
  options: OptimizeOptions = {}
): string {
  return catalogImageLoader({ src: resolveStorageImageUrl(url), width, quality: Number(options.quality) >= 90 ? 90 : 75 })
}

export function buildImageSrcSet(
  url?: string,
  widths: number[] = [400, 800, 1200],
  options: OptimizeOptions = {}
): string {
  if (!url) return ""

  return catalogImageSrcSet(resolveStorageImageUrl(url), widths, Number(options.quality) >= 90 ? 90 : 75)
}
