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
  const [reportLines, setReportLines] = useState([]);
  const [openRow, setOpenRow] = useState(null);

  useEffect(() => {
    async function fetchVentas() {
      const { data, error } = await supabase
        .from("ventas")
        .select("id, total, fecha, costos_extra, descuentos, cliente_nombre");
      if (!error && data) setVentas(data);

      const { data: dets } = await supabase
        .from("ventas_detalle")
        .select("venta_id, producto_id, cantidad, precio_unitario, costo_unitario");
      if (dets) {
        setDetalles(dets);
      }
    }
    fetchVentas();
  }, []);

  useEffect(() => {
    if (ventas.length === 0) return;
    const lines = ventas.map(v => {
      const detsThis = detalles.filter(d => d.venta_id === v.id);
      const inversion = detsThis.reduce((acc, d) =>
        acc + ((Number(d.costo_unitario) || 0) * Number(d.cantidad || 0)), 0
      );
      const ventaPrice = Number(v.total) || 0;
      const costosExtras = v.costos_extra || {};
      const descuentos = Number(v.descuentos || 0);
      const costos = Object.values(costosExtras).reduce((a,b) => a + (Number(b) || 0), 0);
      const gananciaBruta = ventaPrice - inversion;
      const gananciaNeta = gananciaBruta - descuentos - costos;
      const porcentajeUtilidad = inversion > 0 ? (gananciaNeta / inversion * 100) : 0;
      const items = detsThis.map(d => {
        const cantidad = Number(d.cantidad) || 0;
        const precio = Number(d.precio_unitario) || 0;
        const costo = (Number(d.costo_unitario) || 0) * cantidad;
        const ingreso = precio * cantidad;

        return {
          producto_id: d.producto_id,
          cantidad,
          precio,
          costo,
          ingreso,
          ganancia: ingreso - costo,
        };
      });

      return { venta: v, inversion, ventaPrice, descuentos, costos, gananciaBruta, gananciaNeta, porcentajeUtilidad, items };
    });
    setReportLines(lines);
  }, [ventas, detalles]);

  const totalVentas = ventas.length;
  const montoTotal = ventas.reduce((acc, v) => acc + Number(v.total), 0);
  const ticketPromedio = totalVentas > 0 ? montoTotal / totalVentas : 0;
  const ventasPerdida = reportLines.filter(r => r.gananciaNeta < 0).length;
  const margenPromedio = reportLines.reduce((a, r) => a + r.porcentajeUtilidad, 0) / (reportLines.length || 1);
  const alertas = reportLines.filter(r => r.gananciaNeta < 0);

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

  const ventasPorDia = {};
  ventas.forEach(v => {
    const fecha = new Date(v.fecha).toLocaleDateString();
    ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + 1;
  });

  const productosVendidos = {};
  detalles.forEach(d => {
    productosVendidos[d.producto_id] = (productosVendidos[d.producto_id] || 0) + d.cantidad;
  });
  const masVendidoId = Object.keys(productosVendidos).reduce((a, b) => productosVendidos[a] > productosVendidos[b] ? a : b, null);

  const rentabilidadProductos = {};
  detalles.forEach(d => {
    const ganancia = ((Number(d.precio_unitario) || 0) - (Number(d.costo_unitario) || 0)) * (Number(d.cantidad) || 0);
    rentabilidadProductos[d.producto_id] = (rentabilidadProductos[d.producto_id] || 0) + ganancia;
  });
  const topRentables = Object.entries(rentabilidadProductos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const clientes = {};
  ventas.forEach(v => {
    const key = v.cliente_nombre || "Sin nombre";
    clientes[key] = (clientes[key] || 0) + Number(v.total || 0);
  });
  const topClientes = Object.entries(clientes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const pieDataDia = {
    labels: Object.keys(ventasPorDia),
    datasets: [{
      data: Object.values(ventasPorDia),
      backgroundColor: ["#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#34d399", "#facc15", "#818cf8", "#fca5a5"],
    }],
  };

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

      {alertas.length > 0 && (
        <div className="mb-4 rounded-xl bg-red-100 p-4 font-semibold text-red-700 shadow-sm">
          ⚠️ {alertas.length} ventas con pérdida detectadas
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-2">
          <span className="text-gray-900 font-bold">Total de ventas: <span className="font-extrabold">{totalVentas}</span></span>
          <span className="text-gray-900 font-bold">Monto total vendido: <span className="font-extrabold">Bs {montoTotal.toFixed(2)}</span></span>
          <span className="text-gray-900 font-bold">Ticket promedio: <span className="font-extrabold">Bs {ticketPromedio.toFixed(2)}</span></span>
          <span className="text-gray-900 font-bold">⚠️ Ventas con pérdida: <span className="font-extrabold text-red-600">{ventasPerdida}</span></span>
          <span className="text-gray-900 font-bold">📉 Margen promedio: <span className="font-extrabold">{margenPromedio.toFixed(2)}%</span></span>
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
        <div className="bg-white rounded-xl shadow p-6">
          <span className="text-gray-900 font-bold mb-4 block">Top productos más rentables</span>
          <div className="space-y-2">
            {topRentables.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos de rentabilidad.</p>
            ) : topRentables.map(([productoId, ganancia]) => (
              <div key={productoId} className="flex items-center justify-between border-b py-2 text-sm">
                <span className="font-medium text-gray-800">Producto #{productoId}</span>
                <span className={Number(ganancia) >= 0 ? "font-bold text-green-600" : "font-bold text-red-600"}>
                  Bs {Number(ganancia).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <span className="text-gray-900 font-bold mb-4 block">Top clientes</span>
          <div className="space-y-2">
            {topClientes.length === 0 ? (
              <p className="text-sm text-gray-500">Sin clientes registrados.</p>
            ) : topClientes.map(([cliente, total]) => (
              <div key={cliente} className="flex items-center justify-between border-b py-2 text-sm">
                <span className="font-medium text-gray-800">{cliente}</span>
                <span className="font-bold text-cyan-700">Bs {Number(total).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
              {reportLines.map((r, idx) => (
                  <tbody key={`row-group-${r.venta.id}-${idx}`}>
                    <tr
                      className="border-t cursor-pointer hover:bg-gray-50"
                      onClick={() => setOpenRow(openRow === r.venta.id ? null : r.venta.id)}
                    >
                      <td className="px-4 py-2">{r.venta.id}</td>
                      <td className="px-4 py-2">{new Date(r.venta.fecha).toLocaleDateString()}</td>
                      <td className="px-4 py-2">Bs {r.inversion.toFixed(2)}</td>
                      <td className="px-4 py-2">Bs {r.ventaPrice.toFixed(2)}</td>
                      <td className="px-4 py-2">Bs {r.costos.toFixed(2)}</td>
                      <td className="px-4 py-2">Bs {r.gananciaBruta.toFixed(2)}</td>
                      <td className={
                        `px-4 py-2 ${
                          r.gananciaNeta > 0 ? "text-green-600" :
                          r.gananciaNeta < 0 ? "text-red-600" :
                          "text-gray-600"
                        }`
                      }>Bs {r.gananciaNeta.toFixed(2)}</td>
                      <td className="px-4 py-2">{r.porcentajeUtilidad.toFixed(2)}%</td>
                    </tr>

                    {openRow === r.venta.id && (
                      <tr key={`detail-${r.venta.id}`}>
                        <td colSpan="100%" className="px-4 py-3">
                          <div className="rounded-xl bg-slate-50 p-4">
                            <h3 className="mb-2 font-bold">Productos vendidos</h3>
                            {r.items.map((i, itemIdx) => (
                              <div key={itemIdx} className="flex justify-between border-b py-1 text-sm last:border-b-0">
                                <span>Producto #{i.producto_id} x{i.cantidad}</span>
                                <span className={i.ganancia >= 0 ? "text-green-600" : "text-red-600"}>
                                  Bs {i.ganancia.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))}
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