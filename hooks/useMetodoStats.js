import { useState, useEffect } from "react";
import { supabase } from "../lib/SupabaseClient";

export function useMetodoStats(metodoKey, metodoLabel, metodoKeys = []) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [growth, setGrowth] = useState(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        // Fechas actuales
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 29);
        const startDate = start.toISOString().slice(0, 10);
        const endDate = today.toISOString().slice(0, 10);

        // Fechas anteriores
        const prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - 30);
        const prevStartDate = prevStart.toISOString().slice(0, 10);
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevEndDate = prevEnd.toISOString().slice(0, 10);

        const { getCashSummary } = await import("../services/cash.service.js");
        // Actual
        const summary = await getCashSummary(supabase, {
          start_date: startDate,
          end_date: endDate,
        });
        // Anterior
        const prevSummary = await getCashSummary(supabase, {
          start_date: prevStartDate,
          end_date: prevEndDate,
        });

        // Actual
        const pagosSistema = (summary.sales || []).filter(s => {
          const key = (s.modo_pago || "other").toLowerCase();
          return metodoKeys.includes(key);
        });
        const pagosManual = (summary.movements || []).filter(m => metodoKeys.includes(m.payment_method) && m.type === "income");
        const totalSistema = pagosSistema.reduce((acc, s) => acc + Number(s.total || 0), 0);
        const totalManual = pagosManual.reduce((acc, m) => acc + Number(m.amount || 0), 0);
        const countSistema = pagosSistema.length;
        const countManual = pagosManual.length;
        const total = totalSistema + totalManual;
        // Anterior
        const prevPagosSistema = (prevSummary.sales || []).filter(s => {
          const key = (s.modo_pago || "other").toLowerCase();
          return metodoKeys.includes(key);
        });
        const prevPagosManual = (prevSummary.movements || []).filter(m => metodoKeys.includes(m.payment_method) && m.type === "income");
        const prevTotal = prevPagosSistema.reduce((acc, s) => acc + Number(s.total || 0), 0) + prevPagosManual.reduce((acc, m) => acc + Number(m.amount || 0), 0);
        // Crecimiento
        let growth = null;
        if (prevTotal > 0) {
          growth = ((total - prevTotal) / prevTotal) * 100;
        } else if (total > 0) {
          growth = 100;
        } else {
          growth = 0;
        }
        setGrowth(growth);
        setStats({ totalSistema, totalManual, countSistema, countManual, total });
        // Tabla
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
            descripcion: m.description || `Ingreso manual ${metodoLabel}`,
          })),
        ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 20);
        setRows(pagosRecientes);
        // Gráfico: ingresos por día
        const ingresosPorDia = {};
        for (let i = 0; i < 30; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          ingresosPorDia[key] = 0;
        }
        pagosSistema.forEach(s => {
          const key = String(s.fecha).slice(0, 10);
          if (ingresosPorDia[key] !== undefined) ingresosPorDia[key] += Number(s.total || 0);
        });
        pagosManual.forEach(m => {
          const key = String(m.date).slice(0, 10);
          if (ingresosPorDia[key] !== undefined) ingresosPorDia[key] += Number(m.amount || 0);
        });
        setChartData(Object.entries(ingresosPorDia).map(([date, value]) => ({ date, value })));
      } catch (err) {
        console.error(err);
        setError(err.message || "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [metodoKey]);

  return { loading, error, stats, rows, chartData, growth };
}
