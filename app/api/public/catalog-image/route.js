import { DEFAULT_STORAGE_ORIGIN } from '@/lib/storageImageUrl.mjs';
import { CATALOG_IMAGE_WIDTHS } from '@/lib/catalogImageLoader.mjs';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_BYTES = 16 * 1024 * 1024;

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const path = params.get('path');
  const width = params.get('w');
  const quality = params.get('q') || '75';
  if ((width !== null && !CATALOG_IMAGE_WIDTHS.includes(Number(width))) || !['75', '90'].includes(quality)) {
    return new Response('Invalid image dimensions or quality', { status: 400 });
  }
  const prefix = '/storage/v1/object/public/';
  if (!path?.startsWith(prefix) || path.includes('\\')) {
    return new Response('Invalid public image path', { status: 400 });
  }
  let origin, target;
  try {
    origin = new URL(process.env.NEXT_PUBLIC_STORAGE_URL || DEFAULT_STORAGE_ORIGIN);
    target = new URL(path, origin);
  } catch { return new Response('Invalid storage configuration', { status: 503 }); }
  if (target.origin !== origin.origin || !target.pathname.startsWith(prefix)) {
    return new Response('Invalid public image path', { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return new Response('Public image unavailable', { status: upstream.status === 404 ? 404 : 502 });
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!/^image\/(png|jpe?g|webp|avif|gif)(;|$)/i.test(contentType)) {
      await upstream.body?.cancel();
      return new Response('Unsupported image type', { status: 415 });
    }
    if (Number(upstream.headers.get('content-length')) > MAX_BYTES) {
      await upstream.body?.cancel();
      return new Response('Image too large', { status: 413 });
    }
    let body = upstream.body;
    let outputType = contentType;
    if (width !== null) {
      const reader = upstream.body?.getReader();
      if (!reader) return new Response('Empty image', { status: 502 });
      const chunks = [];
      let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) {
          await reader.cancel();
          return new Response('Image too large', { status: 413 });
        }
        chunks.push(value);
      }
      body = await sharp(Buffer.concat(chunks), { limitInputPixels: 40000000, animated: true })
        .timeout({ seconds: 10 }).rotate().resize({ width: Number(width), withoutEnlargement: true })
        .webp({ quality: Number(quality), effort: 4 }).toBuffer();
      outputType = 'image/webp';
    }
    return new Response(body, {
      headers: {
        'Content-Type': outputType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Content-Disposition': 'attachment; filename="catalog-image"',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Public image upstream timed out or failed', { status: 502 });
  }
}
