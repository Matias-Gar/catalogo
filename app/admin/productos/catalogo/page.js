"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { useRouter } from "next/navigation";
import { getOptimizedImageUrl, buildImageSrcSet } from "../../../../lib/imageOptimization";

// Mover candidateBuckets al nivel de módulo (fuera del componente) para que su referencia sea estable
const candidateBuckets = ["imagenes_del_producto", "productos", "images", "imagenes", "public", "uploads"];

export default function CatalogoPage() {
  const router = useRouter();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todas");
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [userRole, setUserRole] = useState("checking");

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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUserRole("not_logged");
          router.push("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", user.id)
          .single();

        if (profileError || !profile || profile.rol !== "admin") {
          setUserRole(profile?.rol || "cliente");
          router.push("/");
          return;
        }

        setUserRole("admin");

        const { data: catsData } = await supabase.from("categorias").select("*");
        const categorias = Array.isArray(catsData) ? catsData : [];
        setCategoriasDisponibles(categorias.map(c => c.nombre || c.categori || `Cat-${c.id}`));

        const { data: prodsData } = await supabase
          .from("productos")
          .select("user_id, nombre, descripcion, precio, stock, imagen_url, category_id, codigo_barra, categorias (categori)")
          .order("created_at", { ascending: false })
          .limit(1000);
        const prods = Array.isArray(prodsData) ? prodsData : [];

        const productIds = prods.map(p => p.user_id).filter(Boolean);

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

        let variantesMap = {};
        if (productIds.length) {
          const { data: varsData } = await supabase
            .from("producto_variantes")
            .select("id, producto_id, color, stock, precio, sku, activo")
            .in("producto_id", productIds)
            .order("color", { ascending: true });
          const vars = Array.isArray(varsData) ? varsData : [];
          variantesMap = vars.reduce((acc, it) => {
            const pid = String(it.producto_id);
            acc[pid] = acc[pid] || [];
            acc[pid].push(it);
            return acc;
          }, {});
        }

        const processed = await Promise.all(prods.map(async item => {
          const id = item.user_id;
          const nombre = item.nombre || "Producto";
          const precio = item.precio ?? 0;
          const descripcion = item.descripcion || "";
          const stock = item.stock ?? 0;
          const variantes = variantesMap[String(id)] || [];

          const catId = item.category_id;
          let categoriaNombre = "";
          if (catId) {
            const found = categorias.find(c => Number(c.id) === Number(catId));
            categoriaNombre = found
              ? (found.categori || found.nombre || "")
              : String(item?.categorias?.categori || "");
          } else {
            categoriaNombre = String(item?.categorias?.categori || "");
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
  }, [router]); // ya no requiere candidateBuckets en deps porque es estable a nivel de módulo

  function formatPrice(v) {
    if (v == null) return "Bs 0.00";
    const num = Number(v) || 0;
    return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const normalizeColorName = (colorName) =>
    String(colorName || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Devuelve estilos visuales para mostrar el color de forma fiel en el swatch.
  const getColorStyle = (colorName) => {
    const normalized = normalizeColorName(colorName);

    if (!normalized) return { backgroundColor: '#9CA3AF' };

    if (normalized.includes('animal print')) {
      return {
        backgroundColor: '#C7A06B',
        backgroundImage:
          'radial-gradient(circle at 25% 25%, #3A2515 14%, transparent 15%), radial-gradient(circle at 70% 55%, #4A2E1B 15%, transparent 16%), radial-gradient(circle at 45% 78%, #2E1C12 11%, transparent 12%)',
        backgroundSize: '16px 16px',
      };
    }

    if (normalized.includes('negro') || normalized.includes('black')) return { backgroundColor: '#111827' };
    if (normalized.includes('blanco') || normalized.includes('white')) return { backgroundColor: '#FFFFFF' };
    if (normalized.includes('beige') || normalized.includes('nude') || normalized.includes('natural') || normalized.includes('crema')) return { backgroundColor: '#D9B995' };
    if (normalized.includes('gris') || normalized.includes('gray') || normalized.includes('plomo')) return { backgroundColor: '#6B7280' };
    if (normalized.includes('rojo') || normalized.includes('red') || normalized.includes('bordo')) return { backgroundColor: '#C92A2A' };
    if (normalized.includes('azul') || normalized.includes('blue') || normalized.includes('navy') || normalized.includes('celeste')) return { backgroundColor: '#2563EB' };
    if (normalized.includes('verde') || normalized.includes('green') || normalized.includes('oliva')) return { backgroundColor: '#16A34A' };
    if (normalized.includes('amarillo') || normalized.includes('yellow') || normalized.includes('mostaza')) return { backgroundColor: '#EAB308' };
    if (normalized.includes('naranja') || normalized.includes('orange') || normalized.includes('coral')) return { backgroundColor: '#F97316' };
    if (normalized.includes('rosa') || normalized.includes('rosado') || normalized.includes('pink') || normalized.includes('fucsia')) return { backgroundColor: '#EC4899' };
    if (normalized.includes('morado') || normalized.includes('lila') || normalized.includes('violeta') || normalized.includes('purple')) return { backgroundColor: '#7C3AED' };
    if (normalized.includes('marron') || normalized.includes('cafe') || normalized.includes('brown')) return { backgroundColor: '#8B5A3C' };
    if (normalized.includes('dorado') || normalized.includes('gold')) return { backgroundColor: '#D4AF37' };
    if (normalized.includes('plateado') || normalized.includes('silver')) return { backgroundColor: '#C0C0C0' };
    if (normalized.includes('transparente')) return { backgroundColor: '#FFFFFF', opacity: 0.35 };
    if (normalized.includes('multicolor')) {
      return {
        backgroundImage: 'linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7)',
      };
    }

    return { backgroundColor: '#9CA3AF' };
  };

  const productosFiltrados = categoriaSeleccionada === "Todas"
    ? productos
    : productos.filter(p => p.categoriaNombre === categoriaSeleccionada);

  async function exportPdf() {
    if (exporting) return;
    setExporting(true);
    let exportClone = null;
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

      exportClone = element.cloneNode(true);
      exportClone.id = "catalogo-root-export";
      exportClone.style.position = "fixed";
      exportClone.style.left = "0";
      exportClone.style.top = "0";
      exportClone.style.width = "1200px";
      exportClone.style.maxWidth = "1200px";
      exportClone.style.zIndex = "-1";
      exportClone.style.opacity = "1";
      exportClone.style.pointerEvents = "none";
      exportClone.style.background = "#ffffff";

      exportClone.querySelectorAll(".no-export").forEach((node) => {
        node.style.display = "none";
      });
      exportClone.querySelectorAll(".catalogo-all-images").forEach((node) => {
        node.style.display = "grid";
        node.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
        node.style.gap = "8px";
      });
      exportClone.querySelectorAll("img").forEach((img) => {
        img.setAttribute("crossOrigin", "anonymous");
        img.setAttribute("loading", "eager");
        img.setAttribute("decoding", "sync");
      });

      document.body.appendChild(exportClone);

      const imgs = exportClone.querySelectorAll("img");

      // Esperar a que todas las imágenes estén cargadas antes de generar el PDF
      await Promise.all(
        Array.from(imgs).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );

      const opt = {
        margin: 0,
        filename: `catalogo_street_wear_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 3, useCORS: true, windowWidth: 1200 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };

      await window.html2pdf().set(opt).from(exportClone).save();
    } catch (err) {
      console.error("Error exportando PDF:", err);
      alert("Error al generar PDF; revisa la consola. Las imágenes deben ser públicas y con CORS habilitado.");
    } finally {
      if (exportClone && exportClone.parentNode) {
        exportClone.parentNode.removeChild(exportClone);
      }

      setExporting(false);
    }
  }

  if (userRole === "not_logged") return <div style={{ padding: 24 }}>Redirigiendo a login...</div>;
  if (userRole !== "admin" && userRole !== "checking") return <div style={{ padding: 24 }}>Acceso denegado.</div>;
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
              (() => {
                const productImages = p.imagenPublicUrls.length > 0
                  ? p.imagenPublicUrls
                  : ["https://placehold.co/900x900/f3f4f6/6b7280?text=Sin+Imagen"];
                const imageCount = productImages.length;
                const useSplit8020 = imageCount >= 6;
                const isSingleImage = productImages.length === 1;
                const compactColumns = Math.min(imageCount, 5);
                return (
              <div
                key={p.id ?? `${p.nombre ?? 'producto'}-${idx}`}
                className={`producto-card${isSingleImage ? " single-image-card" : ""}${!useSplit8020 ? " compact-image-card" : ""}`}
                style={{
                  position: "relative",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.9)",
                  padding: 16,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "stretch",
                  gap: 18,
                  boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                  pageBreakInside: "avoid",
                  marginBottom: 24,
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  overflow: "hidden",
                  justifyContent: !useSplit8020 ? "center" : "flex-start",
                  gap: !useSplit8020 ? 12 : 18
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

                <div
                  className="producto-galeria"
                  style={useSplit8020
                    ? { flex: "0 0 80%", maxWidth: "80%" }
                    : { flex: "0 0 auto", maxWidth: "none", width: "auto" }}
                >
                  <div
                    className="catalogo-all-images"
                    style={!useSplit8020 ? { gridTemplateColumns: `repeat(${compactColumns}, 140px)` } : undefined}
                  >
                    {productImages.map((imgUrl, idxImg) => (
                      <img
                        key={idxImg}
                        src={getOptimizedImageUrl(imgUrl, 900, { quality: 97, format: "origin" })}
                        srcSet={buildImageSrcSet(imgUrl, [300, 600, 900], { quality: 97, format: "origin" })}
                        sizes="(max-width: 900px) 45vw, 18vw"
                        loading="lazy"
                        decoding="async"
                        alt={`${p.nombre} ${idxImg + 1}`}
                        crossOrigin="anonymous"
                        className="catalogo-imagen"
                      />
                    ))}
                  </div>
                </div>

                <div
                  className="catalogo-info"
                  style={useSplit8020
                    ? {
                        flex: "0 0 20%",
                        maxWidth: "20%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        minWidth: 0,
                        padding: "4px 2px"
                      }
                    : {
                        flex: "0 0 auto",
                        maxWidth: "none",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        minWidth: 280,
                        padding: "4px 2px",
                        alignItems: isSingleImage ? "center" : "flex-start",
                        textAlign: isSingleImage ? "center" : "left"
                      }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 24, color: "#4a0f0f", lineHeight: 1.2 }}>{p.nombre}</h3>
                    <strong style={{ display: "inline-block", marginTop: 8, fontSize: 22, color: "#004080" }}>{formatPrice(p.precio)}</strong>
                    <p className="desc-corta" style={{ textAlign: "left", marginTop: 12 }}>{p.descripcion || "Sin descripción"}</p>
                    <p className="desc-completa" style={{ textAlign: "left", marginTop: 12 }}>{p.descripcion || "Sin descripción"}</p>
                  </div>
                
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
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #ddd", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: "bold" }}>Disponible en color:</p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {coloresEnStock.map((v, vIdx) => {
                              const colorStyle = getColorStyle(v.color);
                              return (
                                <div key={`${p.id}-${vIdx}`} style={{ position: "relative", cursor: "pointer" }} title={`${v.color} (${Number(v.stock || 0)} disponibles)`}>
                                  <div
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: "50%",
                                      border: "2px solid #ccc",
                                      ...colorStyle,
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
              </div>
              );
              })()
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
