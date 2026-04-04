"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { whatsappUtils } from "../../../../lib/config";
import ExpandableDescription from "../../../../components/ui/ExpandableDescription";
import { getOptimizedImageUrl, buildImageSrcSet } from "../../../../lib/imageOptimization";

export default function StockPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState("desc");

  useEffect(() => {
    fetchProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    query = query.order("user_id", { ascending: orden === "asc" });

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
    const pid = prod.user_id ?? prod.id ?? prod.codigo_barra ?? prod.nombre;
    const mensaje = `ALERTA DE STOCK BAJO\nProducto: ${prod.nombre}\nStock actual: ${prod.stock}`;
    if (!window.__whatsapp_alertas) window.__whatsapp_alertas = {};
    if (!window.__whatsapp_alertas[pid]) {
      if (confirm(`¿Enviar alerta de stock bajo por WhatsApp para "${prod.nombre}" (stock: ${prod.stock})?`)) {
        window.__whatsapp_alertas[pid] = true;
        whatsappUtils.sendToBusinessWhatsApp(mensaje);
      }
    }
  }

  function getStockColor(stock) {
    if (stock < 2) return "bg-red-600 text-white ring-1 ring-red-500";
    if (stock < 10) return "bg-yellow-300 text-black ring-1 ring-yellow-400";
    return "bg-green-600 text-white ring-1 ring-green-500";
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-start py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white via-slate-50 to-gray-100">
      <div className="w-full max-w-6xl">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-indigo-600">
              Inventario - Stock
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Vista clara y responsiva del stock: revisa rapidamente productos con bajo inventario.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Ordenar:</label>
            <select
              className="h-9 bg-white border border-gray-200 rounded-md px-3 shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
            >
              <option value="asc">Mas antiguos primero</option>
              <option value="desc">Mas actuales primero</option>
            </select>

            <a
              href="/admin/productos/catalogo"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md shadow-md text-sm font-semibold"
            >
              Ver Catalogo
            </a>
          </div>
        </header>
      </div>

      {loading ? (
        <div className="w-full max-w-6xl mx-auto py-12 flex items-center justify-center">
          <div className="animate-pulse bg-sky-100 text-sky-700 px-6 py-4 rounded-lg shadow">
            Cargando productos...
          </div>
        </div>
      ) : productos.length === 0 ? (
        <div className="w-full max-w-6xl mx-auto py-12 text-center">
          <div className="inline-block bg-white shadow-md rounded-lg p-6">
            <h3 className="font-semibold text-gray-800">No hay productos para mostrar</h3>
            <p className="text-sm text-gray-500 mt-1">Agrega productos desde el panel para que aparezcan aqui.</p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-6xl mx-auto">
          <div className="hidden md:block overflow-hidden rounded-lg shadow-lg border border-gray-200">
            <table className="w-full table-auto text-sm md:text-base bg-white">
              <thead>
                <tr className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white">
                  <th className="p-3 text-center">ID</th>
                  <th className="p-3 text-left">Nombre</th>
                  <th className="p-3 text-left">Descripcion</th>
                  <th className="p-3 text-center">Precio</th>
                  <th className="p-3 text-center">Categoria</th>
                  <th className="p-3 text-center">Stock</th>
                  <th className="p-3 text-center">Codigo</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {productos.map((prod, idx) => (
                  <tr key={prod.user_id ?? prod.id ?? `${prod.nombre ?? "producto"}-${idx}`} className="hover:bg-gray-50 transition">
                    <td className="p-3 text-center text-slate-600">{prod.user_id ?? prod.id}</td>
                    <td className="p-3 font-semibold text-slate-900">{prod.nombre}</td>
                    <td className="p-3 text-slate-600">
                      <ExpandableDescription
                        text={prod.descripcion}
                        lines={3}
                        textClassName="text-slate-600 text-sm"
                        buttonClassName="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      />
                    </td>
                    <td className="p-3 text-center font-semibold text-indigo-600">Bs {Number(prod.precio).toFixed(2)}</td>
                    <td className="p-3 text-center text-slate-600">{prod.categorias?.categori || prod.categoria || prod.category_id}</td>
                    <td className="p-3 text-center">
                      <span className={"inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold " + getStockColor(Number(prod.stock))}>
                        {prod.stock}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-500">{prod.codigo_barra}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => sendWhatsappAlerta(prod)}
                        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-md text-sm font-semibold"
                      >
                        Enviar alerta
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden grid gap-4">
            {productos.map((prod, idx) => (
              <div key={prod.user_id ?? prod.id ?? `${prod.nombre ?? "producto"}-${idx}`} className="bg-white rounded-lg shadow p-4 flex gap-4 items-start">
                <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                  {prod.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getOptimizedImageUrl(prod.imagen_url, 320)}
                      srcSet={buildImageSrcSet(prod.imagen_url, [160, 320, 640], { quality: 95, format: "origin" })}
                      sizes="80px"
                      loading="lazy"
                      decoding="async"
                      alt={prod.nombre}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">-</div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{prod.nombre}</div>
                      <ExpandableDescription
                        text={prod.descripcion}
                        lines={3}
                        className="mt-1"
                        textClassName="text-sm text-slate-500"
                        buttonClassName="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      />
                    </div>
                    <div className="text-right">
                      <div className="text-indigo-600 font-bold">Bs {Number(prod.precio).toFixed(2)}</div>
                      <div className="text-xs text-slate-500 mt-1">ID: {prod.user_id ?? prod.id}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={"inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold " + getStockColor(Number(prod.stock))}>
                        {prod.stock}
                      </span>
                      <div className="text-xs text-slate-500">{prod.categorias?.categori || prod.categoria || prod.category_id}</div>
                    </div>

                    <div>
                      <button
                        onClick={() => sendWhatsappAlerta(prod)}
                        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-md text-sm font-semibold"
                      >
                        Alerta
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
