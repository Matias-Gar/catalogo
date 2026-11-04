import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function optimizer(overrides = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/imageUploadOptimization.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports, window: {}, File,
    URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL() {} },
    Image: class { set src(_value) { this.onerror(); } },
    ...overrides,
  });
  return exports.optimizeImageForUpload;
}

test('a decode failure cannot silently upload an original above the configured hard limit', async () => {
  const file = new File([new Uint8Array(200)], 'photo.jpg', { type: 'image/jpeg' });
  await assert.rejects(optimizer()(file, { hardMaxBytes: 100 }), /imagen más pequeña/);
});

test('missing canvas and failed encoders cannot bypass the hard limit, even when target is larger', async () => {
  for (const canvas of [
    { getContext: () => null },
    { getContext: () => ({ drawImage() {} }), toBlob: callback => callback(null) },
  ]) {
    const optimize = optimizer({
      Image: class { naturalWidth = 10; naturalHeight = 10; set src(_value) { this.onload(); } },
      document: { createElement: () => canvas },
    });
    const file = new File([new Uint8Array(200)], 'photo.jpg', { type: 'image/jpeg' });
    await assert.rejects(optimize(file, { hardMaxBytes: 100, targetMaxBytes: 300 }), /imagen más pequeña/);
  }
});

test('a small original remains available if the browser cannot decode it for optimization', async () => {
  const file = new File([new Uint8Array(80)], 'photo.jpg', { type: 'image/jpeg' });
  const result = await optimizer()(file, { hardMaxBytes: 100 });
  assert.equal(result.file, file);
  assert.equal(result.optimized, false);
});

test('preserving GIF/SVG without recompression does not bypass the file size limit', async () => {
  for (const type of ['image/gif', 'image/svg+xml']) {
    const file = new File([new Uint8Array(200)], 'image', { type });
    await assert.rejects(optimizer()(file, { hardMaxBytes: 100 }), /límite permitido/);
    const small = new File([new Uint8Array(80)], 'image', { type });
    assert.equal((await optimizer()(small, { hardMaxBytes: 100 })).file, small);
  }
});
