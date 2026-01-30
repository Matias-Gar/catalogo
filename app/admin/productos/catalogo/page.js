"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";

export default function CatalogoPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todas");
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);

  const candidateBuckets = ["imagenes_del_producto", "productos", "images", "imagenes", "public", "uploads"];

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    async function tryGetPublicUrlFromBuckets(path) {
      if (!path) return null;
      if (typeof path !== "string") path = String(path);
      if (path.startsWith("http://") || path.startsWith("https://")) return path;

      const trimmed = path.replace(/^\/+/, "");
      const parts = trimmed.split("/");

      if (parts.length > 1) {
        const maybeBucket = parts[0];
        const maybePath = parts.slice(1).join("/");
        try {
          const res = supabase.storage.from(maybeBucket).getPublicUrl(maybePath);
          const pub = res?.data?.publicUrl || res?.publicURL || res?.publicUrl;
          if (pub) return pub;
        } catch (e) {}
      }

      for (const bucket of candidateBuckets) {
        try {
          const res = supabase.storage.from(bucket).getPublicUrl(trimmed);
          const pub = res?.data?.publicUrl || res?.publicURL || res?.publicUrl;
          if (pub) return pub;
        } catch (e) {}
      }
      return null;
    }

    async function load() {
      try {
        const { data: catsData } = await supabase.from("categorias").select("*");
        const categorias = Array.isArray(catsData) ? catsData : [];
        setCategoriasDisponibles(categorias.map(c => c.nombre || c.categori || `Cat-${c.id}`));

        const { data: prodsData } = await supabase.from("productos").select("*").limit(1000);
        const prods = Array.isArray(prodsData) ? prodsData : [];

        // <-- FIX: use product ids (item.id) instead of user_id
        const productIds = prods.map(p => p.id).filter(Boolean);
        let imagenesMap = {};
        if (productIds.length) {
          const { data: imgsData } = await supabase
            .from("producto_imagenes")
            .select("producto_id, imagen_url")
            .in("producto_id", productIds);
          const imgs = Array.isArray(imgsData) ? imgsData : [];
          imagenesMap = imgs.reduce((acc, it) => {
            const id = String(it.producto_id);
            acc[id] = acc[id] || [];
            if (it.imagen_url) acc[id].push(it.imagen_url);
            return acc;
          }, {});
        }

        const processed = await Promise.all(prods.map(async item => {
-          const id = item.user_id;
+          const id = item.id; // <-- FIX: use actual product id
           const nombre = item.nombre || item.name || "Producto";
           const precio = item.precio ?? item.price ?? 0;
           const descripcion = item.descripcion || item.description || "";
           const stock = item.stock ?? 0;

           const catId = item.category_id ?? item.category_id;
           let categoriaNombre = "";
           if (catId) {
             const found = categorias.find(c => Number(c.id) === Number(catId));
             categoriaNombre = found ? (found.categori || found.nombre || "") : String(item.categoria || "");
           } else {
             categoriaNombre = String(item.categoria || "");
           }

           const imgsFor = imagenesMap[String(id)] || [];
           const candidatePaths = [...imgsFor];
           if (item.imagen_url) candidatePaths.push(item.imagen_url);

           let imagenPublicUrls = [];
           for (const p of candidatePaths) {
             if (!p) continue;
             if (typeof p === "string" && (p.startsWith("http://") || p.startsWith("https://"))) {
               imagenPublicUrls.push(p);
               continue;
             }
             const pub = await tryGetPublicUrlFromBuckets(p);
             if (pub) imagenPublicUrls.push(pub);
           }

           return {
             id,
             nombre,
             precio,
             descripcion,
             stock,
             categoriaNombre: categoriaNombre || "Sin categoría",
             imagenPublicUrls
           };
         }));

        setProductos(processed);
      } catch (err) {
        console.error("Error cargando catálogo:", err);
        setProductos([]);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => { try { document.head.removeChild(link); } catch (e) {} };
  }, []);

  function formatPrice(v) {
    if v == null) return "Bs 0.00";
    const num = Number(v) || 0;
    return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const productosFiltrados = categoriaSeleccionada === "Todas"
    ? productos
    : productos.filter(p => p.categoriaNombre === categoriaSeleccionada);

  async function exportPdf() {
    if (exporting) return;
    setExporting(true);
    try {
      if (typeof window.html2pdf === "undefined") {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.2/html2pdf.bundle.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const element = document.getElementById("catalogo-root");
      if (!element) throw new Error("Elemento del catálogo no encontrado");

      const controles = element.querySelectorAll(".no-export");
      controles.forEach(c => c.style.display = "none");

      const imgs = element.querySelectorAll("img");
      imgs.forEach(img => img.setAttribute("crossOrigin", "anonymous"));

      const opt = {
        margin: 0,
        filename: `catalogo_street_wear_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };

      await window.html2pdf().set(opt).from(element).save();

      controles.forEach(c => c.style.display = "inline-block");
    } catch (err) {
      console.error("Error exportando PDF:", err);
      alert("Error al generar PDF; revisa la consola. Las imágenes deben ser públicas y con CORS habilitado.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Cargando catálogo...</div>;

  const productosPorCategoria = productosFiltrados.reduce((acc, p) => {
    const cat = p.categoriaNombre.trim() || "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div id="catalogo-root" style={{ 
      fontFamily: "'Roboto', sans-serif", 
      padding: 24, 
      background: '#fdf5f5', 
      color: '#333', 
      minHeight: '100vh', 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center" 
    }}>
      {/* PORTADA */}
      <header style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 52, margin: 6, color: "#4a0f0f" }}>Street Wear</h1>
        <p style={{ fontSize: 18, color: "#004080" }}>Catálogo Profesional</p>

        <div className="no-export" style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={exportPdf}
            disabled={exporting}
            style={{ background: "#004080", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: "bold", fontSize: 16 }}
          >
            {exporting ? "Generando PDF..." : "Exportar PDF"}
          </button>

          <select
            value={categoriaSeleccionada}
            onChange={e => setCategoriaSeleccionada(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc", minWidth: 180, cursor: "pointer" }}
          >
            <option value="Todas">Todas las categorías</option>
            {categoriasDisponibles.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 8, fontSize: 14 }}>
          <a href="https://catalogo-sigma-one.vercel.app/" target="_blank" style={{ color: "#4a0f0f", textDecoration: "underline", marginRight: 12 }}>Visitar web</a>
          <a href="https://wa.me/59177434023" target="_blank" style={{ color: "#4a0f0f", textDecoration: "underline" }}>WhatsApp Business</a>
        </div>
      </header>

      <main style={{ marginTop: 20, width: "100%", maxWidth: 1000 }}>
        {Object.keys(productosPorCategoria).map((categoria, idxCat) => (
          <div key={categoria}>
            <div style={{
              background: `linear-gradient(135deg, #4a0f0f, #004080)`,
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
              marginBottom: 16
            }}>
              <h2 style={{ color: "#fff", letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>{categoria}</h2>
            </div>

            {productosPorCategoria[categoria].map((p) => (
              <div
                key={p.id ?? `${p.nombre}-${Math.random()}`}
                className="producto-card"
                style={{
                  position: "relative",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.9)",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                  pageBreakInside: "avoid",
                  marginBottom: 24,
                  transition: "transform 0.2s",
                  overflow: "hidden"
                }}
              >
                {p.stock === 0 && (
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background: "rgba(255,0,0,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                    fontWeight: "bold",
                    color: "red",
                    textAlign: "center",
                    borderRadius: 12
                  }}>
                    AGOTADO
                  </div>
                )}

                {p.imagenPublicUrls.length > 0 && (
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", justifyContent: "center" }}>
                    {p.imagenPublicUrls.map((imgUrl, idxImg) => (
                      <img key={idxImg} src={imgUrl} alt={p.nombre} style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 8 }} crossOrigin="anonymous" />
                    ))}
                  </div>
                )}

                <h3 style={{ margin: 0, fontSize: 18, color: "#4a0f0f", textAlign: "center" }}>{p.nombre}</h3>
                <strong style={{ fontSize: 16, color: "#004080", textAlign: "center" }}>{formatPrice(p.precio)}</strong>
                <p style={{ margin: 0, fontSize: 14, textAlign: "center", lineHeight: 1.4 }}>{p.descripcion}</p>
              </div>
            ))}
          </div>
        ))}
      </main>

      <footer style={{ marginTop: 30, textAlign: 'center', color: '#4a0f0f', fontSize: 12 }}>
        Catálogo Street Wear — Generado automáticamente
      </footer>
    </div>
  );
}
