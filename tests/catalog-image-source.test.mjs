import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { getCatalogImageSource } from '../lib/catalogImageSource.mjs';
import { DEFAULT_STORAGE_ORIGIN } from '../lib/storageImageUrl.mjs';

const path = '/storage/v1/object/public/product_images/public/photo.png';

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
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports, URL, Response, process, fetch, AbortSignal,
    require(name) {
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
