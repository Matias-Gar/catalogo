import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzvtuenpwndodnetnmzi.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dnR1ZW5wd25kb2RuZXRubXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDUwODIsImV4cCI6MjA3NDA4MTA4Mn0.94z7ObbDdYydDTLtp5qZxIsB3XqFgGUBTxdP9pcf8z4';

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Debug en consola
if (typeof window !== 'undefined') {
  console.log('🔗 Supabase conectado a:', supabaseUrl);
}

// Tipos para TypeScript basados en tu esquema
export interface Producto {
  user_id: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  imagen_url?: string;
  category_id?: number;
  categoria?: string;
  stock: number;
  codigo_barra?: string;
}

export interface Categoria {
  id: number;
  categori: string;
}

export interface Promocion {
  id: number;
  producto_id: number;
  tipo: string;
  valor?: number;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  activa: boolean;
}

export interface Pack {
  id: number;
  nombre: string;
  descripcion?: string;
  precio_pack: number;
  activo: boolean;
  fecha_inicio: string;
  fecha_fin?: string;
  imagen_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Venta {
  id: number;
  cliente_nombre?: string;
  cliente_telefono?: string;
  total: number;
  fecha: string;
  estado: string;
}

export interface VentaDetalle {
  id: number;
  venta_id: number;
  producto_id?: number;
  cantidad: number;
  precio_unitario: number;
  descripcion?: string;
  tipo: string;
  pack_id?: number;
}

export interface CarritoPendiente {
  id: number;
  cliente_nombre?: string;
  cliente_telefono?: string;
  productos: unknown; // JSON
  fecha: string;
  usuario_id?: string;
  usuario_email?: string;
}
