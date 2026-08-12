"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";


import { getOptimizedImageUrl, buildImageSrcSet } from "../../../../lib/imageOptimization";
import { useSucursalActiva } from "../../../../components/admin/SucursalContext";
import { productMatchesSearch } from "../../../../lib/searchMatching";


function getCategoryName(prod) {
  return String(prod?.categorias?.categori || prod?.categoria || prod?.category_id || "Sin categoria").trim();
}

function EliminarProductos() {
  const { activePaisId, activeSucursalId } = useSucursalActiva();
  const [productos, setProductos] = useState([]);
  const [imagenes, setImagenes] = useState({});
  const [variantes, setVariantes] = useState({});
  const [eliminando, setEliminando] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [orden, setOrden] = useState("recientes");
  const inputRef = useRef();

  useEffect(() => {
    async function fetchProductos() {
      setLoading(true);
      let query = supabase
        .from("productos")
        .select("user_id, nombre, precio, stock, categoria, category_id, codigo_barra, created_at, categorias (categori)");
      if (activePaisId) query = query.eq("pais_id", activePaisId);
      if (activeSucursalId) query = query.eq("sucursal_id", activeSucursalId);
      const { data, error } = await query;
      if (error) {
        console.error("Error cargando productos para eliminar:", error);
        setProductos([]);
        setImagenes({});
        setLoading(false);
        return;
      }

      const productosData = Array.isArray(data) ? data : [];
      setProductos(productosData);
        // Obtener imágenes
        const ids = productosData.map(p => p.user_id).filter(Boolean);
        if (ids.length > 0) {
          let imgsQuery = supabase
            .from("producto_imagenes")
            .select("producto_id, imagen_url")
            .in("producto_id", ids);
          if (activePaisId) imgsQuery = imgsQuery.eq("pais_id", activePaisId);
          if (activeSucursalId) imgsQuery = imgsQuery.eq("sucursal_id", activeSucursalId);
          const { data: imgs } = await imgsQuery;
          const agrupadas = {};
          (imgs || []).forEach(img => {
            if (!agrupadas[img.producto_id]) agrupadas[img.producto_id] = [];
            agrupadas[img.producto_id].push(img.imagen_url);
          });
          setImagenes(agrupadas);
        } else {
          setImagenes({});
        }
        if (ids.length > 0) {
          let variantesQuery = supabase
            .from("producto_variantes")
            .select("producto_id, color, sku")
            .in("producto_id", ids);
          if (activePaisId) variantesQuery = variantesQuery.eq("pais_id", activePaisId);
          if (activeSucursalId) variantesQuery = variantesQuery.eq("sucursal_id", activeSucursalId);
          const { data: variantesData } = await variantesQuery;
          const agrupadasVariantes = {};
          (variantesData || []).forEach((variant) => {
            const key = String(variant.producto_id);
            if (!agrupadasVariantes[key]) agrupadasVariantes[key] = [];
            agrupadasVariantes[key].push(variant);
          });
          setVariantes(agrupadasVariantes);
        } else {
          setVariantes({});
        }
      setLoading(false);
    }
    fetchProductos();
  }, [eliminando, activePaisId, activeSucursalId]);

  const eliminarProducto = async (user_id) => {
    const reason = window.prompt("Motivo para retirar este producto de las vistas (permanecerá en auditoría):");
    if (!reason?.trim()) return;
    setEliminando(user_id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Sesión no disponible");
      const response = await fetch("/api/admin/productos/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: Number(user_id), paisId: activePaisId, sucursalId: activeSucursalId, reason: reason.trim() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error || "No se pudo retirar el producto");
    } catch (err) {
      window.alert(err?.message || "No se pudo retirar el producto");
    } finally {
      setEliminando(null);
    }
  };

  // --- Filtros y ordenamiento ---
  const categoriasDisponibles = useMemo(() => {
    return Array.from(new Set(productos.map(p => getCategoryName(p)).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [productos]);

  let productosFiltrados = productos.filter(p => {
    const categoryName = getCategoryName(p);
    const term = busqueda.trim().toLowerCase();
    const matchesSearch = productMatchesSearch({ ...p, variantes: variantes[String(p.user_id)] || [] }, term, [categoryName]);

    return matchesSearch && (!categoria || categoryName === categoria);
  });
  if (orden === "recientes") {
    productosFiltrados = productosFiltrados.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (orden === "alfabetico") {
    productosFiltrados = productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } else if (orden === "stock") {
    productosFiltrados = productosFiltrados.sort((a, b) => b.stock - a.stock);
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Eliminar Artículos</h1>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          ref={inputRef}
          className="border rounded px-3 py-2 w-full max-w-xs text-gray-900 placeholder-gray-600"
          placeholder="Buscar por nombre, ID, codigo o categoria..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2 text-gray-900"
          value={categoria}
          onChange={e => setCategoria(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-2 text-gray-900"
          value={orden}
          onChange={e => setOrden(e.target.value)}
        >
          <option value="recientes">Más recientes primero</option>
          <option value="alfabetico">A-Z</option>
          <option value="stock">Mayor stock</option>
        </select>
        <button
          className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-700"
          onClick={() => {
            setBusqueda("");
            setCategoria("");
            setOrden("recientes");
            inputRef.current?.focus();
          }}
        >Limpiar filtros</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-gray-700">Cargando productos...</div>
        ) : productosFiltrados.length === 0 ? (
          <div className="col-span-full text-gray-700">No hay productos para eliminar con esos filtros.</div>
        ) : (
          productosFiltrados.map(prod => (
            <Card key={prod.user_id}>
              <CardHeader>
                <CardTitle className="text-gray-900">{prod.nombre}</CardTitle>
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
                      alt="img"
                      className="h-28 w-28 object-cover rounded-lg border shadow"
                    />
                  ) : (
                    <span className="text-gray-400">Sin imagen</span>
                  )}
                  <div className="text-gray-900 text-sm mt-2 font-semibold">Precio: Bs {Number(prod.precio).toFixed(2)}</div>
                  <div className="text-gray-900">Stock: <span className={prod.stock < 3 ? 'text-red-600 font-bold' : ''}>{prod.stock}</span></div>
                  <div className="text-gray-900">Categoría: {getCategoryName(prod) || '-'}</div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => eliminarProducto(prod.user_id)} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold" disabled={eliminando === prod.user_id}>
                  {eliminando === prod.user_id ? "Eliminando..." : "Eliminar"}
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default EliminarProductos;
