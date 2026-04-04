"use client";

import DateFilterBar from '../../../../components/venta/dashboard/DateFilterBar';
import KpiCard from '../../../../components/venta/dashboard/KpiCard';
import SalesChart from '../../../../components/venta/dashboard/SalesChart';
import SalesTable from '../../../../components/venta/dashboard/SalesTable';
import TopProductsCard from '../../../../components/venta/dashboard/TopProductsCard';
import { useVentasDashboard } from '../../../../hooks/useVentasDashboard';

function money(value) {
  const num = Number(value) || 0;
  return `Bs ${num.toFixed(2)}`;
}

export default function TodasVentasPage() {
  const {
    loading,
    error,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    kpis,
    salesRows,
    salesByDay,
    topProducts,
  } = useVentasDashboard();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#e0f2fe,_#f8fafc_42%,_#f1f5f9_78%)] p-4 md:p-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Analytics</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Dashboard de Ventas</h1>
          <p className="mt-2 text-sm text-slate-600">Vista financiera con ganancias, márgenes y rendimiento diario.</p>
        </div>

        <DateFilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClear={() => {
            setDateFrom('');
            setDateTo('');
          }}
        />

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            ❌ {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Total ventas" value={loading ? '...' : kpis.totalVentas} tone="info" />
          <KpiCard title="Total ganancias" value={loading ? '...' : money(kpis.totalGanancias)} tone="success" />
          <KpiCard title="Total descuentos" value={loading ? '...' : money(kpis.totalDescuentos)} tone="warning" />
          <KpiCard title="Ticket promedio" value={loading ? '...' : money(kpis.ticketPromedio)} tone="neutral" />
          <KpiCard title="Productos vendidos" value={loading ? '...' : kpis.productosVendidos} tone="info" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SalesChart data={salesByDay} />
          </div>
          <TopProductsCard products={topProducts} />
        </div>

        <SalesTable rows={salesRows} />
      </div>
    </div>
  );
}