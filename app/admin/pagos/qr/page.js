
"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../../../components/ui/card";
import { useQrStats } from "../../../../hooks/useQrStats";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function formatAmount(v) {
  const num = Number(v) || 0;
  return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


export default function PagosQrPage() {
  const { loading, error, stats, rows, chartData, growth, insight } = useQrStats();
  const total = stats?.total || 0;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      {/* KPI PRINCIPAL */}
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <h2 style={{ fontSize: 28, margin: 0 }}>{formatAmount(total)}</h2>
        <p style={{ color: "#666", margin: 0 }}>Ingresos por QR (últimos 30 días)</p>
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
              <Line type="monotone" dataKey="value" stroke="#4a0f0f" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {!loading && !error && insight && (
        <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {insight}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Estadísticas de Pagos QR</CardTitle>
          <CardDescription>Pagos recibidos por QR, discriminando entre sistema y manual (últimos 30 días)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>
              <div style={{ height: 32, background: "#e5e7eb", borderRadius: 6, marginBottom: 16, animation: "pulse 1.2s infinite" }} />
              <div style={{ height: 32, background: "#e5e7eb", borderRadius: 6, marginBottom: 16, animation: "pulse 1.2s infinite" }} />
              <div style={{ height: 32, background: "#e5e7eb", borderRadius: 6, marginBottom: 16, animation: "pulse 1.2s infinite" }} />
            </div>
          ) : error ? (
            <div style={{ color: "red" }}>{error}</div>
          ) : !rows.length ? (
            <div>No hay pagos QR en este periodo</div>
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
                  <strong style={{ fontSize: 22 }}>{formatAmount(total)}</strong>
                  <div>Total QR</div>
                </div>
              </div>
              <div style={{ marginBottom: 12, fontWeight: 500 }}>Pagos recientes (QR):</div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6" }}>
                      <th style={{ textAlign: "left", padding: 6 }}>Fecha</th>
                      <th style={{ textAlign: "left", padding: 6 }}>Origen visual</th>
                      <th style={{ textAlign: "left", padding: 6 }}>Descripción</th>
                      <th style={{ textAlign: "right", padding: 6 }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} style={{ cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                        <td style={{ padding: 6 }}>{r.fecha ? String(r.fecha).slice(0, 10) : "-"}</td>
                        <td style={{ padding: 6 }}>
                          <span style={{ background: r.tipo === "Sistema" ? "#dbeafe" : "#fee2e2", padding: "2px 6px", borderRadius: 6 }}>
                            {r.tipo}
                          </span>
                        </td>
                        <td style={{ padding: 6 }}>{r.descripcion}</td>
                        <td style={{ padding: 6, textAlign: "right", fontWeight: "bold", color: "#111" }}>{formatAmount(r.monto)}</td>
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