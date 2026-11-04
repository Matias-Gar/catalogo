import { createClient } from '@supabase/supabase-js';

// A fixed anon token selects the public RLS role without constructing Auth.
// Keep this factory independent of browser storage and private session imports.
export function createPublicCatalogClient(url, key, fetchImpl = globalThis.fetch) {
  return createClient(url, key, {
    accessToken: async () => key,
    global: { fetch: fetchImpl },
  });
}
