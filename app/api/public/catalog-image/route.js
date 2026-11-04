import { DEFAULT_STORAGE_ORIGIN } from '@/lib/storageImageUrl.mjs';

export const runtime = 'nodejs';

export async function GET(request) {
  const path = new URL(request.url).searchParams.get('path');
  const prefix = '/storage/v1/object/public/';
  if (!path?.startsWith(prefix) || path.includes('\\')) {
    return new Response('Invalid public image path', { status: 400 });
  }
  const origin = new URL(process.env.NEXT_PUBLIC_STORAGE_URL || DEFAULT_STORAGE_ORIGIN);
  const target = new URL(path, origin);
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
    return new Response(upstream.body, {
      headers: {
        'Content-Type': contentType,
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
