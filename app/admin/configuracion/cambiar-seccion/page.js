"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/SupabaseClient";
import { useSucursalActiva } from "@/components/admin/SucursalContext";
import { useProductViews } from "@/hooks/useProductViews";
import { normalizeProductView } from "@/lib/productViews";

async function request(options) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`/api/admin/productos/cambiar-seccion${options.query || ""}`, {
    method: options.body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || "No se pudo completar la operación");
  return result;
}

const categoryName = (product) => product.categorias?.categori || product.categoria || "Sin categoría";
const categoryKey = (product) => String(product.category_id ?? `nombre:${categoryName(product)}`);

export default function CambiarSeccionPage() {
  const { activePaisId, activeSucursalId } = useSucursalActiva();
  // Remount on branch changes to avoid retaining selections from another branch.
  return <SectionMover key={`${activePaisId}:${activeSucursalId}`} paisId={activePaisId} sucursalId={activeSucursalId} />;
}

function SectionMover({ paisId, sucursalId }) {
  const { productViews } = useProductViews();
  const [products, setProducts] = useState([]);
  const [source, setSource] = useState("articulos");
  const [destination, setDestination] = useState("insumos");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!paisId || !sucursalId) return;
    const controller = new AbortController();
    request({ query: `?${new URLSearchParams({ paisId, sucursalId })}`, signal: controller.signal })
      .then((result) => { setProducts(result.productos); setLoading(false); })
      .catch((err) => { if (!controller.signal.aborted) { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, [paisId, sucursalId, revision]);

  const sourceProducts = products.filter((p) => normalizeProductView(p.vista_producto) === source);
  const categories = [...new Map(sourceProducts.map((p) => [categoryKey(p), categoryName(p)])).entries()];
  const visible = sourceProducts.filter((p) => (!category || categoryKey(p) === category) &&
    `${p.nombre} ${categoryName(p)} ${p.user_id}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const destinationLabel = productViews.find((view) => view.value === destination)?.label || destination;
  const allSelected = visible.length > 0 && visible.every((p) => selected.includes(p.user_id));

  async function move(event) {
    event.preventDefault();
    if (!selected.length || saving || source === destination) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await request({ body: { paisId, sucursalId, productIds: selected, destino: destination } });
      setProducts((current) => current.map((p) => result.movedIds.includes(p.user_id) ? { ...p, vista_producto: destination } : p));
      setSelected([]);
      setMessage(`${result.movedIds.length} de ${selected.length} artículos trasladados a ${destinationLabel} con su categoría. ${result.movedIds.length < selected.length ? "Algunos artículos ya no estaban disponibles; actualiza la lista." : ""}`);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900";
  return <div className="mx-auto max-w-5xl space-y-5">
    <div><h1 className="text-3xl font-bold text-gray-900">Cambiar de sección</h1>
      <p className="mt-2 text-gray-600">Mueve artículos entre Productos, Insumos y tus otras secciones en la sucursal activa. Conservan su categoría, stock, precios, imágenes e historial.</p>
    </div>
    {!paisId || !sucursalId ? <p>Selecciona un país y una sucursal para continuar.</p> : <form onSubmit={move} className="space-y-5 rounded-xl bg-white p-5 shadow">
      <fieldset disabled={saving || loading} className="space-y-5 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 font-medium">Sección de origen<select className={inputClass} value={source} onChange={(e) => { setSource(e.target.value); setSelected([]); setCategory(""); setMessage(""); }}>
            {productViews.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select></label>
          <label className="space-y-1 font-medium">Sección de destino<select className={inputClass} value={destination} onChange={(e) => setDestination(e.target.value)}>
            {productViews.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select></label>
          <label className="space-y-1 font-medium">Categoría<select className={inputClass} value={category} onChange={(e) => { setCategory(e.target.value); setSelected([]); }}>
            <option value="">Todas las categorías</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label className="space-y-1 font-medium">Buscar artículo<input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, categoría o código" /></label>
        </div>
        <p className="text-sm text-gray-600">La categoría aparecerá junto al artículo en el destino. Si quedan artículos de esa categoría en el origen, también seguirá apareciendo allí. Para mover una categoría completa, filtra por ella y selecciona todos sus artículos.</p>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? selected.filter((id) => !visible.some((p) => p.user_id === id)) : [...new Set([...selected, ...visible.map((p) => p.user_id)])])} />Seleccionar los {visible.length} artículos visibles</label>
        <div className="max-h-96 overflow-auto rounded-lg border divide-y">
          {loading ? <p className="p-4">Cargando artículos…</p> : !visible.length ? <p className="p-4 text-gray-500">No hay artículos con estos filtros.</p> : visible.map((p) => <label key={p.user_id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-gray-50">
            <input type="checkbox" checked={selected.includes(p.user_id)} onChange={() => setSelected((ids) => ids.includes(p.user_id) ? ids.filter((id) => id !== p.user_id) : [...ids, p.user_id])} />
            <span><span className="block font-semibold text-gray-900">{p.nombre}</span><span className="text-sm text-gray-500">{categoryName(p)} · #{p.user_id}</span></span>
          </label>)}
        </div>
        <p className="text-sm">{selected.length} artículos seleccionados. {source === destination ? "Elige una sección de destino diferente." : ""}{selected.length > 500 ? " Mueve hasta 500 artículos por operación." : ""}</p>
        <button type="submit" disabled={!selected.length || selected.length > 500 || source === destination || !destination} className="rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "Moviendo…" : `Mover a ${destinationLabel}`}</button>
      </fieldset>
      {error && <div role="alert" className="text-red-700">{error} <button type="button" disabled={saving || loading} className="underline" onClick={() => { setError(""); setLoading(true); setSelected([]); setRevision((r) => r + 1); }}>Actualizar lista</button></div>}
      {message && <p role="status" className="text-emerald-700">{message}</p>}
    </form>}
  </div>;
}
