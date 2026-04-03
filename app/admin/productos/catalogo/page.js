"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import ExpandableDescription from "../../../../components/ui/ExpandableDescription";

// Mover candidateBuckets al nivel de módulo (fuera del componente) para que su referencia sea estable
const candidateBuckets = ["imagenes_del_producto", "productos", "images", "imagenes", "public", "uploads"];

export default function CatalogoPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todas");
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);

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
        } catch { }
      }

      for (const bucket of candidateBuckets) {
        try {
          const res = supabase.storage.from(bucket).getPublicUrl(trimmed);
          const pub = res?.data?.publicUrl || res?.publicURL || res?.publicUrl;
          if (pub) return pub;
        } catch { }
      }
      return null;
    }

    async function load() {
      try {
        const { data: catsData } = await supabase.from("categorias").select("*");
        const categorias = Array.isArray(catsData) ? catsData : [];
        setCategoriasDisponibles(categorias.map(c => c.nombre || c.categori || `Cat-${c.id}`));

        const { data: prodsData } = await supabase.from("v_productos_catalogo").select("producto_id, nombre, descripcion, precio_base, imagen_base, category_id, categoria, stock_total, codigo_barra, variantes").limit(1000);
        const prods = Array.isArray(prodsData) ? prodsData : [];

        const productIds = prods.map(p => p.producto_id).filter(Boolean);
        let costoCompraMap = {};
        if (productIds.length) {
          const { data: costosData } = await supabase
            .from("productos")
            .select("user_id, precio_compra")
            .in("user_id", productIds);
          const costos = Array.isArray(costosData) ? costosData : [];
          costoCompraMap = costos.reduce((acc, it) => {
            acc[String(it.user_id)] = Number(it.precio_compra || 0);
            return acc;
          }, {});
        }

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
          const id = item.producto_id;
          const nombre = item.nombre || "Producto";
          const precio = item.precio_base ?? 0;
          const descripcion = item.descripcion || "";
          const stock = item.stock_total ?? 0;
          const variantes = Array.isArray(item.variantes) ? item.variantes : [];

          const catId = item.category_id;
          let categoriaNombre = "";
          if (catId) {
            const found = categorias.find(c => Number(c.id) === Number(catId));
            categoriaNombre = found ? (found.categori || found.nombre || "") : String(item.categoria || "");
          } else {
            categoriaNombre = String(item.categoria || "");
          }

          const imgsFor = imagenesMap[String(id)] || [];
          const candidatePaths = [...imgsFor];
          if (item.imagen_base) candidatePaths.push(item.imagen_base);

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
            precio_compra: Number(costoCompraMap[String(id)] || 0),
            descripcion,
            stock,
            variantes,
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
    return () => { try { document.head.removeChild(link); } catch { } };
  }, []); // ya no requiere candidateBuckets en deps porque es estable a nivel de módulo

  function formatPrice(v) {
    if (v == null) return "Bs 0.00";
    const num = Number(v) || 0;
    return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Función para mapear nombres de colores a códigos hexadecimales
  const getColorHex = (colorName) => {
    const colorMap = {
      'rojo': '#EF4444',
      'red': '#EF4444',
      'azul': '#3B82F6',
      'blue': '#3B82F6',
      'negro': '#1F2937',
      'black': '#1F2937',
      'blanco': '#FFFFFF',
      'white': '#FFFFFF',
      'verde': '#10B981',
      'green': '#10B981',
      'amarillo': '#FBBF24',
      'yellow': '#FBBF24',
      'naranja': '#F97316',
      'orange': '#F97316',
      'gris': '#6B7280',
      'gray': '#6B7280',
      'rosa': '#EC4899',
      'pink': '#EC4899',
      'púrpura': '#A855F7',
      'purple': '#A855F7',
      'marrón': '#8B5A3C',
      'brown': '#8B5A3C',
      'plateado': '#C0C0C0',
      'silver': '#C0C0C0',
      'dorado': '#FFD700',
      'gold': '#FFD700',
      'único': '#6B7280',
    };
    const normalized = String(colorName || '').trim().toLowerCase();
    return colorMap[normalized] || '#9CA3AF'; // Gris por defecto si no coincide
  };

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
          <a href="https://catalogo-sigma-one.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ color: "#4a0f0f", textDecoration: "underline", marginRight: 12 }}>Visitar web</a>
          <a href="https://wa.me/59177434023" target="_blank" rel="noopener noreferrer" style={{ color: "#4a0f0f", textDecoration: "underline" }}>WhatsApp Business</a>
        </div>
      </header>

      <main style={{ marginTop: 20, width: "100%", maxWidth: 1000 }}>
        {Object.keys(productosPorCategoria).map((categoria) => (
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

            {productosPorCategoria[categoria].map((p, idx) => (
              <div
                key={p.id ?? `${p.nombre ?? 'producto'}-${idx}`}
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
                      <img key={idxImg} src={imgUrl} alt={p.nombre} loading="lazy" style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 8 }} crossOrigin="anonymous" />
                    ))}
                  </div>
                )}

                <h3 style={{ margin: 0, fontSize: 18, color: "#4a0f0f", textAlign: "center" }}>{p.nombre}</h3>
                <strong style={{ fontSize: 16, color: "#004080", textAlign: "center" }}>{formatPrice(p.precio)}</strong>
                <span style={{ fontSize: 13, color: "#2f6f2f", textAlign: "center", fontWeight: 700 }}>Costo: {formatPrice(p.precio_compra)}</span>
                <ExpandableDescription
                  text={p.descripcion}
                  lines={3}
                  textStyle={{ margin: 0, fontSize: 14, textAlign: "center", lineHeight: 1.4 }}
                  buttonStyle={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: "#004080", background: "transparent", border: "none", cursor: "pointer" }}
                />
                
                {/* Mostrar colores disponibles como paleta de círculos */}
                {/* Mostrar colores disponibles como paleta de círculos */}
                {(() => {
                  const coloresEnStock = Array.isArray(p.variantes)
                    ? p.variantes.filter(v => {
                        const colorNormalizado = String(v?.color || '')
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .toLowerCase()
                          .trim();
                        return Number(v?.stock || 0) > 0 && colorNormalizado && colorNormalizado !== 'unico';
                      })
                    : [];
                  if (coloresEnStock.length <= 1) return null;
                  return (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #ddd", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: "bold" }}>Disponible en color:</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                        {coloresEnStock.map((v, vIdx) => {
                            const hexColor = getColorHex(v.color);
                            return (
                              <div key={`${p.id}-${vIdx}`} style={{ position: "relative", cursor: "pointer" }} title={`${v.color} (${Number(v.stock || 0)} disponibles)`}>
                                <div
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    border: "2px solid #ccc",
                                    backgroundColor: hexColor,
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                    transition: "all 0.2s"
                                  }}
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })()}
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
