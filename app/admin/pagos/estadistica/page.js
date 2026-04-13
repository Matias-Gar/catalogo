
"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../../../components/ui/card";

function formatAmount(v) {
  const num = Number(v) || 0;
  return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const METODOS = [
  { key: "cash", label: "Efectivo", color: "#004080" },
  { key: "qr", label: "QR", color: "#4a0f0f" },
  { key: "card", label: "Tarjeta", color: "#0a7b83" },
  { key: "transfer", label: "Transferencia", color: "#7b3f00" },
  { key: "other", label: "Otro", color: "#666" },
];

export default function PagosEstadisticaPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        // Totales por método y tipo
        const totales = {};
        METODOS.forEach(m => {
          totales[m.key] = {
            sistema: 0,
            manual: 0,
            countSistema: 0,
            countManual: 0,
          };
        });
        (summary.sales || []).forEach(s => {
          const key = (s.modo_pago || "other").toLowerCase();
          const metodo = key === "efectivo" ? "cash" : key === "tarjeta" ? "card" : key === "transferencia" ? "transfer" : key;
          if (totales[metodo]) {
            totales[metodo].sistema += Number(s.total || 0);
            totales[metodo].countSistema += 1;
          }
        });
        (summary.movements || []).forEach(m => {
          if (m.type === "income" && totales[m.payment_method]) {
            totales[m.payment_method].manual += Number(m.amount || 0);
            totales[m.payment_method].countManual += 1;
          }
        });
        setStats({ totales });
      } catch (err) {
        setError("Error cargando estadísticas generales de pagos");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas Generales de Pagos</CardTitle>
          <CardDescription>Resumen profesional de todos los métodos de pago (últimos 30 días, sistema y manual)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Cargando...</div>
          ) : error ? (
            <div style={{ color: "red" }}>{error}</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 32 }}>
                {METODOS.map(m => (
                  <div key={m.key} style={{ minWidth: 160, flex: 1 }}>
                    <div style={{ fontWeight: 600, color: m.color, fontSize: 18 }}>{m.label}</div>
                    <div style={{ fontSize: 22, color: m.color, fontWeight: 700 }}>{formatAmount((stats.totales[m.key]?.sistema || 0) + (stats.totales[m.key]?.manual || 0))}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>Sistema: {formatAmount(stats.totales[m.key]?.sistema)} ({stats.totales[m.key]?.countSistema} pagos)</div>
                    <div style={{ fontSize: 13, color: "#666" }}>Manual: {formatAmount(stats.totales[m.key]?.manual)} ({stats.totales[m.key]?.countManual} pagos)</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 15, color: "#333", marginTop: 16 }}>
                <strong>Total general:</strong> {formatAmount(METODOS.reduce((acc, m) => acc + (stats.totales[m.key]?.sistema || 0) + (stats.totales[m.key]?.manual || 0), 0))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}