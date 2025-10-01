"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";

// Simulación: en un sistema real, los descuentos estarían en una tabla aparte
const descuentosSimulados = {
  // producto_id: { tipo: 'descuento', valor: 10 }
};

export default function PromocionesDescuentosPage() {
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

  // Filtrar productos con descuento simulado
  const productosConDescuento = productos.filter(p => descuentosSimulados[p.user_id]);

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-4">Productos con Descuento</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {productosConDescuento.length === 0 ? (
          <div className="col-span-full text-gray-900">No hay productos con descuento activo.</div>
        ) : (
          productosConDescuento.map(prod => (
            <div key={prod.user_id} className="bg-white rounded-xl shadow p-6 flex flex-col gap-2">
              <div className="text-gray-900 font-bold">{prod.nombre}</div>
              <div className="text-gray-900">Categoría: {prod.categoria || '-'}</div>
              <div className="text-gray-900">Precio original: Bs {Number(prod.precio).toFixed(2)}</div>
              <div className="text-green-700 font-bold">Descuento: {descuentosSimulados[prod.user_id]?.valor}%</div>
              <div className="text-gray-900 font-bold">Precio final: Bs {(Number(prod.precio) * (1 - descuentosSimulados[prod.user_id]?.valor / 100)).toFixed(2)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}