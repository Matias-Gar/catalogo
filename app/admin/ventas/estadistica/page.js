"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import dynamic from "next/dynamic";

const Pie = dynamic(() => import("react-chartjs-2").then(mod => mod.Pie), { ssr: false });
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend);

export default function VentasEstadisticaPage() {
  const [ventas, setVentas] = useState([]);
  const [detalles, setDetalles] = useState([]);
  useEffect(() => {
    async function fetchVentas() {
      const { data, error } = await supabase
        .from("ventas")
        .select("id, total, fecha");
      if (!error && data) setVentas(data);
      const { data: dets } = await supabase
        .from("ventas_detalle")
        .select("venta_id, producto_id, cantidad");
      if (dets) setDetalles(dets);
    }
    fetchVentas();
  }, []);

  const totalVentas = ventas.length;
  const montoTotal = ventas.reduce((acc, v) => acc + Number(v.total), 0);
  const ticketPromedio = totalVentas > 0 ? montoTotal / totalVentas : 0;
  // Ventas por día
  const ventasPorDia = {};
  ventas.forEach(v => {
    const fecha = new Date(v.fecha).toLocaleDateString();
    ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + 1;
  });
  // Producto más vendido
  const productosVendidos = {};
  detalles.forEach(d => {
    productosVendidos[d.producto_id] = (productosVendidos[d.producto_id] || 0) + d.cantidad;
  });
  const masVendidoId = Object.keys(productosVendidos).reduce((a, b) => productosVendidos[a] > productosVendidos[b] ? a : b, null);

  // Pie chart: ventas por día
  const pieDataDia = {
    labels: Object.keys(ventasPorDia),
    datasets: [{
      data: Object.values(ventasPorDia),
      backgroundColor: ["#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#34d399", "#facc15", "#818cf8", "#fca5a5"],
    }],
  };
  // Pie chart: ventas por producto
  const pieDataProducto = {
    labels: Object.keys(productosVendidos).map(id => `#${id}`),
    datasets: [{
      data: Object.values(productosVendidos),
      backgroundColor: ["#4ade80", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#34d399", "#facc15", "#818cf8", "#fca5a5"],
    }],
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-4">Estadísticas de Ventas</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-2">
          <span className="text-gray-900 font-bold">Total de ventas: <span className="font-extrabold">{totalVentas}</span></span>
          <span className="text-gray-900 font-bold">Monto total vendido: <span className="font-extrabold">Bs {montoTotal.toFixed(2)}</span></span>
          <span className="text-gray-900 font-bold">Ticket promedio: <span className="font-extrabold">Bs {ticketPromedio.toFixed(2)}</span></span>
          {masVendidoId && (
            <span className="text-gray-900 font-bold">Producto más vendido: <span className="font-extrabold">#{masVendidoId}</span> ({productosVendidos[masVendidoId]} unidades)</span>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-gray-900 font-bold mb-2 block">Ventas por día</span>
          {Object.keys(ventasPorDia).length > 0 && <Pie data={pieDataDia} />}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-gray-900 font-bold mb-2 block">Ventas por producto</span>
          {Object.keys(productosVendidos).length > 0 && <Pie data={pieDataProducto} />}
        </div>
      </div>
    </div>
  );
}