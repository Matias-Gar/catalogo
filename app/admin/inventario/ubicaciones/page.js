"use client";

import { useEffect, useState } from 'react';
import ProductThumbnail from '@/components/venta/ProductThumbnail';
import { supabase } from '@/lib/SupabaseClient';
import { useSucursalActiva } from '@/components/admin/SucursalContext';

const location = product => {
  const entry = product.producto_ubicaciones;
  return (Array.isArray(entry) ? entry[0] : entry)?.caja || '';
};
const image = product => product.imagen_url && product.imagen_url !== '/sin-imagen.png'
  ? product.imagen_url : [...(product.producto_imagenes || [])].sort((a, b) => a.id - b.id)[0]?.imagen_url;
const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';

async function request(params, options = {}) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`/api/admin/inventario/ubicaciones${params}`, { ...options, cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la operacion.');
  return result;
}

export default function UbicacionesPage() {
  const { activePaisId, activeSucursalId } = useSucursalActiva();
  return <Content key={`${activePaisId}/${activeSucursalId}`} />;
}

function Content() {
  const { activePaisId, activeSucursalId, activeSucursal } = useSucursalActiva();
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [box, setBox] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        if (!activePaisId || !activeSucursalId) return;
        const result = await request(`?${new URLSearchParams({ paisId: activePaisId, sucursalId: activeSucursalId })}`, { signal: controller.signal });
        if (!controller.signal.aborted) { setRows(result.rows); setCanEdit(result.canEdit); }
      } catch (err) { if (!controller.signal.aborted) setError(err.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [activePaisId, activeSucursalId]);

  const boxes = [...new Set(rows.map(location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  const filtered = rows.filter(p => `${p.nombre} ${p.codigo_barra || ''} ${location(p)}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))
    && (!box || (box === '__none' ? !location(p) : location(p) === box)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const visible = filtered.slice(page * 40, (page + 1) * 40);
  const dirty = rows.some(p => drafts[p.user_id] !== undefined && drafts[p.user_id].trim() !== location(p));

  async function save(product) {
    setSaving(product.user_id); setError(''); setMessage('');
    try {
      const result = await request('', { method: 'PUT', body: JSON.stringify({ paisId: activePaisId,
        sucursalId: activeSucursalId, productoId: product.user_id, caja: drafts[product.user_id] ?? location(product) }) });
      setRows(prev => prev.map(p => p.user_id === product.user_id ? { ...p, producto_ubicaciones: { caja: result.caja } } : p));
      setDrafts(prev => ({ ...prev, [product.user_id]: result.caja }));
      setMessage(`${product.nombre}: ${result.caja || 'sin caja asignada'}.`);
    } catch (err) { setError(err.message); }
    finally { setSaving(null); }
  }
  async function print() {
    await Promise.allSettled([...document.querySelectorAll('#box-report img')].map(img => img.decode()));
    window.print();
  }
  const photo = p => <ProductThumbnail name={p.nombre} size={64} sources={[
    image(p), ...[...(p.producto_imagenes || [])].sort((a, b) => a.id - b.id).map(i => i.imagen_url)
  ]} />;
  return <div className="mx-auto max-w-6xl space-y-5 p-4 text-slate-900">
    <style>{`#box-report { display: none; } @media print { @page { size: A4 portrait; margin: 12mm; } body * { visibility: hidden !important; } #box-report, #box-report * { visibility: visible !important; } #box-report { display: block; position: absolute; left: 0; top: 0; width: 100%; background: white; } #box-report table { width: 100%; border-collapse: collapse; font-size: 10pt; } #box-report td, #box-report th { border: 1px solid #bbb; padding: 6px; text-align: left; } #box-report tr { break-inside: avoid; } #box-report thead { display: table-header-group; } .box-controls { display: none !important; } }`}</style>
    <div className="box-controls space-y-5">
      <header><h1 className="text-3xl font-bold">Bodega y cajas</h1><p className="mt-2 text-slate-600">Guarda la caja de cada producto para encontrarlo rapido. Todas sus variantes comparten esta ubicacion.</p></header>
      <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <label className="flex-1">Buscar producto, codigo o caja<input className={`${input} mt-1 w-full`} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Ej.: ABC de Gatitos" /></label>
        <label>Caja<select className={`${input} mt-1 block`} value={box} onChange={e => { setBox(e.target.value); setPage(0); }}><option value="">Todas</option><option value="__none">Sin caja asignada</option>{boxes.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
        <button onClick={print} disabled={loading || !!error || !filtered.length || dirty || saving !== null} className="self-end rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-40">Imprimir / Guardar PDF</button>
      </div>
      <p>{filtered.length} productos · {rows.filter(p => !location(p)).length} sin caja asignada</p>
      {dirty && <p className="text-amber-800">Guarda los cambios antes de imprimir. El reporte incluye todos los resultados del filtro.</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p role="status" className="text-emerald-800">{message}</p>}
      {!activeSucursalId && <p>Selecciona una sucursal.</p>}
      {loading && <p role="status">Cargando productos...</p>}
      <datalist id="box-names">{boxes.map(b => <option key={b} value={b} />)}</datalist>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left"><thead className="bg-slate-100"><tr>{['Foto', 'Producto', 'Stock total', 'Caja', ...(canEdit ? [''] : [])].map((h, i) => <th key={i} className="p-3">{h}</th>)}</tr></thead><tbody>
        {visible.map(p => <tr key={p.user_id} className="border-t"><td className="p-3">{photo(p)}</td><td className="p-3 font-semibold">{p.nombre}<div className="text-xs font-normal text-slate-500">{p.codigo_barra}</div></td><td className="p-3">{Number(p.stock || 0)} {p.unidad_base || 'unidad'}</td><td className="p-3">{canEdit ? <input aria-label={`Caja de ${p.nombre}`} list="box-names" maxLength={80} className={`${input} w-44`} placeholder="Ej.: Caja 1" value={drafts[p.user_id] ?? location(p)} onChange={e => setDrafts(prev => ({ ...prev, [p.user_id]: e.target.value }))} /> : location(p) || 'Sin caja asignada'}</td>{canEdit && <td className="p-3"><button disabled={saving !== null || drafts[p.user_id] === undefined || drafts[p.user_id].trim() === location(p)} onClick={() => save(p)} className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-40">{saving === p.user_id ? 'Guardando...' : 'Guardar'}</button></td>}</tr>)}
      </tbody></table>{!loading && !visible.length && <p className="p-6">No hay productos para estos filtros.</p>}</div>
      <div className="flex items-center gap-4"><button className={input} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Pagina {page + 1} de {Math.max(1, Math.ceil(filtered.length / 40))}</span><button className={input} disabled={(page + 1) * 40 >= filtered.length} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>
    </div>
    <article id="box-report"><h1>Stock y ubicacion de productos</h1><p>{activeSucursal?.nombre} · {new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}</p><p>Caja: {box === '__none' ? 'Sin asignar' : box || 'Todas'} · Busqueda: {search || 'Todas'} · {filtered.length} productos</p><table><thead><tr>{['Imagen principal', 'Producto', 'Caja', 'Stock total', 'Unidad'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(p => <tr key={p.user_id}><td>{photo(p)}</td><td>{p.nombre}</td><td>{location(p) || 'Sin caja asignada'}</td><td>{Number(p.stock || 0)}</td><td>{p.unidad_base || 'unidad'}</td></tr>)}</tbody></table></article>
  </div>;
}
