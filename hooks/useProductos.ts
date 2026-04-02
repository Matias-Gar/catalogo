import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/SupabaseClient';

interface Producto {
  user_id: string;
  nombre: string;
  precio: number;
  precio_compra?: number;
  stock?: number;
  codigo_barra?: string;
  codigo?: string;
  categorias?: { categori?: string };
}

// simple util to group images by producto_id
function agruparImagenes(imgs: Array<{ producto_id: string | number; imagen_url?: string }>) {
  const out: Record<string, string[]> = {};
  imgs.forEach(i => {
    const id = String(i.producto_id);
    if (!out[id]) out[id] = [];
    if (i.imagen_url) out[id].push(i.imagen_url);
  });
  return out;
}

export function useProductos(includeCost = false) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [imagenes, setImagenes] = useState<Record<string, string[]>>({});
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchProductos = useCallback(async () => {
    const selectFields = includeCost
      ? 'user_id, nombre, precio, precio_compra, stock, codigo_barra, categorias (categori)'
      : 'user_id, nombre, precio, stock, codigo_barra, categorias (categori)';
    const { data, error } = await supabase
      .from('productos')
      .select(selectFields)
      .limit(1000);
    if (!error && data) {
      const productosData = Array.isArray(data) ? (data as unknown as Producto[]) : [];
      setProductos(productosData);
      const ids = productosData.map(p => p.user_id).filter(Boolean);
      if (ids.length) {
        const { data: imgs } = await supabase
          .from('producto_imagenes')
          .select('producto_id, imagen_url')
          .in('producto_id', ids);
        if (Array.isArray(imgs)) setImagenes(agruparImagenes(imgs));
      }
    }
    setLoading(false);
  }, []);

  const searchProductos = useCallback(async (q: string) => {
    setSearchLoading(true);
    try {
      let selectFields = includeCost
        ? 'user_id, nombre, precio, precio_compra, stock, codigo_barra, categorias (categori)'
        : 'user_id, nombre, precio, stock, codigo_barra, categorias (categori)';
      let query = supabase
        .from('productos')
        .select(selectFields)
        .order('nombre', { ascending: true })
        .limit(50);
      if (q.trim()) {
        const term = q.trim();
        const numericMatch = term.match(/^\d+$/);
        let fallbackCode = '';
        if (numericMatch && term.length === 13) {
          // lector a veces devuelve EAN13 completo; el DB puede guardar 12 dígitos
          fallbackCode = term.slice(0, -1);
        }

        if (numericMatch && fallbackCode) {
          query = query.or(`nombre.ilike.%${term}%,codigo_barra.ilike.%${term}%,codigo_barra.eq.${term},codigo_barra.eq.${fallbackCode}`);
        } else {
          query = query.or(`nombre.ilike.%${term}%,codigo_barra.ilike.%${term}%`);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      const resultados = Array.isArray(data) ? (data as unknown as Producto[]) : [];
      setSearchResults(resultados);
      // cargar imágenes para resultados
      const ids = resultados.map(r => r.user_id).filter(Boolean);
      if (ids.length) {
        const { data: imgs } = await supabase
          .from('producto_imagenes')
          .select('producto_id, imagen_url')
          .in('producto_id', ids);
        if (Array.isArray(imgs)) {
          setImagenes(prev => ({ ...prev, ...agruparImagenes(imgs) }));
        }
      }
    } catch (e) {
      console.error('searchProductos error', e);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  return {
    productos,
    imagenes,
    searchResults,
    loading,
    searchLoading,
    fetchProductos,
    searchProductos
  };
}
