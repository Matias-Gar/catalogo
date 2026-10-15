"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/SupabaseClient';
import { useSucursalActiva } from '@/components/admin/SucursalContext';

const modes = { resumen: 'Resumen por producto', ingresos: 'Ingresos de mercadería', ventas: 'Ventas', devoluciones: 'Devoluciones / anulaciones', muestras: 'Salidas a muestrario', salidas: 'Otras salidas', movimientos: 'Todos los movimientos', conteo: 'Hoja de conteo con fotos' };
const number = value => value === null ? 'Sin dato' : Number(value || 0).toLocaleString('es-BO', { maximumFractionDigits: 4 });
const day = (offset = 0) => new Date(Date.now() - 4 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
const date = value => new Date(value).toLocaleString('es-BO', { timeZone: 'America/La_Paz' });
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm';

export default function ReportesPage() {
  const { activeSucursalId } = useSucursalActiva();
  return <ReportContent key={activeSucursalId} />;
}

function ReportContent() {
  const { activePaisId, activeSucursalId, activeSucursal } = useSucursalActiva();
  const [from, setFrom] = useState(() => day(-1));
  const [to, setTo] = useState(() => day());
  const [mode, setMode] = useState('resumen');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [photos, setPhotos] = useState(false);
  const [orientation, setOrientation] = useState('landscape');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const requestKey = `${activePaisId}/${activeSucursalId}/${from}/${to}/${reload}`;

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (controller.signal.aborted) return;
        setData(null);
        setLoading(false);
        setError('');
        if (!activePaisId || !activeSucursalId) return;
        if (!from || !to || from > to) { setError('Selecciona fechas válidas: desde debe ser anterior o igual a hasta.'); return; }
        setLoading(true);
        const params = new URLSearchParams({ paisId: activePaisId, sucursalId: activeSucursalId, from, to });
        const response = await fetch(`/api/admin/inventario/reportes?${params}`, { headers: { Authorization: `Bearer ${session?.session?.access_token || ''}` }, signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) setData({ ...result, key: requestKey });
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message || 'No se pudo cargar el reporte.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [activePaisId, activeSucursalId, from, to, reload, requestKey]);

  const ready = data?.key === requestKey && !loading && !error;
  const products = useMemo(() => ready ? data.rows : [], [ready, data]);
  const types = [...new Set(products.map(p => p.vista_producto || 'articulos'))].sort();
  const categories = [...new Set(products.filter(p => !type || (p.vista_producto || 'articulos') === type).map(p => p.categorias?.categori || 'Sin categoría'))].sort();
  const filtered = products.filter(p => (!type || (p.vista_producto || 'articulos') === type) && (!category || (p.categorias?.categori || 'Sin categoría') === category) && `${p.nombre} ${p.codigo_barra || ''} ${p.user_id}`.toLowerCase().includes(search.toLowerCase().trim()));
  const productMap = new Map(filtered.map(p => [String(p.user_id), p]));
  const detailed = !['resumen', 'conteo'].includes(mode);
  const rows = detailed ? (ready ? data.events : []).filter(m => productMap.has(String(m.producto_id)) && (mode === 'movimientos' || m.group === mode)) : filtered.filter(p => mode === 'conteo' ? !p.archivado : true).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const showPhotos = photos || mode === 'conteo';
  const headers = detailed ? ['Fecha (Bolivia)', 'Código', 'Producto / variante', 'Movimiento', 'Cantidad base', 'Unidad', 'Motivo'] : mode === 'conteo' ? ['Código', 'Producto', 'Unidad', 'Stock actual', 'Conteo físico', 'Observaciones'] : ['Código', 'Producto', 'Unidad', 'Ingresos', 'Ventas', 'Devoluciones', 'Muestras', 'Otras salidas', 'Stock actual'];
  const values = row => {
    const p = detailed ? productMap.get(String(row.producto_id)) : row;
    const code = p.codigo_barra || p.user_id;
    if (detailed) return [date(row.created_at), code, `${p.nombre}${row.variante_id ? ` · Variante ${row.variante_id}` : ''}`, row.tipo, number(row.quantity), row.unidad_base || p.unidad_base || 'unidad', row.motivo || row.observaciones || '—'];
    if (mode === 'conteo') return [code, p.nombre, p.unidad_base || 'unidad', number(p.actual), '', ''];
    return [code, p.nombre, p.unidad_base || 'unidad', number(p.ingresos), number(p.ventas), number(p.devoluciones), number(p.muestras), number(p.salidas), number(p.actual)];
  };
  const totals = new Map();
  for (const row of rows) {
    const p = detailed ? productMap.get(String(row.producto_id)) : row;
    const unit = (detailed && row.unidad_base) || p.unidad_base || 'unidad';
    if (!totals.has(unit)) totals.set(unit, { cantidad: 0, ingresos: 0, ventas: 0, devoluciones: 0, muestras: 0, salidas: 0, actual: 0 });
    const total = totals.get(unit);
    if (detailed) total.cantidad += row.quantity;
    else for (const key of ['ingresos', 'ventas', 'devoluciones', 'muestras', 'salidas', 'actual']) total[key] += Number(row[key] || 0);
  }
  function exportCSV() {
    const escape = value => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const csv = [headers, ...rows.map(values)].map(row => row.map(escape).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `reporte-${mode}-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  async function print() {
    await Promise.allSettled([...document.querySelectorAll('#inventory-report img')].map(img => img.decode()));
    window.print();
  }
  return <div className="mx-auto max-w-7xl space-y-5 p-4 text-slate-900 sm:p-8">
    <style>{`@media print { @page { size: A4 ${orientation}; margin: 10mm; } html, body, main { overflow: visible !important; height: auto !important; } body * { visibility: hidden !important; } #inventory-report, #inventory-report * { visibility: visible !important; } #inventory-report { position: absolute; left: 0; top: 0; width: 100%; font-size: 9pt; } #inventory-report .report-scroll { overflow: visible !important; } #inventory-report table { font-size: 8pt; width: 100%; } #inventory-report th, #inventory-report td { padding: 5px; } #inventory-report tr { break-inside: avoid; } #inventory-report thead { display: table-header-group; } .report-controls { display: none !important; } }`}</style>
    <header className="report-controls"><h1 className="text-3xl font-bold">Imprimir reportes</h1><p className="mt-2 text-slate-600">Elige fechas, tipo y categoría para preparar tu reporte de inventario.</p></header>
    <Link href="/admin/inventario/ubicaciones" className="report-controls inline-block rounded-lg border bg-white px-4 py-2 font-semibold text-emerald-800">Imprimir stock con fotos y cajas</Link>
    <section className="report-controls rounded-2xl border bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label>Reporte<select className={inputClass} value={mode} onChange={e => setMode(e.target.value)}>{Object.entries(modes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Desde<input type="date" className={inputClass} value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
        <label>Hasta<input type="date" className={inputClass} value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
        <label>Tipo de producto<select className={inputClass} value={type} onChange={e => { setType(e.target.value); setCategory(''); }}><option value="">Todos los tipos</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        <label>Categoría<select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas las categorías</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Buscar producto o código<input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Ej.: molde de corazón" /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{[['Hoy', 0], ['Ayer', -1], ['Ayer y hoy', -2], ['Últimos 7 días', -6], ['Últimos 30 días', -29]].map(([label, offset]) => <button key={label} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100" onClick={() => { setFrom(day(offset === -2 ? -1 : offset)); setTo(day(offset === -1 ? -1 : 0)); }}>{label}</button>)}</div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2"><input type="checkbox" checked={showPhotos} disabled={mode === 'conteo'} onChange={e => setPhotos(e.target.checked)} />Incluir fotos</label>
        <label>Orientación<select aria-label="Orientación de impresión" className="ml-2 rounded border p-2" value={orientation} onChange={e => setOrientation(e.target.value)}><option value="landscape">Horizontal</option><option value="portrait">Vertical</option></select></label>
        <button className="rounded-lg border px-4 py-2" onClick={() => setReload(n => n + 1)} disabled={loading}>Actualizar</button>
        <button className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-40" disabled={!ready || !rows.length} onClick={print}>Imprimir / Guardar PDF</button>
        <button className="rounded-lg border px-4 py-2 disabled:opacity-40" disabled={!ready || !rows.length} onClick={exportCSV}>Descargar CSV</button>
      </div>
    </section>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    {!activeSucursalId && <p>Selecciona una sucursal para consultar sus reportes.</p>}
    {loading && <p role="status">Preparando todos los artículos y movimientos…</p>}
    {ready && <article id="inventory-report" className="rounded-xl border bg-white p-4">
      <h2 className="text-xl font-bold">{modes[mode]}</h2>
      <p>{activeSucursal?.nombre || 'Sucursal seleccionada'} · {from} al {to} · Hora de Bolivia (UTC−4)</p>
      <p>Tipo: {type || 'Todos'} · Categoría: {category || 'Todas'}{search && ` · Búsqueda: ${search}`} · {rows.length} registros</p>
      <p className="my-2 text-xs text-slate-600">Generado: {date(data.generatedAt)}. Los movimientos corresponden al período; el stock actual corresponde a la consulta, no al cierre de la fecha elegida. Cantidades en unidad base.</p>
      <p className="mb-3 text-xs text-slate-600">Historial registrado: las aperturas de saldos heredados no se cuentan como ingresos. Muestras = salidas con motivo de muestrario; no representa un conteo actual de exhibición. Las devoluciones se muestran por separado de las ventas.</p>
      {rows.length === 0 ? <p className="py-8 text-center">No hay registros para estos filtros.</p> : <>
        <div className="report-scroll overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="bg-slate-100">{showPhotos && <th className="border p-2">Foto</th>}{headers.map(h => <th className="border p-2" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, index) => {
          const p = detailed ? productMap.get(String(row.producto_id)) : row;
          const photo = p.imagen_url || p.producto_imagenes?.[0]?.imagen_url;
          return <tr key={detailed ? row.id : row.user_id} className={index % 2 ? 'bg-slate-50' : ''}>{showPhotos && <td className="border p-2">{photo ? <img src={photo} alt={p.nombre} className="h-14 w-14 object-contain" /> : '—'}</td>}{values(row).map((value, i) => <td key={i} className="border p-2" style={mode === 'conteo' && i >= 4 ? { minWidth: 90, height: 65 } : undefined}>{value}</td>)}</tr>;
        })}</tbody></table></div>
        <div className="mt-4 space-y-1 text-sm">{[...totals].map(([unit, t]) => <p key={unit}><strong>Total ({unit}): </strong>{detailed ? `${number(t.cantidad)} · cantidades de movimientos, no saldo neto` : mode === 'conteo' ? `Stock actual: ${number(t.actual)}` : `Ingresos: ${number(t.ingresos)} · Ventas: ${number(t.ventas)} · Devoluciones: ${number(t.devoluciones)} · Muestras: ${number(t.muestras)} · Otras salidas: ${number(t.salidas)} · Stock actual: ${number(t.actual)}`}</p>)}</div>
      </>}
    </article>}
  </div>;
}
