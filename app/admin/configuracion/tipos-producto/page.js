"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/SupabaseClient";
import { showToast } from "@/components/ui/Toast";
import { getProductViewPublicPath } from "@/lib/productViews";
import { useSucursalActiva } from "@/components/admin/SucursalContext";
import { buildCountryPath } from "@/lib/countryRoutes";

export default function TiposProductoPage() {
  const { activePais } = useSucursalActiva();
  const [tipos, setTipos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [editingSlug, setEditingSlug] = useState("");
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);

  async function request(path, options = {}) {
    const { data } = await supabase.auth.getSession();
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}`, ...(options.headers || {}) },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw new Error(result?.error || "No se pudo completar la operacion");
    return result;
  }

  async function load() {
    try { setTipos((await request("/api/admin/tipos-producto")).tipos || []); }
    catch (error) { showToast(error.message, "error"); }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createType(event) {
    event.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      await request("/api/admin/tipos-producto", { method: "POST", body: JSON.stringify({ nombre }) });
      setNombre("");
      await load();
      showToast("Tipo de producto creado");
    } catch (error) { showToast(error.message, "error"); }
    finally { setSaving(false); }
  }

  async function toggle(tipo) {
    try {
      await request("/api/admin/tipos-producto", { method: "PATCH", body: JSON.stringify({ slug: tipo.slug, activo: !tipo.activo }) });
      await load();
    } catch (error) { showToast(error.message, "error"); }
  }

  async function rename(tipo) {
    const nextName = editingName.trim();
    if (!nextName) return;
    try {
      await request("/api/admin/tipos-producto", { method: "PATCH", body: JSON.stringify({ slug: tipo.slug, nombre: nextName }) });
      setEditingSlug("");
      setEditingName("");
      await load();
      showToast("Nombre actualizado");
    } catch (error) { showToast(error.message, "error"); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Tipos de producto</h1>
        <p className="mt-2 text-gray-600">Crea catálogos separados como Artículos e Insumos. Cada tipo tendrá su propia vista pública.</p>
      </div>
      <form onSubmit={createType} className="flex gap-3 rounded-xl bg-white p-5 shadow">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Moldes, Repuestos, Materia prima" className="min-w-0 flex-1 rounded-lg border px-4 py-3" />
        <button disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "Creando..." : "Agregar tipo"}</button>
      </form>
      <div className="grid gap-3">
        {tipos.map((tipo) => {
          const publicPath = buildCountryPath(activePais?.slug || "bo", getProductViewPublicPath(tipo.slug));
          return <div key={tipo.slug} className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              {editingSlug === tipo.slug ? <input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="w-full max-w-sm rounded-lg border px-3 py-2 font-semibold" autoFocus /> : <div className="text-lg font-bold text-gray-900">{tipo.nombre}</div>}
              <code className="text-xs text-gray-500">{publicPath}</code>
            </div>
            <div className="flex gap-2">
              {editingSlug === tipo.slug ? <>
                <button onClick={() => rename(tipo)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">Guardar</button>
                <button onClick={() => setEditingSlug("")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Cancelar</button>
              </> : <button onClick={() => { setEditingSlug(tipo.slug); setEditingName(tipo.nombre); }} className="rounded-lg border px-3 py-2 text-sm font-semibold">Renombrar</button>}
              <Link href={publicPath} target="_blank" className="rounded-lg border px-3 py-2 text-sm font-semibold">Ver catálogo</Link>
              {!tipo.protegido && <button onClick={() => toggle(tipo)} className={`rounded-lg px-3 py-2 text-sm font-bold text-white ${tipo.activo ? "bg-red-600" : "bg-emerald-600"}`}>{tipo.activo ? "Desactivar" : "Activar"}</button>}
              {tipo.protegido && <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-500">Tipo base</span>}
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}
