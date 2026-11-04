import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import { DEFAULT_STORAGE_ORIGIN, resolveStorageImageUrl } from '../lib/storageImageUrl.mjs';

function load(file, { env = {}, fetch = () => assert.fail('Unexpected network access'), auth } = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports, process: { env }, URL, Response, Buffer, AbortSignal, fetch, console,
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
      if (name === 'node:crypto') return crypto;
      if (name === '@supabase/supabase-js') return { createClient: () => ({}) };
      if (name === '@/lib/storageImageUrl.mjs') return { DEFAULT_STORAGE_ORIGIN, resolveStorageImageUrl };
      if (name === '@/lib/adminAccess') return { requireAdminAccess: auth };
      if (name === '@/lib/SupabaseClient') return { supabase: {} };
      if (name === '@/lib/FacebookCatalogAPI') return { FacebookCatalogAPI: class { constructor() { assert.fail('Unauthorized catalog mutation'); } } };
      assert.fail(`Unexpected import ${name}`);
    },
  });
  return exports;
}

test('image proxy rejects local networks, foreign domains, signed objects and redirect tricks', async () => {
  const { GET } = load('../app/api/image-proxy/route.js');
  for (const url of ['http://127.0.0.1/admin', 'http://169.254.169.254/latest/meta-data/', 'https://evil.invalid/a.png',
    'https://garblac.duckdns.org.evil.invalid/storage/v1/object/public/a.png',
    'https://garblac.duckdns.org/storage/v1/object/sign/private/a.png',
    'https://garblac.duckdns.org/storage/v1/object/public/../../../admin']) {
    assert.equal((await GET({ url: `https://catalog.invalid/api/image-proxy?url=${encodeURIComponent(url)}` })).status, 400);
  }
});

test('Facebook catalog mutations require admin authorization before reading input or calling Facebook', async () => {
  for (const status of [401, 403]) {
    const { POST } = load('../app/api/facebook/catalog/route.js', { auth: async () => ({ error: 'Denied', status }) });
    assert.equal((await POST({ json: () => assert.fail('must authorize first') })).status, status);
  }
});

test('WhatsApp webhook rejects unsigned requests and verifies the exact signed bytes before processing', async () => {
  const { POST, GET } = load('../app/api/whatsapp/webhook/route.js', { env: { WHATSAPP_APP_SECRET: 'isolated-test-secret' } });
  const body = '{"object":"test"}';
  const request = signature => new Request('https://catalog.invalid/api/whatsapp/webhook', { method: 'POST', body,
    headers: signature ? { 'x-hub-signature-256': signature } : {} });
  assert.equal((await POST(request())).status, 403);
  assert.equal((await POST(request('sha256=' + '0'.repeat(64)))).status, 403);
  const signature = 'sha256=' + crypto.createHmac('sha256', 'isolated-test-secret').update(body).digest('hex');
  assert.equal((await POST(request(signature))).status, 200);
  assert.equal((await GET({ url: 'https://catalog.invalid?hub.mode=subscribe&hub.verify_token=tu_token_verificacion_whatsapp_2024' })).status, 403);
  assert.equal((await load('../app/api/whatsapp/webhook/route.js').POST(request())).status, 503);
});
