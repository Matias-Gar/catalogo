"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/SupabaseClient";
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function Productos() {
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    async function fetchProductos() {
      const { data } = await supabase.from("productos").select("*");
      setProductos(data || []);
    }
    fetchProductos();
  }, []);

  const telefono = "59169477200"; // tu WhatsApp Business

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-8">Catálogo de Productos</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {productos.map(p => (
          <div key={p.id} className="bg-white rounded-xl shadow p-4 text-center">
            <img
              src={p.imagen_url}
              alt={p.nombre}
              className="w-full h-48 object-cover rounded-lg"
            />
            <h2 className="text-lg font-bold mt-2">{p.nombre}</h2>
            <p className="text-gray-600 mb-2">Bs {p.precio}</p>
            <a
              href={`https://wa.me/${telefono}?text=Hola%20quiero%20el%20producto%20${encodeURIComponent(p.nombre)}`}
              target="_blank"
              className="mt-3 inline-block bg-green-500 text-white px-4 py-2 rounded-lg"
            >
              Pedir por WhatsApp
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
