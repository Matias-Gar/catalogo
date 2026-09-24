import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require, process, URL, AbortController, setTimeout, clearTimeout });
  return exports;
}
const { runCatalogQuery } = load('../lib/catalogRequest.js');
const CatalogImage = load('../components/CatalogImage.jsx').default;
const { ImageConfigContext } = require('next/dist/shared/lib/image-config-context.shared-runtime');
const { imageConfigDefault } = require('next/dist/shared/lib/image-config');
const imageConfig = { ...imageConfigDefault, ...load('../next.config.ts').default.images };

test('returns catalog results without waiting for the deadline', async () => {
  const result = { data: [{ producto_id: 1 }], error: null };
  assert.equal(await runCatalogQuery({ abortSignal: () => Promise.resolve(result) }, 100), result);
});

test('stops waiting and aborts stalled requests, including auth lock waits', async () => {
  let signal;
  await assert.rejects(runCatalogQuery({ abortSignal(value) { signal = value; return new Promise(() => {}); } }, 10), /tardando demasiado/);
  assert.equal(signal.aborted, true);
});

test('propagates network failures to the retry UI', async () => {
  await assert.rejects(runCatalogQuery({ abortSignal: () => Promise.reject(new Error('Sin conexión')) }, 100), /Sin conexión/);
});

test('catalog thumbnails use the real Next image optimizer at quality 75', () => {
  const src = 'https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/product_images/public/photo.png';
  const html = renderToStaticMarkup(React.createElement(ImageConfigContext.Provider, { value: imageConfig },
    React.createElement(CatalogImage, { sources: [src], alt: 'Gafas', sizes: '50vw' })));
  assert.match(html, /\/_next\/image\?url=/);
  assert.match(html, /q=75/);
  assert.doesNotMatch(html, /format=origin|quality=96/);
});

test('missing images have a local visible placeholder', () => {
  const html = renderToStaticMarkup(React.createElement(CatalogImage, { sources: [null, ''], alt: 'Gafas' }));
  assert.match(html, /Sin imagen/);
  assert.doesNotMatch(html, /https?:/);
});
