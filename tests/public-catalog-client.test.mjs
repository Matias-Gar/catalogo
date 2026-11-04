import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createPublicCatalogClient } from '../lib/publicSupabaseClient.mjs';

test('public product reads complete while the real private SDK is blocked acquiring its Auth lock', async () => {
  let release, entered;
  const acquired = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const privateClient = createClient('https://catalog.example.invalid', 'private-anon-fixture', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
      lock: async (_name, _timeout, task) => { entered(); await gate; return task(); } },
  });
  const privateRead = privateClient.auth.getSession();
  await acquired;
  let privateCompleted = false;
  void privateRead.then(() => { privateCompleted = true; });
  const calls = [];
  const client = createPublicCatalogClient('https://catalog.example.invalid', 'public-anon-fixture', async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init.headers) });
    return new Response(JSON.stringify([{ producto_id: 1, nombre: 'Producto público' }]), { headers: { 'Content-Type': 'application/json' } });
  });
  try {
    const { data, error } = await client.from('v_productos_catalogo').select('producto_id,nombre');
    assert.equal(error, null);
    assert.equal(data[0].nombre, 'Producto público');
    assert.equal(privateCompleted, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].headers.get('Authorization'), 'Bearer public-anon-fixture');
    assert.equal(calls[0].headers.get('apikey'), 'public-anon-fixture');
    assert.throws(() => client.auth.getSession, /accessToken/);
  } finally { release(); await privateRead; }
});

test('public reads propagate RLS denial instead of retrying with a privileged credential', async () => {
  let calls = 0;
  const client = createPublicCatalogClient('https://catalog.example.invalid', 'public-anon-fixture', async () => {
    calls++;
    return new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), { status: 403 });
  });
  const result = await client.from('perfiles').select('*');
  assert.equal(result.error.code, '42501');
  assert.equal(calls, 1);
});
