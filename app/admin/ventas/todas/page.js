"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";

export default function TodasVentasPage() {
  const [ventas, setVentas] = useState([]);
  const [detalles, setDetalles] = useState({});
  useEffect(() => {
    async function fetchVentas() {
      const { data, error } = await supabase
        .from("ventas")
        .select("id, cliente_nombre, cliente_telefono, total, fecha");
      if (!error && data) {
        setVentas(data);
        // Obtener detalles
        const ids = data.map(v => v.id);
        if (ids.length > 0) {
          const { data: dets } = await supabase
            .from("ventas_detalle")
            .select("venta_id, producto_id, cantidad, precio_unitario");
          if (dets) {
            const agrupados = {};
            dets.forEach(d => {
              if (!agrupados[d.venta_id]) agrupados[d.venta_id] = [];
              agrupados[d.venta_id].push(d);
            });
            setDetalles(agrupados);
          }
        }
      }
    }
    fetchVentas();
  }, []);

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-4">Todas las Ventas</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ventas.length === 0 ? (
          <div className="col-span-full text-gray-900">No hay ventas registradas.</div>
        ) : (
          ventas.map(v => (
            <div key={v.id} className="bg-white rounded-xl shadow p-6 flex flex-col gap-2">
              <div className="text-gray-900 font-bold">Venta #{v.id}</div>
              <div className="text-gray-900">Cliente: {v.cliente_nombre || '-'}</div>
              <div className="text-gray-900">Teléfono: {v.cliente_telefono || '-'}</div>
              <div className="text-gray-900">Total: <span className="font-bold">Bs {Number(v.total).toFixed(2)}</span></div>
              <div className="text-gray-900">Fecha: {new Date(v.fecha).toLocaleString()}</div>
              <div className="text-gray-900 font-semibold mt-2">Productos:</div>
              <ul className="list-disc pl-6">
                {(detalles[v.id] || []).map((d, i) => (
                  <li key={i} className="text-gray-900">
                    Producto #{d.producto_id} x{d.cantidad} (Bs {Number(d.precio_unitario).toFixed(2)})
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}