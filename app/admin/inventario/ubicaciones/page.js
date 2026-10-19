"use client";

import { useEffect, useRef, useState } from 'react';
import { Printer, FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { normalizeProductView, getProductViewMeta } from '@/lib/productViews';
import ConfirmModal from '@/components/ConfirmModal';
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
const iconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40';

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
  const [productView, setProductView] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [pendingChange, setPendingChange] = useState(null);
  const saveInFlight = useRef(false);
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
  const views = [...new Set(rows.map(p => normalizeProductView(p.vista_producto)))].sort();
  const categoryName = p => (Array.isArray(p.categorias) ? p.categorias[0] : p.categorias)?.categori || '';
  const categories = [...new Set(rows.filter(p => !productView || normalizeProductView(p.vista_producto) === productView).map(categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const filtered = rows.filter(p => `${p.nombre} ${p.codigo_barra || p.user_id} ${location(p)}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))
    && (!productView || normalizeProductView(p.vista_producto) === productView)
    && (!category || (category === '__none' ? !categoryName(p) : categoryName(p) === category))
    && (!box || (box === '__none' ? !location(p) : location(p) === box)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 40) - 1));
  const visible = filtered.slice(currentPage * 40, (currentPage + 1) * 40);
  const dirty = rows.some(p => drafts[p.user_id] !== undefined && drafts[p.user_id].trim() !== location(p));

  function cancelEdit(product) {
    setDrafts(prev => {
      const next = { ...prev };
      delete next[product.user_id];
      return next;
    });
  }
  function validateChange(product) {
    const caja = drafts[product.user_id]?.trim();
    if (!canEdit || exporting || saving !== null || caja === undefined || caja === location(product)) return;
    if (caja.length > 80) { setError('La caja debe tener como maximo 80 caracteres.'); return; }
    setError('');
    if (!location(product)) { void save({ product, caja }); return; }
    setPendingChange({ product, caja });
  }
  async function save(change = pendingChange) {
    if (!change || !canEdit || saveInFlight.current) return;
    const { product, caja } = change;
    saveInFlight.current = true;
    setPendingChange(null);
    setSaving(product.user_id); setError(''); setMessage('');
    try {
      const result = await request('', { method: 'PUT', body: JSON.stringify({ paisId: activePaisId,
        sucursalId: activeSucursalId, productoId: product.user_id, caja }) });
      setRows(prev => prev.map(p => p.user_id === product.user_id ? { ...p, producto_ubicaciones: { caja: result.caja } } : p));
      cancelEdit(product);
      setMessage(`${product.nombre}: ${result.caja || 'sin caja asignada'}.`);
    } catch (err) { setError(err.message); }
    finally { saveInFlight.current = false; setSaving(null); }
  }
  async function print() {
    await Promise.allSettled([...document.querySelectorAll('#box-report img')].map(img => img.decode()));
    window.print();
  }
  async function downloadExcel() {
    setExporting(true); setError(''); setMessage(''); setExportProgress('Preparando Excel...');
    try {
      const { exportBoxInventory } = await import('@/lib/exportBoxInventory');
      const { missing } = await exportBoxInventory({
        products: filtered, productType: productView ? getProductViewMeta(productView).title : '', category: category === '__none' ? 'Sin categoría' : category, branch: activeSucursal?.nombre, box, search, getLocation: location,
        getSources: p => [image(p), ...[...(p.producto_imagenes || [])].sort((a, b) => a.id - b.id).map(i => i.imagen_url)],
        onProgress: (done, total) => setExportProgress(`Preparando fotos: ${done}/${total}`),
      });
      setMessage(`Excel descargado con ${filtered.length} productos.${missing ? ` ${missing} productos sin foto disponible; están señalados en el archivo.` : ''}`);
    } catch { setError('No se pudo generar el Excel. Intenta descargarlo nuevamente.'); }
    finally { setExporting(false); setExportProgress(''); }
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
        <label>Tipo de producto<select className={`${input} mt-1 block`} value={productView} onChange={e => { setProductView(e.target.value); setCategory(''); setPage(0); }}><option value="">Todos los tipos</option>{views.map(v => <option key={v} value={v}>{getProductViewMeta(v).title}</option>)}</select></label>
        <label>Categoría<select className={`${input} mt-1 block`} value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}><option value="">Todas las categorías</option><option value="__none">Sin categoría</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>Caja<select className={`${input} mt-1 block`} value={box} onChange={e => { setBox(e.target.value); setPage(0); }}><option value="">Todas</option><option value="__none">Sin caja asignada</option>{boxes.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
        <div className="flex shrink-0 items-center gap-2 self-end">
          <button type="button" onClick={print} disabled={loading || !!error || !filtered.length || dirty || saving !== null} className={iconButton} aria-label="Imprimir o guardar PDF" title="Imprimir / Guardar PDF"><Printer size={22} strokeWidth={1.75} aria-hidden="true" /></button>
          <button type="button" onClick={downloadExcel} disabled={loading || !filtered.length || dirty || saving !== null || exporting} className={iconButton} aria-label={exporting ? 'Generando Excel' : 'Descargar Excel con fotos'} title={exporting ? 'Generando Excel...' : 'Descargar Excel con fotos'} aria-busy={exporting}>{exporting ? <LoaderCircle size={22} strokeWidth={1.75} className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet size={22} strokeWidth={1.75} aria-hidden="true" />}</button>
        </div>
      </div>
      <p>{filtered.length} productos · {rows.filter(p => !location(p)).length} sin caja asignada</p>
      {canEdit && <p className="text-sm text-slate-600">En los productos sin caja, escribe el número de caja y pulsa Guardar. Para cambiar una caja asignada, pulsa Modificar y confirma el cambio.</p>}
      {dirty && <p className="text-amber-800">Guarda los cambios antes de imprimir o descargar Excel. El reporte incluye todos los resultados del filtro.</p>}
      {exporting && <p role="status" className="text-emerald-800">{exportProgress}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p role="status" className="text-emerald-800">{message}</p>}
      {!activeSucursalId && <p>Selecciona una sucursal.</p>}
      {loading && <p role="status">Cargando productos...</p>}
      <datalist id="box-names">{boxes.map(b => <option key={b} value={b} />)}</datalist>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left"><thead className="bg-slate-100"><tr>{['Foto', 'Producto', 'Código', 'Caja', ...(canEdit ? [''] : [])].map((h, i) => <th key={i} className="p-3">{h}</th>)}</tr></thead><tbody>
        {visible.map(p => {
          const editing = canEdit && (!location(p) || drafts[p.user_id] !== undefined);
          const draft = drafts[p.user_id] ?? '';
          return <tr key={p.user_id} className="border-t">
            <td className="p-3">{photo(p)}</td>
            <td className="p-3 font-semibold">{p.nombre}</td>
            <td className="p-3">{p.codigo_barra || p.user_id}</td>
            <td className="p-3">{editing ? <input aria-label={`Caja de ${p.nombre}`} disabled={saving !== null} list="box-names" maxLength={80} className={`${input} w-44`} placeholder="Ej.: 12 o Caja 12" value={draft} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validateChange(p); } }} onChange={e => setDrafts(prev => ({ ...prev, [p.user_id]: e.target.value }))} /> : location(p) || 'Sin caja asignada'}</td>
            {canEdit && <td className="p-3">{editing ? <div className="flex gap-2">
              <button disabled={saving !== null || exporting || draft.trim() === location(p)} onClick={() => validateChange(p)} className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-40">{saving === p.user_id ? 'Guardando...' : location(p) ? 'Validar cambio' : 'Guardar'}</button>
              <button disabled={saving !== null} onClick={() => cancelEdit(p)} className={`${input} disabled:opacity-40`}>Cancelar</button>
            </div> : <button disabled={saving !== null || exporting} onClick={() => { setDrafts(prev => ({ ...prev, [p.user_id]: location(p) })); setMessage(''); }} className={`${input} disabled:opacity-40`}>Modificar</button>}</td>}
          </tr>;
        })}
      </tbody></table>{!loading && !visible.length && <p className="p-6">No hay productos para estos filtros.</p>}</div>
      <div className="flex items-center gap-4"><button className={input} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Pagina {currentPage + 1} de {Math.max(1, Math.ceil(filtered.length / 40))}</span><button className={input} disabled={(currentPage + 1) * 40 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Siguiente</button></div>
    </div>
    <ConfirmModal visible={!!pendingChange} title="Validar cambio de caja"
      message={pendingChange ? `Producto: ${pendingChange.product.nombre}` : ''}
      detail="Revisa la caja anterior y la nueva antes de confirmar. Todas las variantes comparten esta ubicacion."
      confirmLabel="Confirmar y guardar" cancelLabel="Seguir editando"
      onCancel={() => setPendingChange(null)} onConfirm={() => save()}>
      {pendingChange && <div className="rounded-lg bg-slate-100 p-3 text-sm">
        <p><strong>Caja actual:</strong> {location(pendingChange.product) || 'Sin caja asignada'}</p>
        <p><strong>Nueva caja:</strong> {pendingChange.caja || 'Sin caja asignada'}</p>
        {!pendingChange.caja && <p className="mt-2 text-amber-800">Se quitara la caja asignada a este producto.</p>}
      </div>}
    </ConfirmModal>
    <article id="box-report"><h1>Códigos y cajas de productos</h1><p>{activeSucursal?.nombre} · {new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}</p><p>Tipo: {productView ? getProductViewMeta(productView).title : 'Todos'} · Categoría: {category === '__none' ? 'Sin categoría' : category || 'Todas'} · Caja: {box === '__none' ? 'Sin asignar' : box || 'Todas'} · Busqueda: {search || 'Todas'} · {filtered.length} productos</p><table><thead><tr>{['Imagen principal', 'Producto', 'Código', 'Caja'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(p => <tr key={p.user_id}><td>{photo(p)}</td><td>{p.nombre}</td><td>{p.codigo_barra || p.user_id}</td><td>{location(p) || 'Sin caja asignada'}</td></tr>)}</tbody></table></article>
  </div>;
}
