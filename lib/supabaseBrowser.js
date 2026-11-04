import { createClient } from '@supabase/supabase-js';
import { getCarritoToken } from './carritoToken';
import { browserAuthLock } from './authLock.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Faltan variables públicas de Supabase');

// Both legacy import paths share one Auth client and one refresh lock.
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, lock: browserAuthLock },
  global: {
    fetch(input, init) {
      const headers = new Headers(init?.headers);
      const token = getCarritoToken();
      if (token) headers.set('carrito-token', token);
      return fetch(input, { ...init, headers });
    },
  },
});
