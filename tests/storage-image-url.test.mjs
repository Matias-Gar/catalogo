import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStorageImageUrl } from '../lib/storageImageUrl.mjs';

const path = '/storage/v1/object/public/product_images/public/cafetera%209.jpg';
test('old Cloud, Dell and bucket paths resolve to the project public Storage', () => {
  for (const source of [`https://gzvtuenpwndodnetnmzi.supabase.co${path}`, `http://192.168.0.17:8000${path}`, `https://garblac.duckdns.org${path}`, path, 'product_images/public/cafetera%209.jpg']) {
    assert.equal(resolveStorageImageUrl(source), `https://garblac.duckdns.org${path}`);
  }
});
test('preserves encoded paths and queries, supports an explicit public origin', () => {
  assert.equal(resolveStorageImageUrl(`https://gzvtuenpwndodnetnmzi.supabase.co${path}?download=1`, 'https://storage.example.invalid'), `https://storage.example.invalid${path}?download=1`);
});
test('does not rewrite another project, signed URLs, local assets or previews', () => {
  for (const source of [`https://other.supabase.co${path}`, `https://gzvtuenpwndodnetnmzi.supabase.co.evil.invalid${path}`, '/logo.svg', 'blob:https://example.invalid/123', 'data:image/png;base64,AA', 'https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/sign/private/a?token=example']) {
    assert.equal(resolveStorageImageUrl(source), source);
  }
  assert.equal(resolveStorageImageUrl(null), '');
});
