import { createPublicCatalogClient } from './publicSupabaseClient.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Faltan variables públicas de Supabase');

// Public reads use the anon credential and RLS, never the visitor's session.
// accessToken prevents the SDK from constructing Auth, touching session storage,
// refreshing tokens or waiting for the private client's cross-tab lock.
export const publicSupabase = createPublicCatalogClient(url, key);
