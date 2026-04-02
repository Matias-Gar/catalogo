"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import dynamic from "next/dynamic";

const Pie = dynamic(() => import("react-chartjs-2").then(mod => mod.Pie), { ssr: false });
const Line = dynamic(() => import("react-chartjs-2").then(mod => mod.Line), { ssr: false });
const Bar = dynamic(() => import("react-chartjs-2").then(mod => mod.Bar), { ssr: false });
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement);

export default function VentasEstadisticaPage() {
  const [ventas, setVentas] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [productCosts, setProductCosts] = useState({});

  // tabla de resultados por venta
  const [reportLines, setReportLines] = useState([]);

  useEffect(() => {
    async function fetchVentas() {
      // traer ventas con posibles campos extra
      const { data, error } = await supabase
        .from("ventas")
        .select("id, total, fecha, costos_extra, descuentos");
      if (!error && data) setVentas(data);

      const { data: dets } = await supabase
        .from("ventas_detalle")
        .select("venta_id, producto_id, cantidad, precio_unitario");
      if (dets) {
        setDetalles(dets);
        // obtener precios de compra de los productos involucrados
        const prodIds = Array.from(new Set(dets.map(d => d.producto_id).filter(Boolean)));
        if (prodIds.length) {
          const { data: prods } = await supabase
            .from('productos')
            .select('user_id, precio_compra')
            .in('user_id', prodIds);
          const map = {};
          (prods || []).forEach(p => { map[p.user_id] = Number(p.precio_compra) || 0; });
          setProductCosts(map);
        }
      }
    }
    fetchVentas();
  }, []);

  // once data is loaded compute metrics
  useEffect(() => {
    if (ventas.length === 0) return;
    const lines = ventas.map(v => {
      const detsThis = detalles.filter(d => d.venta_id === v.id);
      const inversion = detsThis.reduce((acc, d) => acc + (productCosts[d.producto_id] || 0) * d.cantidad, 0);
      const ventaPrice = Number(v.total) || 0;
      const costosExtras = v.costos_extra || {};
      const descuentos = Number(v.descuentos || costosExtras.descuento || 0);
      const costos = Object.values(costosExtras).reduce((a,b) => a + (Number(b) || 0), 0);
      const gananciaBruta = ventaPrice - inversion;
      const gananciaNeta = gananciaBruta - costos;
      const porcentajeUtilidad = inversion > 0 ? (gananciaNeta / inversion * 100) : 0;
      return { venta: v, inversion, ventaPrice, costos, gananciaBruta, gananciaNeta, porcentajeUtilidad };
    });
    setReportLines(lines);
  }, [ventas, detalles, productCosts]);

  const totalVentas = ventas.length;
  const montoTotal = ventas.reduce((acc, v) => acc + Number(v.total), 0);
  const ticketPromedio = totalVentas > 0 ? montoTotal / totalVentas : 0;

  // build chart data from reportLines
  const sortedLines = [...reportLines].sort((a,b)=> new Date(a.venta.fecha) - new Date(b.venta.fecha));
  const fechasLines = sortedLines.map(r=> new Date(r.venta.fecha).toLocaleDateString());
  const gananciaNetaData = sortedLines.map(r=> r.gananciaNeta.toFixed(2));
  const utilidadPctData = sortedLines.map(r=> r.porcentajeUtilidad.toFixed(2));
  const gananciaLineChart = {
    labels: fechasLines,
    datasets: [{ label: 'Ganancia neta', data: gananciaNetaData, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)' }]
  };
  const utilidadBarChart = {
    labels: fechasLines,
    datasets: [{ label: '% Utilidad', data: utilidadPctData, backgroundColor: '#3B82F6' }]
  };

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

      {/* gráficos automáticos de métricas contables */}
      {reportLines.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <span className="text-gray-900 font-bold mb-2 block">Ganancia Neta por Fecha</span>
            <Line data={gananciaLineChart} />
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <span className="text-gray-900 font-bold mb-2 block">% de Utilidad por Fecha</span>
            <Bar data={utilidadBarChart} />
          </div>
        </div>
      )}

      {/* Tabla detallada por venta */}
      {reportLines.length > 0 && (
        <div className="mt-10 bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Detalle contable por venta</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2">#Venta</th>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Inversión</th>
                  <th className="px-4 py-2">Precio venta</th>
                  <th className="px-4 py-2">Costos</th>
                  <th className="px-4 py-2">Ganancia bruta</th>
                  <th className="px-4 py-2">Ganancia neta</th>
                  <th className="px-4 py-2">% utilidad</th>
                </tr>
              </thead>
              <tbody>
                {reportLines.map((r, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-4 py-2">{r.venta.id}</td>
                    <td className="px-4 py-2">{new Date(r.venta.fecha).toLocaleDateString()}</td>
                    <td className="px-4 py-2">Bs {r.inversion.toFixed(2)}</td>
                    <td className="px-4 py-2">Bs {r.ventaPrice.toFixed(2)}</td>
                    <td className="px-4 py-2">Bs {r.costos.toFixed(2)}</td>
                    <td className="px-4 py-2">Bs {r.gananciaBruta.toFixed(2)}</td>
                    <td className="px-4 py-2">Bs {r.gananciaNeta.toFixed(2)}</td>
                    <td className="px-4 py-2">{r.porcentajeUtilidad.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen general */}
      {reportLines.length > 0 && (() => {
        const inversionTotal = reportLines.reduce((a,b)=>a+b.inversion,0);
        const ventasTot = reportLines.length;
        const gananciaTotal = reportLines.reduce((a,b)=>a+b.gananciaNeta,0);
        const margen = inversionTotal > 0 ? (gananciaTotal / inversionTotal * 100) : 0;
        return (
          <div className="mt-8 bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Resumen financiero</h2>
            <p>Inversión total: Bs {inversionTotal.toFixed(2)}</p>
            <p>Ventas totales: {ventasTot}</p>
            <p>Ganancia total neta: Bs {gananciaTotal.toFixed(2)}</p>
            <p>Margen de utilidad general: {margen.toFixed(2)}%</p>
            <div className="mt-4">
              <h3 className="font-semibold">Recomendaciones</h3>
              <ul className="list-disc list-inside">
                <li>Revisar costos de envío y comisiones para reducir gastos.</li>
                <li>Optimizar el precio de compra y stock para mejorar margen.</li>
                <li>Considerar promociones controladas para no disminuir demasiado la utilidad.</li>
              </ul>
            </div>
          </div>
        );
      })()}
    </div>
  );
}