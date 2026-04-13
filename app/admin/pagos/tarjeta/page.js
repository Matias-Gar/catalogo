
"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";

function formatAmount(v) {
  const num = Number(v) || 0;
  return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useMetodoStats } from "../../../../hooks/useMetodoStats";

export default function PagosTarjetaPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        // Rango: últimos 30 días
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 29);
        const startDate = start.toISOString().slice(0, 10);
        const endDate = today.toISOString().slice(0, 10);

        // Traer resumen de caja (incluye ventas y movimientos manuales)
        const { getCashSummary } = await import("../../../../services/cash.service.js");
        const summary = await getCashSummary(supabase, {
          start_date: startDate,
          end_date: endDate,
        });

        // Filtrar solo tarjeta
        const pagosSistema = (summary.sales || []).filter(s => s.modo_pago && (s.modo_pago.toLowerCase() === "tarjeta" || s.modo_pago.toLowerCase() === "card"));
        const pagosManual = (summary.movements || []).filter(m => m.payment_method === "card" && m.type === "income");

        setStats({
          totalSistema: pagosSistema.reduce((acc, s) => acc + Number(s.total || 0), 0),
          totalManual: pagosManual.reduce((acc, m) => acc + Number(m.amount || 0), 0),
          countSistema: pagosSistema.length,
          countManual: pagosManual.length,
        });
        // Listado de los últimos 20 pagos tarjeta (sistema y manual)
        const pagosRecientes = [
          ...pagosSistema.map(s => ({
            id: `venta-${s.id}`,
            fecha: s.fecha,
            tipo: "Sistema",
            monto: s.total,
            ref: s.id,
            descripcion: `Venta #${s.id}`,
          })),
          ...pagosManual.map(m => ({
            id: `manual-${m.id}`,
            fecha: m.date,
            tipo: "Manual",
            monto: m.amount,
            ref: m.id,
            descripcion: m.description || "Ingreso manual tarjeta",
          })),
        ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 20);
        setRows(pagosRecientes);
      } catch (err) {
        setError("Error cargando estadísticas de pagos tarjeta");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const { loading, error, stats, rows, chartData, growth } = useMetodoStats("card", "Tarjeta", ["tarjeta"]);
  const total = stats?.total || 0;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      {/* KPI PRINCIPAL */}
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <h2 style={{ fontSize: 28, margin: 0 }}>{formatAmount(total)}</h2>
        <p style={{ color: "#666", margin: 0 }}>Ingresos con tarjeta (últimos 30 días)</p>
        {growth !== null && (
          <p style={{ color: growth >= 0 ? "green" : "red", fontWeight: 500, margin: 0, fontSize: 16 }}>
            {growth >= 0 ? "▲" : "▼"} {Math.abs(growth).toFixed(1)}%
          </p>
        )}
      </div>

      {/* GRÁFICO */}
      <div style={{ width: "100%", height: 180, marginBottom: 24, background: "#f9fafb", borderRadius: 12, padding: 8 }}>
        {loading ? (
          <div style={{ width: "100%", height: 160, background: "#e5e7eb", borderRadius: 8, animation: "pulse 1.2s infinite" }} />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <XAxis dataKey="date" tickFormatter={d => d.slice(5)} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={formatAmount} labelFormatter={d => `Día ${d.slice(5)}`} />
              <Line type="monotone" dataKey="value" stroke="#004080" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* TABLA DE PAGOS */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos recientes</CardTitle>
          <CardDescription>Últimos 20 ingresos con tarjeta (sistema y manual)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div style={{ height: 180, display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 24, background: "#e5e7eb", borderRadius: 6, width: `${80 + Math.random() * 20}%`, animation: "pulse 1.2s infinite" }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ color: "red", padding: 12 }}>{error}</div>
          ) : rows.length === 0 ? (
            <div style={{ color: "#888", padding: 12 }}>No hay pagos registrados con tarjeta.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>Fecha</th>
                    <th style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>Tipo</th>
                    <th style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>Monto</th>
                    <th style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 8 }}>{row.fecha?.slice(0, 10) || "-"}</td>
                      <td style={{ padding: 8 }}>{row.tipo}</td>
                      <td style={{ padding: 8 }}>{formatAmount(row.monto)}</td>
                      <td style={{ padding: 8 }}>{row.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}