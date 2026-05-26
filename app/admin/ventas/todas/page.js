"use client";

import { useEffect, useMemo, useState } from 'react';
import DateFilterBar from '../../../../components/venta/dashboard/DateFilterBar';
import KpiCard from '../../../../components/venta/dashboard/KpiCard';
import SalesChart from '../../../../components/venta/dashboard/SalesChart';
import SalesTable from '../../../../components/venta/dashboard/SalesTable';
import TopProductsCard from '../../../../components/venta/dashboard/TopProductsCard';
import { useVentasDashboard } from '../../../../hooks/useVentasDashboard';
import { useSucursalActiva } from '../../../../components/admin/SucursalContext';
import { supabase } from '../../../../lib/SupabaseClient';

function money(value) {
  const num = Number(value) || 0;
  return `Bs ${num.toFixed(2)}`;
}

function pct(value) {
  const num = Number(value) || 0;
  return `${num.toFixed(1)}%`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function itemViewLabel(value) {
  if (value === 'insumos') return 'Insumos';
  if (value === 'packs') return 'Packs';
  return 'Productos';
}

function buildFilteredRow(row, filters) {
  const paymentOk = filters.payment === 'all' || row.metodoPago === filters.payment;
  const profitOk =
    filters.profit === 'all' ||
    (filters.profit === 'profit' && row.ganancia >= 0) ||
    (filters.profit === 'loss' && row.ganancia < 0);

  if (!paymentOk || !profitOk) return null;

  const term = normalizeText(filters.search);
  const rowSearchMatch = Boolean(term && normalizeText(`${row.cliente} ${row.metodoPago} ${row.resumenCompra}`).includes(term));
  const hasItemFilter = Boolean(
    (term && !rowSearchMatch) ||
    filters.product !== 'all' ||
    filters.category !== 'all' ||
    filters.view !== 'all'
  );
  if (!hasItemFilter) return row;

  const matchedItems = (row.items || []).filter((item) => {
    const productOk = filters.product === 'all' || String(item.productoId || '') === String(filters.product);
    const categoryOk = filters.category === 'all' || item.categoria === filters.category;
    const viewOk = filters.view === 'all' || item.vistaProducto === filters.view;
    const searchable = normalizeText(`${item.nombre} ${item.color} ${item.categoria} ${itemViewLabel(item.vistaProducto)}`);
    const searchOk = !term || rowSearchMatch || searchable.includes(term);
    return productOk && categoryOk && viewOk && searchOk;
  });

  if (matchedItems.length === 0) return null;

  const ingresosItems = matchedItems.reduce((sum, item) => sum + (Number(item.ingreso) || 0), 0);
  const costoMercaderia = matchedItems.reduce((sum, item) => sum + (Number(item.costo) || 0), 0);
  const ingresosOriginales = Number(row.ingresosItems || row.total || 0);
  const proporcionVenta = ingresosOriginales > 0 ? Math.min(1, ingresosItems / ingresosOriginales) : 1;
  const totalCobradoFiltrado = Number((Number(row.total || 0) * proporcionVenta).toFixed(2));
  const descuentosFiltrados = Number((Number(row.descuentos || 0) * proporcionVenta).toFixed(2));
  const rebajasFiltradas = Number((Number(row.rebajas || 0) * proporcionVenta).toFixed(2));
  const gananciaProductos = totalCobradoFiltrado - costoMercaderia;
  const cantidadProductos = matchedItems.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);

  return {
    ...row,
    items: matchedItems,
    total: totalCobradoFiltrado,
    costo: costoMercaderia,
    costoMercaderia,
    ingresosItems,
    ganancia: gananciaProductos,
    gananciaProductos,
    margen: totalCobradoFiltrado > 0 ? (gananciaProductos / totalCobradoFiltrado) * 100 : 0,
    descuentos: descuentosFiltrados,
    rebajas: rebajasFiltradas,
    cantidadProductos,
    resumenCompra: `${row.cliente} coincide con ${matchedItems.map((item) => item.nombre).join(', ')}`,
  };
}

function FilterField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function MiniMetric({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-rose-200 bg-rose-50 text-rose-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <div className="text-xs font-semibold opacity-70">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function SalesAnalyticsPanel({ rows, filters, setFilters, options, summary, onClear }) {
  const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-500';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">Analizador interactivo de ventas</h2>
          <p className="text-sm text-slate-500">Combina producto, categoria, tipo, metodo de pago y estado de ganancia.</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Limpiar filtros de abajo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <FilterField label="Producto, color o cliente">
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Ej. vinilo, aretes, rojo"
            className={inputClass}
          />
        </FilterField>
        <FilterField label="Producto">
          <select
            value={filters.product}
            onChange={(e) => setFilters((prev) => ({ ...prev, product: e.target.value }))}
            className={inputClass}
          >
            <option value="all">Todos los productos</option>
            {options.products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Categoria">
          <select
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            className={inputClass}
          >
            <option value="all">Todas las categorias</option>
            {options.categories.map((category) => (
              <option key={category.id || category.name} value={category.name}>{category.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Tipo">
          <select
            value={filters.view}
            onChange={(e) => setFilters((prev) => ({ ...prev, view: e.target.value }))}
            className={inputClass}
          >
            <option value="all">Productos e insumos</option>
            {options.views.map((view) => (
              <option key={view} value={view}>{itemViewLabel(view)}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Pago">
          <select
            value={filters.payment}
            onChange={(e) => setFilters((prev) => ({ ...prev, payment: e.target.value }))}
            className={inputClass}
          >
            <option value="all">Todos los pagos</option>
            {options.payments.map((payment) => (
              <option key={payment} value={payment}>{payment}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Rentabilidad">
          <select
            value={filters.profit}
            onChange={(e) => setFilters((prev) => ({ ...prev, profit: e.target.value }))}
            className={inputClass}
          >
            <option value="all">Todas</option>
            <option value="profit">Con ganancia</option>
            <option value="loss">Con perdida</option>
          </select>
        </FilterField>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <MiniMetric label="Ventas" value={summary.salesCount} tone="cyan" />
        <MiniMetric label="Monto" value={money(summary.total)} />
        <MiniMetric label="Costo" value={money(summary.cost)} />
        <MiniMetric label="Ganancia" value={money(summary.profit)} tone={summary.profit >= 0 ? 'green' : 'red'} />
        <MiniMetric label="Margen" value={pct(summary.margin)} tone={summary.margin >= 0 ? 'green' : 'red'} />
        <MiniMetric label="Rebajas" value={money(summary.rebajas)} tone="amber" />
        <MiniMetric label="Descuentos" value={money(summary.discounts)} tone="amber" />
        <MiniMetric label="Unidades" value={Number(summary.quantity || 0).toFixed(2)} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-black text-slate-800">Resumen por metodo</h3>
          <div className="mt-3 space-y-2">
            {summary.byPayment.length === 0 ? (
              <p className="text-sm text-slate-500">Sin ventas filtradas.</p>
            ) : summary.byPayment.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-700">{item.name}</span>
                <span className="font-black text-slate-900">{money(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-black text-slate-800">Top filtrado</h3>
          <div className="mt-3 space-y-2">
            {summary.topItems.length === 0 ? (
              <p className="text-sm text-slate-500">Sin productos en el filtro.</p>
            ) : summary.topItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-semibold text-slate-700">{item.name}</span>
                <span className="shrink-0 font-black text-slate-900">{money(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-black text-slate-800">Lectura rapida</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>El panel inferior muestra {rows.length} ventas que coinciden con tu filtro.</p>
            <p>Si filtras por producto o categoria, monto y descuentos se prorratean desde el total realmente cobrado.</p>
            <p>Asi el efectivo, QR y transferencia coinciden con caja cuando el filtro cubre toda la venta.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TodasVentasPage() {
  const { activePaisId, activeSucursalId } = useSucursalActiva();
  const [monthFilter, setMonthFilter] = useState('');
  const [catalogOptions, setCatalogOptions] = useState({
    categories: [],
    products: [],
    views: [],
  });
  const [analysisFilters, setAnalysisFilters] = useState({
    search: '',
    product: 'all',
    category: 'all',
    view: 'all',
    payment: 'all',
    profit: 'all',
  });

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
  } = useVentasDashboard(activeSucursalId);

  useEffect(() => {
    let mounted = true;

    async function loadCatalogOptions() {
      const nextOptions = {
        categories: [],
        products: [],
        views: [],
      };

      try {
        let categoriesQuery = supabase
          .from('categorias')
          .select('id, categori')
          .order('categori', { ascending: true });
        if (activePaisId) categoriesQuery = categoriesQuery.eq('pais_id', activePaisId);
        if (activeSucursalId) categoriesQuery = categoriesQuery.eq('sucursal_id', activeSucursalId);
        const categoriesResponse = await categoriesQuery;

        if (!categoriesResponse.error) {
          nextOptions.categories = (categoriesResponse.data || [])
            .map((category) => ({
              id: category.id,
              name: String(category.categori || 'Sin categoria'),
            }))
            .filter((category) => category.name.trim());
        }

        let productsQuery = supabase
          .from('productos')
          .select('user_id, nombre, vista_producto, categoria, category_id, categorias (categori)')
          .order('nombre', { ascending: true });
        if (activeSucursalId) productsQuery = productsQuery.eq('sucursal_id', activeSucursalId);
        let productsResponse = await productsQuery;

        if (productsResponse.error && String(productsResponse.error.message || '').includes('vista_producto')) {
          let fallbackProductsQuery = supabase
            .from('productos')
            .select('user_id, nombre, categoria, category_id, categorias (categori)')
            .order('nombre', { ascending: true });
          if (activeSucursalId) fallbackProductsQuery = fallbackProductsQuery.eq('sucursal_id', activeSucursalId);
          productsResponse = await fallbackProductsQuery;
        }

        if (!productsResponse.error) {
          const viewSet = new Set();
          nextOptions.products = (productsResponse.data || [])
            .map((product) => {
              const view = product.vista_producto === 'insumos' ? 'insumos' : 'articulos';
              viewSet.add(view);
              return {
                id: String(product.user_id),
                name: String(product.nombre || `Producto ${product.user_id}`),
                view,
                category: String(product.categorias?.categori || product.categoria || product.category_id || 'Sin categoria'),
              };
            })
            .filter((product) => product.id && product.name.trim());
          nextOptions.views = Array.from(viewSet).sort((a, b) => a.localeCompare(b));
        }
      } finally {
        if (mounted) setCatalogOptions(nextOptions);
      }
    }

    loadCatalogOptions();
    return () => {
      mounted = false;
    };
  }, [activePaisId, activeSucursalId]);

  const filterOptions = useMemo(() => {
    const categories = new Set();
    const views = new Set();
    const payments = new Set();

    salesRows.forEach((row) => {
      if (row.metodoPago) payments.add(row.metodoPago);
      (row.items || []).forEach((item) => {
        if (item.categoria) categories.add(item.categoria);
        if (item.vistaProducto) views.add(item.vistaProducto);
      });
    });

    const categoryOptions = catalogOptions.categories.length > 0
      ? catalogOptions.categories
      : Array.from(categories)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ id: name, name }));
    const productOptions = catalogOptions.products.length > 0
      ? catalogOptions.products
      : Array.from(
        new Map(
          salesRows.flatMap((row) => (row.items || [])
            .filter((item) => item.productoId)
            .map((item) => [String(item.productoId), { id: String(item.productoId), name: item.nombre }]))
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name));
    const viewOptions = catalogOptions.views.length > 0
      ? catalogOptions.views
      : Array.from(views).filter((view) => view === 'articulos' || view === 'insumos').sort((a, b) => a.localeCompare(b));
    const knownPayments = ['Efectivo', 'QR', 'Tarjeta', 'Transferencia'];

    return {
      categories: categoryOptions,
      products: productOptions,
      views: viewOptions,
      payments: Array.from(new Set([...knownPayments, ...Array.from(payments)])).sort((a, b) => a.localeCompare(b)),
    };
  }, [catalogOptions, salesRows]);

  const filteredRows = useMemo(() => {
    const term = normalizeText(analysisFilters.search);
    return salesRows
      .filter((row) => {
        if (!term) return true;
        const rowText = normalizeText(`${row.cliente} ${row.metodoPago} ${row.resumenCompra}`);
        const itemText = normalizeText((row.items || []).map((item) => `${item.nombre} ${item.color} ${item.categoria}`).join(' '));
        return rowText.includes(term) || itemText.includes(term);
      })
      .map((row) => buildFilteredRow(row, { ...analysisFilters, search: term }))
      .filter(Boolean);
  }, [salesRows, analysisFilters]);

  const filteredSummary = useMemo(() => {
    const total = filteredRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
    const cost = filteredRows.reduce((sum, row) => sum + (Number(row.costoMercaderia) || 0), 0);
    const profit = filteredRows.reduce((sum, row) => sum + (Number(row.ganancia) || 0), 0);
    const quantity = filteredRows.reduce((sum, row) => sum + (Number(row.cantidadProductos) || 0), 0);
    const rebajas = filteredRows.reduce((sum, row) => sum + (Number(row.rebajas) || 0), 0);
    const discounts = filteredRows.reduce((sum, row) => sum + (Number(row.descuentos) || 0), 0);
    const margin = total > 0 ? (profit / total) * 100 : 0;

    const paymentMap = {};
    const itemMap = {};
    filteredRows.forEach((row) => {
      const payment = row.metodoPago || 'No especificado';
      paymentMap[payment] = (paymentMap[payment] || 0) + (Number(row.total) || 0);
      (row.items || []).forEach((item) => {
        const key = item.color ? `${item.nombre} (${item.color})` : item.nombre;
        itemMap[key] = (itemMap[key] || 0) + (Number(item.ingreso) || 0);
      });
    });

    return {
      salesCount: filteredRows.length,
      total,
      cost,
      profit,
      quantity,
      rebajas,
      discounts,
      margin,
      byPayment: Object.entries(paymentMap)
        .map(([name, value]) => ({ name, total: value }))
        .sort((a, b) => b.total - a.total),
      topItems: Object.entries(itemMap)
        .map(([name, value]) => ({ name, total: value }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    };
  }, [filteredRows]);

  const clearAnalysisFilters = () => {
    setAnalysisFilters({
      search: '',
      product: 'all',
      category: 'all',
      view: 'all',
      payment: 'all',
      profit: 'all',
    });
  };

  const handleMonthChange = (month) => {
    setMonthFilter(month || '');

    if (!month) {
      setDateFrom('');
      setDateTo('');
      return;
    }

    const [year, monthPart] = String(month).split('-').map(Number);
    if (!year || !monthPart) return;

    const from = `${year}-${String(monthPart).padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthPart, 0).getDate();
    const to = `${year}-${String(monthPart).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    setDateFrom(from);
    setDateTo(to);
  };

  const handleDateFromChange = (value) => {
    setMonthFilter('');
    setDateFrom(value);
  };

  const handleDateToChange = (value) => {
    setMonthFilter('');
    setDateTo(value);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#e0f2fe,_#f8fafc_42%,_#f1f5f9_78%)] p-4 md:p-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <DateFilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          monthValue={monthFilter}
          onMonthChange={handleMonthChange}
          onDateFromChange={handleDateFromChange}
          onDateToChange={handleDateToChange}
          onClear={() => {
            setMonthFilter('');
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

        <SalesAnalyticsPanel
          rows={filteredRows}
          filters={analysisFilters}
          setFilters={setAnalysisFilters}
          options={filterOptions}
          summary={filteredSummary}
          onClear={clearAnalysisFilters}
        />

        <SalesTable rows={filteredRows} />
      </div>
    </div>
  );
}
