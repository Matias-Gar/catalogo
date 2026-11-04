import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { getCatalogImageSource } from '../lib/catalogImageSource.mjs';
import { DEFAULT_STORAGE_ORIGIN } from '../lib/storageImageUrl.mjs';
import { CATALOG_IMAGE_WIDTHS, catalogImageLoader, catalogImageSrcSet } from '../lib/catalogImageLoader.mjs';
import sharp from 'sharp';

const path = '/storage/v1/object/public/product_images/public/photo.png';

test('responsive descriptors match actual bounded widths and repeated loader calls replace dimensions', () => {
  const src = `https://garblac.duckdns.org${path}`;
  const first = catalogImageLoader({ src, width: 180 });
  const second = new URL(catalogImageLoader({ src: first, width: 96 }), 'https://catalog.invalid');
  assert.deepEqual(second.searchParams.getAll('w'), ['96']);
  assert.deepEqual(second.searchParams.getAll('q'), ['75']);
  const set = catalogImageSrcSet(src, [140, 180, 280]);
  assert.equal(set.split(', ').length, 2);
  for (const entry of set.split(', ')) {
    const [url, descriptor] = entry.split(' ');
    assert.equal(descriptor, new URL(url, 'https://catalog.invalid').searchParams.get('w') + 'w');
  }
  assert.equal(catalogImageSrcSet('https://external.invalid/photo.jpg', [200, 400]), '');
});

test('owned raster thumbnails use the internal source while unrelated and local sources stay intact', () => {
  assert.equal(getCatalogImageSource(`https://garblac.duckdns.org${path}`), `/api/public/catalog-image?path=${encodeURIComponent(path)}`);
  for (const src of ['/brand/logo.svg', '/photo.jpg', 'https://example.invalid/photo.png', 'data:image/png;base64,AA']) {
    assert.equal(getCatalogImageSource(src), src);
  }
  const signed = 'https://garblac.duckdns.org/storage/v1/object/sign/private/a.png?token=example';
  assert.equal(getCatalogImageSource(signed), signed);
});

function loadRoute(fetch) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL('../app/api/public/catalog-image/route.js', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, URL, Response, process, fetch, AbortSignal, Buffer,
    require(name) {
      if (name === 'sharp') return sharp;
      if (name === '@/lib/catalogImageLoader.mjs') return { CATALOG_IMAGE_WIDTHS };
      assert.equal(name, '@/lib/storageImageUrl.mjs');
      return { DEFAULT_STORAGE_ORIGIN };
    },
  });
  return exports.GET;
}

const request = (value) => ({ url: `https://catalog.example.invalid/api/public/catalog-image?path=${encodeURIComponent(value)}` });

test('image source rejects external, private and traversing paths without fetching', async () => {
  const GET = loadRoute(() => { assert.fail('invalid paths must not fetch'); });
  for (const value of ['', 'https://evil.invalid/a.png', '//evil.invalid/a.png', '/storage/v1/object/sign/private/a.png', '/storage/v1/object/public/../../private/a.png', '/storage/v1/object/public/\\evil.invalid/a.png']) {
    assert.equal((await GET(request(value))).status, 400);
  }
});

test('public image source streams the image and prevents redirects to another origin', async () => {
  let called = false;
  const GET = loadRoute(async (url, options) => {
    called = true;
    assert.equal(url.href, `https://garblac.duckdns.org${path}`);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
  });
  const response = await GET(request(path));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.match(response.headers.get('cache-control'), /s-maxage=86400/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  assert.equal(called, true);
});

test('missing files, non-images and upstream failures are controlled responses', async () => {
  for (const [fetch, status] of [
    [async () => new Response('missing', { status: 404 }), 404],
    [async () => new Response('unavailable', { status: 500 }), 502],
    [async () => new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } }), 415],
    [async () => { throw new Error('timeout'); }, 502],
  ]) {
    assert.equal((await loadRoute(fetch)(request(path))).status, status);
  }
});

test('thumbnail service resizes real pixels to WebP and keeps responsive URLs distinct', async () => {
  const original = await sharp({ create: { width: 1200, height: 800, channels: 4, background: '#ff000080' } }).png().toBuffer();
  const GET = loadRoute(async () => new Response(original, { headers: { 'content-type': 'image/png' } }));
  for (const width of [48, 96, 384]) {
    const url = catalogImageLoader({ src: `https://garblac.duckdns.org${path}`, width });
    const response = await GET({ url: `https://catalog.example.invalid${url}` });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    const bytes = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, Math.round(width * 2 / 3));
    assert.equal(metadata.hasAlpha, true);
    assert.ok(bytes.length < original.length);
  }
});

test('arbitrary transform sizes and qualities cannot exhaust the thumbnail service', async () => {
  const GET = loadRoute(() => assert.fail('invalid transforms must not fetch'));
  for (const query of ['&w=999999', '&w=0', '&w=-1', '&w=NaN', '&w=96&q=100']) {
    assert.equal((await GET({ url: request(path).url + query })).status, 400);
  }
});

test('corrupt images and oversized originals are rejected without a successful cache entry', async () => {
  for (const [body, headers, status] of [
    ['corrupt', { 'content-type': 'image/png' }, 502],
    ['large', { 'content-type': 'image/png', 'content-length': String(17 * 1024 * 1024) }, 413],
  ]) {
    const GET = loadRoute(async () => new Response(body, { headers }));
    const response = await GET({ url: request(path).url + '&w=96' });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), null);
  }
});
