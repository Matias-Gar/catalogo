import { NextResponse } from "next/server";
import { DEFAULT_STORAGE_ORIGIN, resolveStorageImageUrl } from '@/lib/storageImageUrl.mjs';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url || !(url.startsWith("http://") || url.startsWith("https://"))) {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }

    const target = new URL(resolveStorageImageUrl(url));
    const origin = new URL(process.env.NEXT_PUBLIC_STORAGE_URL || DEFAULT_STORAGE_ORIGIN);
    if (target.origin !== origin.origin || !target.pathname.startsWith('/storage/v1/object/public/')) {
      return NextResponse.json({ error: 'Only project public images are allowed' }, { status: 400 });
    }
    const res = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!res.ok) return NextResponse.json({ error: "fetch failed", status: res.status }, { status: 502 });

    const contentType = res.headers.get('content-type') || '';
    if (!/^image\/(png|jpe?g|webp|avif|gif)(;|$)/i.test(contentType)) {
      await res.body?.cancel();
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });
    }
    const chunks = [];
    const reader = res.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Empty image' }, { status: 502 });
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16 * 1024 * 1024) {
        await reader.cancel();
        return NextResponse.json({ error: 'Image too large' }, { status: 413 });
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    const b64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${b64}`;
    return NextResponse.json({ dataUrl });
  } catch {
    return NextResponse.json({ error: "Image unavailable" }, { status: 502 });
  }
}
