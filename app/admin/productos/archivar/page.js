"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { getOptimizedImageUrl, buildImageSrcSet } from "../../../../lib/imageOptimization";
import { useSucursalActiva } from "../../../../components/admin/SucursalContext";
import { productMatchesSearch } from "../../../../lib/searchMatching";

function getCategoryName(prod) {
  return String(prod?.categorias?.categori || prod?.categoria || prod?.category_id || "Sin categoria").trim();
}

export default function ArchivarProductos() {
  const { activePaisId, activeSucursalId, activePais, activeSucursal, loading: contextLoading, error: contextError } = useSucursalActiva();
  const [productos, setProductos] = useState([]);
  const [imagenes, setImagenes] = useState({});
  const [variantes, setVariantes] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState("activos");
  const [orden, setOrden] = useState("alfabetico");
  const inputRef = useRef();

  useEffect(() => {
    let cancelled = false;
    async function fetchProductos() {
      // Clear the previous operation before querying the newly selected scope.
      setProductos([]);
      setImagenes({});
      setVariantes({});
      setCategoria("");
      if (contextLoading || !activePaisId || !activeSucursalId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");

      let query = supabase
        .from("productos")
        .select("user_id, pais_id, sucursal_id, nombre, precio, stock, categoria, category_id, codigo_barra, created_at, archivado, categorias (categori)")
        .order("nombre", { ascending: true })
        .limit(1500);
      if (activePaisId) query = query.eq("pais_id", activePaisId);
      if (activeSucursalId) query = query.eq("sucursal_id", activeSucursalId);

      const { data, error: loadError } = await query;
      if (cancelled) return;
      if (loadError) {
        const message = String(loadError?.message || "");
        setProductos([]);
        setImagenes({});
        setVariantes({});
        setError(
          message.includes("archivado")
            ? "Falta la columna archivado en Supabase. Ejecuta scripts/archive_products.sql y vuelve a cargar."
            : `Error cargando productos: ${message}`
        );
        setLoading(false);
        return;
      }

      const productosData = Array.isArray(data) ? data : [];
      setProductos(productosData);

      const ids = productosData.map((p) => p.user_id).filter(Boolean);
      if (ids.length === 0) {
        setImagenes({});
        setVariantes({});
        setLoading(false);
        return;
      }

      let imgsQuery = supabase
        .from("producto_imagenes")
        .select("producto_id, imagen_url")
        .in("producto_id", ids);
      if (activePaisId) imgsQuery = imgsQuery.eq("pais_id", activePaisId);
      if (activeSucursalId) imgsQuery = imgsQuery.eq("sucursal_id", activeSucursalId);
      const { data: imgs } = await imgsQuery;
      if (cancelled) return;
      const groupedImages = {};
      (imgs || []).forEach((img) => {
        if (!groupedImages[img.producto_id]) groupedImages[img.producto_id] = [];
        if (img.imagen_url) groupedImages[img.producto_id].push(img.imagen_url);
      });
      setImagenes(groupedImages);

      let variantesQuery = supabase
        .from("producto_variantes")
        .select("producto_id, color, sku")
        .in("producto_id", ids);
      if (activePaisId) variantesQuery = variantesQuery.eq("pais_id", activePaisId);
      if (activeSucursalId) variantesQuery = variantesQuery.eq("sucursal_id", activeSucursalId);
      const { data: variantesData } = await variantesQuery;
      if (cancelled) return;
      const groupedVariants = {};
      (variantesData || []).forEach((variant) => {
        const key = String(variant.producto_id);
        if (!groupedVariants[key]) groupedVariants[key] = [];
        groupedVariants[key].push(variant);
      });
      setVariantes(groupedVariants);
      setLoading(false);
    }
    fetchProductos().catch((loadError) => {
      if (cancelled) return;
      setError(`Error cargando productos: ${loadError.message || loadError}`);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activePaisId, activeSucursalId, contextLoading]);

  async function toggleArchivado(prod) {
    if (contextLoading || !activePaisId || !activeSucursalId || savingId ||
        String(prod.pais_id) !== String(activePaisId) || String(prod.sucursal_id) !== String(activeSucursalId)) return;
    const nextArchived = !Boolean(prod.archivado);
    const verb = nextArchived ? "archivar" : "desarchivar";
    if (!window.confirm(`¿Deseas ${verb} "${prod.nombre}" en ${activePais?.nombre || "el país seleccionado"} / ${activeSucursal?.nombre || "la sucursal seleccionada"}?`)) return;

    setSavingId(prod.user_id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Tu sesi\u00f3n ha expirado. Vuelve a iniciar sesi\u00f3n.");
      const response = await fetch("/api/admin/productos/archivar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: Number(prod.user_id), paisId: activePaisId, sucursalId: activeSucursalId, archivado: nextArchived }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo guardar el estado");
      if (result.warning) alert(result.warning);

      setProductos((prev) =>
        prev.map((item) =>
          String(item.user_id) === String(prod.user_id) && String(item.pais_id) === String(prod.pais_id) && String(item.sucursal_id) === String(prod.sucursal_id)
            ? { ...item, archivado: nextArchived }
            : item
        )
      );
    } catch (err) {
      alert(`No se pudo ${verb} el producto: ${err?.message || err}`);
    } finally {
      setSavingId(null);
    }
  }

  const categoriasDisponibles = useMemo(() => {
    return Array.from(new Set(productos.map((p) => getCategoryName(p)).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const filtered = productos.filter((p) => {
      if (String(p.pais_id) !== String(activePaisId) || String(p.sucursal_id) !== String(activeSucursalId)) return false;
      const categoryName = getCategoryName(p);
      const matchesState =
        estado === "todos" ||
        (estado === "archivados" ? Boolean(p.archivado) : !Boolean(p.archivado));
      const matchesSearch = productMatchesSearch({ ...p, variantes: variantes[String(p.user_id)] || [] }, term, [categoryName]);
      return matchesState && matchesSearch && (!categoria || categoryName === categoria);
    });

    return [...filtered].sort((a, b) => {
      if (orden === "recientes") return new Date(b.created_at) - new Date(a.created_at);
      if (orden === "stock") return Number(b.stock || 0) - Number(a.stock || 0);
      return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
    });
  }, [productos, variantes, busqueda, categoria, estado, orden, activePaisId, activeSucursalId]);

  const totals = useMemo(() => {
    const scoped = productos.filter((p) => String(p.pais_id) === String(activePaisId) && String(p.sucursal_id) === String(activeSucursalId));
    const archived = scoped.filter((p) => Boolean(p.archivado)).length;
    return { archived, active: scoped.length - archived };
  }, [productos, activePaisId, activeSucursalId]);

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Archivar Productos</h1>
        <p className="mt-1 text-sm text-gray-600">
          Archivar oculta el producto del catalogo, ventas, busquedas y reportes sin borrar su historial.
        </p>
      </div>

      <p className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 font-semibold text-indigo-950" role="status">
        {contextLoading ? "Cargando país y sucursal..." : `País: ${activePais?.nombre || "Sin seleccionar"} / Sucursal: ${activeSucursal?.nombre || "Sin seleccionar"}`}
      </p>
      {contextError && <p role="alert" className="mb-4 text-red-700">{contextError}</p>}
      {!contextLoading && (!activePaisId || !activeSucursalId) && <p className="mb-4 text-gray-900">Selecciona un país y una sucursal para administrar sus productos.</p>}
      <div className="mb-4 grid gap-2 rounded-lg border bg-white p-3 shadow-sm md:grid-cols-4">
        <div className="rounded border p-3">
          <p className="text-xs font-bold uppercase text-gray-500">Activos</p>
          <p className="text-xl font-bold text-green-700">{totals.active}</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-xs font-bold uppercase text-gray-500">Archivados</p>
          <p className="text-xl font-bold text-gray-900">{totals.archived}</p>
        </div>
        <div className="rounded border p-3 md:col-span-2">
          <p className="text-xs font-bold uppercase text-gray-500">Mostrando</p>
          <p className="text-xl font-bold text-gray-900">{productosFiltrados.length}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          className="w-full max-w-xs rounded border px-3 py-2 text-gray-900 placeholder-gray-600"
          placeholder="Buscar por nombre, ID, codigo o categoria..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select className="rounded border px-3 py-2 text-gray-900" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="activos">Solo activos</option>
          <option value="archivados">Solo archivados</option>
          <option value="todos">Todos</option>
        </select>
        <select className="rounded border px-3 py-2 text-gray-900" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorias</option>
          {categoriasDisponibles.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select className="rounded border px-3 py-2 text-gray-900" value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="alfabetico">A-Z</option>
          <option value="recientes">Mas recientes primero</option>
          <option value="stock">Mayor stock</option>
        </select>
        <button
          className="rounded bg-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-300"
          onClick={() => {
            setBusqueda("");
            setCategoria("");
            setEstado("activos");
            setOrden("alfabetico");
            inputRef.current?.focus();
          }}
        >
          Limpiar filtros
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {loading || contextLoading ? (
          <div className="col-span-full text-gray-700">Cargando productos...</div>
        ) : productosFiltrados.length === 0 ? (
          <div className="col-span-full text-gray-700">No hay productos con esos filtros.</div>
        ) : (
          productosFiltrados.map((prod) => {
            const archived = Boolean(prod.archivado);
            return (
              <Card key={prod.user_id} className={archived ? "border-gray-400 bg-gray-50" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-gray-900">{prod.nombre}</CardTitle>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${archived ? "bg-gray-800 !text-white" : "bg-green-100 text-green-800"}`}>
                      {archived ? "Archivado" : "Activo"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-2">
                    {imagenes[prod.user_id]?.[0] ? (
                      <img
                        src={getOptimizedImageUrl(imagenes[prod.user_id][0], 280)}
                        srcSet={buildImageSrcSet(imagenes[prod.user_id][0], [140, 280, 560], { quality: 95, format: "origin" })}
                        sizes="112px"
                        loading="lazy"
                        decoding="async"
                        alt={prod.nombre}
                        className={`h-28 w-28 rounded-lg border object-cover shadow ${archived ? "grayscale" : ""}`}
                      />
                    ) : (
                      <span className="text-gray-400">Sin imagen</span>
                    )}
                    <div className="mt-2 text-sm font-semibold text-gray-900">Precio: {activePais?.moneda_simbolo || activePais?.moneda_codigo || ""} {Number(prod.precio || 0).toFixed(2)}</div>
                    <div className="text-gray-900">Stock: <span className={Number(prod.stock || 0) < 3 ? "font-bold text-red-600" : ""}>{prod.stock || 0}</span></div>
                    <div className="text-gray-900">Categoria: {getCategoryName(prod) || "-"}</div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => toggleArchivado(prod)}
                    className={`w-full font-bold !text-white disabled:!text-white ${archived ? "bg-green-700 hover:bg-green-800" : "bg-gray-800 hover:bg-gray-900"}`}
                    disabled={Boolean(savingId) || contextLoading || !activePaisId || !activeSucursalId}
                  >
                    {savingId === prod.user_id ? "Guardando..." : archived ? "Desarchivar" : "Archivar"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
