"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";

// Simulación: en un sistema real, los packs estarían en una tabla aparte
const packsSimulados = {
  // producto_id: { tipo: 'pack', valor: '2x1' }
};

export default function PromocionesPacksPage() {
  const [productos, setProductos] = useState([]);
  useEffect(() => {
    async function fetchProductos() {
      const { data, error } = await supabase
        .from("productos")
        .select("user_id, nombre, precio, categoria");
      if (!error && data) setProductos(data);
    }
    fetchProductos();
  }, []);

  // Filtrar productos con pack simulado
  const productosConPack = productos.filter(p => packsSimulados[p.user_id]);

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-4">Promociones de Packs/Combos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {productosConPack.length === 0 ? (
          <div className="col-span-full text-gray-900">No hay promociones de packs/combo activas.</div>
        ) : (
          productosConPack.map(prod => (
            <div key={prod.user_id} className="bg-white rounded-xl shadow p-6 flex flex-col gap-2">
              <div className="text-gray-900 font-bold">{prod.nombre}</div>
              <div className="text-gray-900">Categoría: {prod.categoria || '-'}</div>
              <div className="text-gray-900">Precio: Bs {Number(prod.precio).toFixed(2)}</div>
              <div className="text-blue-700 font-bold">Pack/Combo: {packsSimulados[prod.user_id]?.valor}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}