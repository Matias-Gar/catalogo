import { createClient } from '@supabase/supabase-js';

// --- Configuración de Supabase (CRÍTICO para Canvas) ---

// Intentamos obtener el ID y la configuración de Firebase proporcionados por Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// Usamos las variables de entorno para Supabase. 
// En un entorno Next.js real, estas se cargarían automáticamente. 
// Si la aplicación corre en Canvas con integración de Supabase, los siguientes valores
// DEBEN ser configurados en el panel de Variables de Entorno del proyecto de Canvas.

// Por favor, define estas variables en el panel de Canvas si no lo has hecho:
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || firebaseConfig.supabaseUrl;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || firebaseConfig.supabaseAnonKey;


if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ ERROR: Las claves de Supabase no están definidas. Por favor, define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

// Inicializamos el cliente de Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuración opcional para evitar errores RLS/Auth en algunos casos de Canvas
// No se necesita por defecto, pero ayuda si hay problemas de autenticación.
// Esta función no se debe llamar en el cliente a menos que sea necesario.
export async function getSupabaseAuth() {
    // Si necesitas autenticarte para obtener los productos, se haría aquí
    // Usualmente no es necesario para lectura pública.
    return null;
}
