
"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { CONFIG, whatsappUtils } from "../../../../lib/config";

export default function StockPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState("desc");

  useEffect(() => {
    fetchProductos();
    // eslint-disable-next-line
  }, [orden]);

  async function fetchProductos() {
    setLoading(true);
    let query = supabase.from("productos").select(`
      user_id,
      nombre,
      descripcion,
      precio,
      stock,
      imagen_url,
      category_id,
      codigo_barra,
      categorias (categori)
    `);
    if (orden === "asc") {
      query = query.order("user_id", { ascending: true });
    } else {
      query = query.order("user_id", { ascending: false });
    }
    const { data, error } = await query;
    if (error) {
      console.error("Error al obtener productos:", error);
      setProductos([]);
    } else {
      setProductos(data || []);
    }
    setLoading(false);
  }

  function sendWhatsappAlerta(prod) {
    const mensaje = `ALERTA DE STOCK BAJO\nProducto: ${prod.nombre}\nStock actual: ${prod.stock}`;
    if (!window.__whatsapp_alertas) window.__whatsapp_alertas = {};
    if (!window.__whatsapp_alertas[prod.id]) {
      if (confirm(`¿Enviar alerta de stock bajo por WhatsApp para \"${prod.nombre}\" (stock: ${prod.stock})?`)) {
        window.__whatsapp_alertas[prod.id] = true;
        whatsappUtils.sendToBusinessWhatsApp(mensaje);
      }
    }
  }

  function getStockColor(stock) {
    if (stock < 2) return "bg-red-700 text-white";
    if (stock < 10) return "bg-yellow-400 text-black";
    return "bg-green-600 text-white";
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-start py-8 px-2">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 text-center">Inventario - Stock</h1>
      <div className="mb-4 flex flex-col sm:flex-row gap-2 justify-center items-center">
        <label className="text-gray-700 dark:text-gray-200 font-semibold">Ordenar por antigüedad:</label>
        <select
          className="bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-1"
          value={orden}
          onChange={e => setOrden(e.target.value)}
        >
          <option value="asc">Más antiguos primero</option>
          <option value="desc">Más actuales primero</option>
        </select>
      </div>
      {loading ? (
        <div className="text-gray-500 text-center">Cargando productos...</div>
      ) : productos.length === 0 ? (
        <div className="text-gray-500 text-center">No hay productos para mostrar.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm md:text-base bg-gray-800 rounded-xl shadow-xl border border-gray-700 text-center">
            <thead>
              <tr className="bg-gray-900 text-gray-100">
                <th className="p-2 text-center">ID</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-center">Descripción</th>
                <th className="p-2 text-center">Precio</th>
                <th className="p-2 text-center">Categoría</th>
                <th className="p-2 text-center">Stock</th>
                <th className="p-2 text-center">Código Barra</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(prod => (
                <tr key={prod.id} className="border-b border-gray-700 last:border-b-0">
                  <td className="p-2 text-gray-200 text-center">{prod.id}</td>
                  <td className="p-2 text-gray-100 font-bold text-left">{prod.nombre}</td>
                  <td className="p-2 text-gray-300 text-center">{prod.descripcion}</td>
                  <td className="p-2 text-blue-300 font-bold text-center">Bs {Number(prod.precio).toFixed(2)}</td>
                  <td className="p-2 text-gray-200 text-center">{prod.categorias?.categori || prod.categoria || prod.category_id}</td>
                  <td className={"p-2 font-bold text-center rounded " + getStockColor(Number(prod.stock))}>
                    {prod.stock}
                    {Number(prod.stock) < 2 && sendWhatsappAlerta(prod)}
                  </td>
                  <td className="p-2 text-gray-400 text-center">{prod.codigo_barra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}