import { createClient } from '@supabase/supabase-js';
import { getCarritoToken } from './carritoToken';

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Crear cliente de Supabase con header personalizado para carrito anónimo
const carritoToken = getCarritoToken();
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: carritoToken ? { 'carrito-token': carritoToken } : {},
  },
});
