"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import dynamic from "next/dynamic";

const Pie = dynamic(() => import("react-chartjs-2").then(mod => mod.Pie), { ssr: false });
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend);

export default function InventarioEstadisticaPage() {
  const [productos, setProductos] = useState([]);
  useEffect(() => {
    async function fetchProductos() {
      const { data, error } = await supabase
        .from("productos")
        .select("user_id, nombre, precio, stock, categoria");
      if (!error && data) setProductos(data);
    }
    fetchProductos();
  }, []);

  const totalProductos = productos.length;
  const stockTotal = productos.reduce((acc, p) => acc + Number(p.stock), 0);
  const productosBajoStock = productos.filter(p => Number(p.stock) < 3).length;
  const masCaro = productos.reduce((max, p) => Number(p.precio) > Number(max.precio) ? p : max, productos[0] || {precio:0});
  const masBarato = productos.reduce((min, p) => Number(p.precio) < Number(min.precio) ? p : min, productos[0] || {precio:Infinity});

  // Pie chart: stock por categoría
  const categorias = [...new Set(productos.map(p => p.categoria || "Sin categoría"))];
  const stockPorCategoria = categorias.map(cat => productos.filter(p => (p.categoria || "Sin categoría") === cat).reduce((acc, p) => acc + Number(p.stock), 0));
  const pieDataCategoria = {
    labels: categorias,
    datasets: [{
      data: stockPorCategoria,
      backgroundColor: ["#4ade80", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#34d399", "#facc15"],
    }],
  };

  // Pie chart: stock por producto
  const pieDataProducto = {
    labels: productos.map(p => p.nombre),
    datasets: [{
      data: productos.map(p => Number(p.stock)),
      backgroundColor: ["#4ade80", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#34d399", "#facc15", "#818cf8", "#fca5a5"],
    }],
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-4">Estadísticas de Inventario</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-2">
          <span className="text-gray-900 font-bold">Total de productos: <span className="font-extrabold">{totalProductos}</span></span>
          <span className="text-gray-900 font-bold">Stock total: <span className="font-extrabold">{stockTotal}</span></span>
          <span className="text-gray-900 font-bold">Productos con stock bajo (&lt;3): <span className="font-extrabold text-red-600">{productosBajoStock}</span></span>
          {masCaro && masCaro.nombre && (
            <span className="text-gray-900 font-bold">Más caro: <span className="font-extrabold">{masCaro.nombre}</span> (Bs {Number(masCaro.precio).toFixed(2)})</span>
          )}
          {masBarato && masBarato.nombre && (
            <span className="text-gray-900 font-bold">Más barato: <span className="font-extrabold">{masBarato.nombre}</span> (Bs {Number(masBarato.precio).toFixed(2)})</span>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <span className="text-gray-900 font-bold mb-2 block">Stock por producto</span>
          <div className="flex flex-col gap-2">
            {productos.map(p => (
              <div key={p.user_id} className="flex items-center gap-2">
                <span className="w-40 truncate text-gray-900">{p.nombre}</span>
                <div className="flex-1 bg-gray-200 rounded h-4">
                  <div className="bg-green-600 h-4 rounded" style={{ width: `${Math.min(100, (Number(p.stock)/Math.max(...productos.map(x=>Number(x.stock)||1)))*100)}%` }}></div>
                </div>
                <span className="w-10 text-right text-gray-900">{p.stock}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-gray-900 font-bold mb-2 block">Stock por categoría</span>
          {productos.length > 0 && <Pie data={pieDataCategoria} />}
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-gray-900 font-bold mb-2 block">Stock por producto</span>
          {productos.length > 0 && <Pie data={pieDataProducto} />}
        </div>
      </div>
    </div>
  );
}