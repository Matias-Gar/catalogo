import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase usando variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzvtuenpwndodnetnmzi.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dnR1ZW5wd25kb2RuZXRubXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDUwODIsImV4cCI6MjA3NDA4MTA4Mn0.94z7ObbDdYydDTLtp5qZxIsB3XqFgGUBTxdP9pcf8z4';

// Verificar que las variables estén configuradas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Variables de entorno de Supabase no configuradas');
}

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Debug en consola
console.log('🔗 Supabase conectado a:', supabaseUrl);
