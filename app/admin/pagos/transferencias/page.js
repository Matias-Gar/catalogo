
"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";

function formatAmount(v) {
  const num = Number(v) || 0;
  return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PagosTransferenciasPage() {
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

        // Filtrar solo transferencias
        const pagosSistema = (summary.sales || []).filter(s => s.modo_pago && s.modo_pago.toLowerCase() === "transferencia");
        const pagosManual = (summary.movements || []).filter(m => m.payment_method === "transfer" && m.type === "income");

        setStats({
          totalSistema: pagosSistema.reduce((acc, s) => acc + Number(s.total || 0), 0),
          totalManual: pagosManual.reduce((acc, m) => acc + Number(m.amount || 0), 0),
          countSistema: pagosSistema.length,
          countManual: pagosManual.length,
        });
        // Listado de los últimos 20 pagos transferencia (sistema y manual)
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
            descripcion: m.description || "Ingreso manual transferencia",
          })),
        ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 20);
        setRows(pagosRecientes);
      } catch (err) {
        setError("Error cargando estadísticas de pagos transferencia");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas de Pagos por Transferencia</CardTitle>
          <CardDescription>Pagos recibidos por transferencia, discriminando entre sistema y manual (últimos 30 días)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Cargando...</div>
          ) : error ? (
            <div style={{ color: "red" }}>{error}</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
                <div>
                  <strong style={{ fontSize: 22, color: "#004080" }}>{formatAmount(stats.totalSistema)}</strong>
                  <div>Por sistema</div>
                  <div style={{ fontSize: 13, color: "#666" }}>{stats.countSistema} pagos</div>
                </div>
                <div>
                  <strong style={{ fontSize: 22, color: "#4a0f0f" }}>{formatAmount(stats.totalManual)}</strong>
                  <div>Manual</div>
                  <div style={{ fontSize: 13, color: "#666" }}>{stats.countManual} pagos</div>
                </div>
                <div>
                  <strong style={{ fontSize: 22 }}>{formatAmount((stats.totalSistema || 0) + (stats.totalManual || 0))}</strong>
                  <div>Total Transferencia</div>
                </div>
              </div>
              <div style={{ marginBottom: 12, fontWeight: 500 }}>Pagos recientes (Transferencia):</div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6" }}>
                      <th style={{ textAlign: "left", padding: 6 }}>Fecha</th>
                      <th style={{ textAlign: "left", padding: 6 }}>Tipo</th>
                      <th style={{ textAlign: "left", padding: 6 }}>Descripción</th>
                      <th style={{ textAlign: "right", padding: 6 }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id}>
                        <td style={{ padding: 6 }}>{r.fecha ? String(r.fecha).slice(0, 10) : "-"}</td>
                        <td style={{ padding: 6 }}>{r.tipo}</td>
                        <td style={{ padding: 6 }}>{r.descripcion}</td>
                        <td style={{ padding: 6, textAlign: "right" }}>{formatAmount(r.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}