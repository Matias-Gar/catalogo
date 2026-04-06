"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import ProductCard from "@/components/ProductCard";
import { Toast } from "@/components/ui/Toast";
import { showToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/SupabaseClient";
import { Input } from "@/components/ui/input";
import { optimizeImageForUpload } from "@/lib/imageUploadOptimization";

export default function EditarCatalogo() {
  const [productos, setProductos] = useState([]);
  const [imagenes, setImagenes] = useState({});
  const [variantes, setVariantes] = useState({});
  const [categories, setCategories] = useState([]);
  const [editando, setEditando] = useState({});
  const [modalConfirm, setModalConfirm] = useState({ visible: false, id: null });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("alphabetical");

  const getProductKey = (product) => product?.id ?? product?.user_id ?? null;

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setSortOrder("alphabetical");
  };

  const parseDecimalInput = (value, fallback = null) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    const normalized = String(value).replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  // Cargar datos
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data: prods } = await supabase
        .from("productos")
        .select(`
          user_id, nombre, descripcion, precio, stock, imagen_url,
          categoria, category_id, codigo_barra, created_at
        `)
        .order("nombre", { ascending: true });

      setProductos(prods || []);

      const { data: cats } = await supabase.from("categorias").select("id, categori");
      setCategories(cats || []);

      const ids = (prods || []).map((p) => getProductKey(p)).filter(Boolean);
      if (ids.length > 0) {
        const { data: imgs } = await supabase
          .from("producto_imagenes")
          .select("id, producto_id, imagen_url")
          .in("producto_id", ids);

        const agg = {};
        imgs?.forEach((i) => {
          if (!agg[i.producto_id]) agg[i.producto_id] = [];
          agg[i.producto_id].push(i);
        });
        setImagenes(agg);

        const { data: vars } = await supabase
          .from("producto_variantes")
          .select("id, producto_id, color, stock, precio, sku, activo")
          .in("producto_id", ids)
          .order("color", { ascending: true });

        const varsAgg = {};
        vars?.forEach((v) => {
          if (!varsAgg[v.producto_id]) varsAgg[v.producto_id] = [];
          varsAgg[v.producto_id].push(v);
        });
        setVariantes(varsAgg);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  // Listener para imprimir código de barras por variante
  useEffect(() => {
    const handlePrintVariantBarcode = async (event) => {
      const { codigoBarras, nombre } = event.detail;
      if (!codigoBarras) return;

      const barcodeValue = String(codigoBarras).trim();
      let svgString = '';
      
      try {
        const JsBarcode = (await import('jsbarcode')).default;
        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(svgEl, barcodeValue, {
          format: 'EAN13',
          displayValue: false,
          width: 1.2,
          height: 35,
          margin: 0,
        });
        svgString = new XMLSerializer().serializeToString(svgEl);
      } catch (err) {
        svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="40">
          <text x="0" y="20">${barcodeValue}</text>
        </svg>`;
      }

      const barcodeDataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;

      const html = `
      <html>
      <head>
        <style>
          @page {
            size: 78mm auto;
            margin: 0;
          }
          html, body {
            width: 78mm;
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          .label {
            width: 78mm;
            height: 22mm;
            box-sizing: border-box;
            padding: 1mm;
            display: flex;
            border: 1px solid black;
          }
          .left {
            width: 48mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .left img {
            width: 100%;
          }
          .code {
            font-size: 9pt;
          }
          .right {
            width: calc(78mm - 48mm - 2mm);
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            font-size: 8pt;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="left">
            <img src="${barcodeDataUri}" />
            <div class="code">${barcodeValue}</div>
          </div>
          <div class="right">${nombre}</div>
        </div>
      </body>
      </html>
      `;

      const printInIframe = (htmlContent) => {
        let iframe = document.getElementById('variant-barcode-print-iframe');
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'variant-barcode-print-iframe';
          iframe.style.position = 'fixed';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          iframe.style.visibility = 'hidden';
          document.body.appendChild(iframe);
        }

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        doc.open();
        doc.write(htmlContent);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.warn('Impresión desde iframe falló', err);
          }
        }, 500);
      };

      printInIframe(html);
    };

    window.addEventListener('printVariantBarcode', handlePrintVariantBarcode);
    return () => window.removeEventListener('printVariantBarcode', handlePrintVariantBarcode);
  }, []);

  const setEditDataField = (prodId, field, value) => {
    setEditando((prev) => ({
      ...prev,
      [prodId]: { ...prev[prodId], [field]: value },
    }));
  };

  const ensureVariantsDraft = (prodId) => {
    const current = editando[prodId]?.variantes;
    if (Array.isArray(current)) return current;
    return (variantes[prodId] || []).map((v) => ({ ...v }));
  };

  const handleAddVariantRow = (prodId) => {
    // Generar código de barras único: productoId + variantes existentes + secuencial
    const base = ensureVariantsDraft(prodId);
    const totalVariantes = base.length;
    const newCodigoBarras = String(prodId).padStart(6, '0') + String(totalVariantes + 1).padStart(4, '0');
    
    setEditDataField(prodId, "variantes", [
      ...base,
      { id: null, producto_id: prodId, color: "", stock: 0, precio: null, sku: newCodigoBarras, activo: true },
    ]);
  };

  const handleVariantFieldChange = (prodId, index, field, value) => {
    const base = ensureVariantsDraft(prodId);
    const updated = base.map((v, i) => {
      if (i !== index) return v;
      return { ...v, [field]: value };
    });
    setEditDataField(prodId, "variantes", updated);
  };

  const handleRemoveVariantRow = (prodId, index) => {
    const base = ensureVariantsDraft(prodId);
    const target = base[index];
    const next = base.filter((_, i) => i !== index);
    setEditDataField(prodId, "variantes", next);
    if (target?.id) {
      setEditDataField(prodId, "removedVariantIds", [
        ...(editando[prodId]?.removedVariantIds || []),
        target.id,
      ]);
    }
  };

  // Añadir nuevas imágenes
  const handleAddImages = (prodId, e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setEditDataField(prodId, "newImages", [
      ...(editando[prodId]?.newImages || []),
      ...files,
    ]);
  };

  // Marcar imagen para eliminar
  const handleRemoveImage = (prodId, imgObj) => {
    const previousPrimaryId = editando[prodId]?.primaryImageId;
    setEditDataField(prodId, "removeImages", [
      ...(editando[prodId]?.removeImages || []),
      imgObj,
    ]);
    // Actualiza UI local
    const updatedList = (imagenes[prodId] || []).filter((i) => i.id !== imgObj.id);
    setImagenes((prev) => ({ ...prev, [prodId]: updatedList }));

    if (String(previousPrimaryId ?? "") === String(imgObj.id)) {
      const fallback = updatedList[0] || null;
      setEditDataField(prodId, "primaryImageId", fallback?.id ?? null);
      setEditDataField(prodId, "primaryImageUrl", fallback?.imagen_url ?? null);
    }
  };

  // Reemplazar imagen seleccionada
  const handleReplaceImage = (prodId, imgObj, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditDataField(prodId, "replaceImages", [
      ...(editando[prodId]?.replaceImages || []),
      { old: imgObj, file },
    ]);
    // Preview local de reemplazo
    const updatedList = (imagenes[prodId] || []).map((i) =>
      i.id === imgObj.id
        ? { ...i, imagen_url: URL.createObjectURL(file), isPreview: true }
        : i
    );
    setImagenes((prev) => ({ ...prev, [prodId]: updatedList }));
  };

  // Reordenar imágenes
  const handleReorderImages = (prodId, payload) => {
    const { type, index } = payload;
    const dragIndex = editando[prodId]?.dragIndex;
    if (type === "START") {
      setEditDataField(prodId, "dragIndex", index);
    } else if (type === "DROP") {
      const list = [...(imagenes[prodId] || [])];
      const [removed] = list.splice(dragIndex, 1);
      list.splice(index, 0, removed);

      setImagenes((prev) => ({ ...prev, [prodId]: list }));
      setEditDataField(prodId, "reordered", list);
      setEditDataField(prodId, "dragIndex", null);
    }
  };

  const openConfirm = (prodId) => {
    setModalConfirm({ visible: true, id: prodId });
  };

  const closeConfirm = () => {
    setModalConfirm({ visible: false, id: null });
  };

  // Guardar cambios con eliminación y reemplazo funcional
  const handleConfirmSave = async () => {
    const prodId = modalConfirm.id;
    if (!prodId) return;

    setLoading(true);

    try {
      const cambios = editando[prodId] || {};
      const productoActual = productos.find((p) => getProductKey(p) === prodId);
      const precioNormalizado = parseDecimalInput(cambios.precio, parseDecimalInput(productoActual?.precio, 0));

      // 1) Actualizar datos principales
      const updatePayload = {
        nombre: cambios.nombre ?? productoActual?.nombre,
        descripcion: cambios.descripcion ?? productoActual?.descripcion,
        precio: precioNormalizado,
        stock: cambios.stock !== undefined ? Math.max(0, parseInt(cambios.stock, 10) || 0) : productoActual?.stock,
        categoria: cambios.categoria ?? productoActual?.categoria,
        category_id: cambios.category_id ? parseInt(cambios.category_id, 10) : (productoActual?.category_id ?? null),
        codigo_barra: cambios.codigo_barra ?? productoActual?.codigo_barra,
      };

      let updateQuery = supabase.from("productos").update(updatePayload);
      if (productoActual?.id !== undefined && productoActual?.id !== null) {
        updateQuery = updateQuery.eq("id", productoActual.id);
      } else {
        updateQuery = updateQuery.eq("user_id", prodId);
      }
      const { error: updateError } = await updateQuery;
      if (updateError) throw updateError;

      // 1.1) Sincronizar variantes por color
      const removedVariantIds = cambios.removedVariantIds || [];
      if (removedVariantIds.length > 0) {
        await supabase.from("producto_variantes").delete().in("id", removedVariantIds);
      }

      const originalesPorId = new Map((variantes[prodId] || []).filter((v) => v?.id).map((v) => [v.id, v]));

      const draftVariantes = (cambios.variantes || variantes[prodId] || [])
        .map((v) => ({
          ...v,
          color: String(v.color || "").trim(),
          stock: Math.max(0, parseInt(v.stock ?? 0) || 0),
          precio: v.precio === "" || v.precio === null || v.precio === undefined ? null : parseDecimalInput(v.precio, null),
          sku: (() => {
            const currentSku = String(v.sku || "").trim();
            if (currentSku) return currentSku;
            if (v.id && originalesPorId.has(v.id)) {
              const prevSku = String(originalesPorId.get(v.id)?.sku || "").trim();
              if (prevSku) return prevSku;
            }
            const seed = String(prodId).padStart(6, '0') + String(Math.floor(Math.random() * 9000) + 1000);
            return seed;
          })(),
          activo: v.activo !== false,
        }))
        .filter((v) => v.color.length > 0);

      const normalizedColors = draftVariantes.map((v) => v.color.toLowerCase());
      const uniqueColors = new Set(normalizedColors);
      if (uniqueColors.size !== normalizedColors.length) {
        throw new Error("Hay colores repetidos. Corrigelos antes de guardar.");
      }

      if (draftVariantes.length > 0) {
        const existentes = draftVariantes.filter((v) => v.id);
        const nuevos = draftVariantes.filter((v) => !v.id);

        for (const v of existentes) {
          const { error: varUpdateError } = await supabase
            .from("producto_variantes")
            .update({
              color: v.color,
              stock: v.stock,
              precio: v.precio,
              sku: v.sku,
              activo: v.activo,
            })
            .eq("id", v.id);
          if (varUpdateError) throw varUpdateError;
        }

        if (nuevos.length > 0) {
          const { error: varInsertError } = await supabase.from("producto_variantes").insert(
            nuevos.map((v, i) => ({
              producto_id: prodId,
              color: v.color,
              stock: v.stock,
              precio: v.precio,
              sku: v.sku,
              activo: v.activo,
            }))
          );
          if (varInsertError) throw varInsertError;
        }
      }

      // 2) Eliminar imágenes marcadas
      if (cambios.removeImages?.length) {
        for (const img of cambios.removeImages) {
          const { error: deleteImageError } = await supabase
            .from("producto_imagenes")
            .delete()
            .eq("id", img.id);
          if (deleteImageError) throw deleteImageError;
        }
      }

      // 3) Reemplazar imágenes
      if (cambios.replaceImages?.length) {
        for (const r of cambios.replaceImages) {
          await supabase
            .from("producto_imagenes")
            .delete()
            .eq("id", r.old.id);

          const prepared = await optimizeImageForUpload(r.file, {
            maxDimension: 2600,
            targetMaxBytes: 2.8 * 1024 * 1024,
            hardMaxBytes: 4.2 * 1024 * 1024,
            preferredQuality: 0.98,
            minQuality: 0.9,
          });
          const file = prepared.file;
          const ext = file.name.split(".").pop();
          const fname = `${prodId}-${Date.now()}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from("product_images")
            .upload(`public/${fname}`, file, { upsert: true });

          if (!upErr) {
            const { data: urlData } = supabase.storage
              .from("product_images")
              .getPublicUrl(`public/${fname}`);

            await supabase
              .from("producto_imagenes")
              .insert({
                producto_id: prodId,
                imagen_url: urlData.publicUrl,
              });
          } else {
            throw upErr;
          }
        }
      }

      // 4) Añadir nuevas imágenes
      if (cambios.newImages?.length) {
        for (const file of cambios.newImages) {
          const prepared = await optimizeImageForUpload(file, {
            maxDimension: 2600,
            targetMaxBytes: 2.8 * 1024 * 1024,
            hardMaxBytes: 4.2 * 1024 * 1024,
            preferredQuality: 0.98,
            minQuality: 0.9,
          });
          const optimizedFile = prepared.file;
          const ext = optimizedFile.name.split(".").pop();
          const fname = `${prodId}-${Date.now()}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from("product_images")
            .upload(`public/${fname}`, optimizedFile, { upsert: true });

          if (!upErr) {
            const { data: urlData } = supabase.storage
              .from("product_images")
              .getPublicUrl(`public/${fname}`);

            await supabase
              .from("producto_imagenes")
              .insert({
                producto_id: prodId,
                imagen_url: urlData.publicUrl,
              });
          } else {
            throw upErr;
          }
        }
      }

      // 5) Definir y persistir imagen principal del producto
      const { data: finalImages, error: finalImagesError } = await supabase
        .from("producto_imagenes")
        .select("id, imagen_url")
        .eq("producto_id", prodId);
      if (finalImagesError) throw finalImagesError;

      const selectedById = (finalImages || []).find(
        (img) => String(img.id) === String(cambios.primaryImageId ?? "")
      );
      const selectedByUrl = (finalImages || []).find(
        (img) => String(img.imagen_url || "") === String(cambios.primaryImageUrl || "")
      );
      const finalPrimaryImage = selectedById || selectedByUrl || (finalImages || [])[0] || null;

      if (finalPrimaryImage) {
        let principalQuery = supabase
          .from("productos")
          .update({ imagen_url: finalPrimaryImage.imagen_url });
        if (productoActual?.id !== undefined && productoActual?.id !== null) {
          principalQuery = principalQuery.eq("id", productoActual.id);
        } else {
          principalQuery = principalQuery.eq("user_id", prodId);
        }
        const { error: principalError } = await principalQuery;
        if (principalError) throw principalError;
      }

      showToast("Producto actualizado con éxito!");

      // Refrescar productos desde DB
      const { data: prods } = await supabase
        .from("productos")
        .select(
          "user_id, nombre, descripcion, precio, stock, imagen_url, categoria, category_id, codigo_barra, created_at"
        )
        .order("nombre", { ascending: true });

      setProductos(prods || []);

      const ids = (prods || []).map((p) => getProductKey(p)).filter(Boolean);
      if (ids.length > 0) {
        const { data: vars } = await supabase
          .from("producto_variantes")
          .select("id, producto_id, color, stock, precio, sku, activo")
          .in("producto_id", ids)
          .order("color", { ascending: true });
        const varsAgg = {};
        vars?.forEach((v) => {
          if (!varsAgg[v.producto_id]) varsAgg[v.producto_id] = [];
          varsAgg[v.producto_id].push(v);
        });
        setVariantes(varsAgg);
      }

      setEditando((prev) => ({ ...prev, [prodId]: undefined }));
    } catch (err) {
      const msg = err?.message || "Error guardando producto";
      showToast(`Error guardando producto: ${msg}`, "error");
      console.error("Error guardando producto:", err);
    }

    setLoading(false);
    closeConfirm();
  };

  const filteredAndSortedProducts = () => {
    let list = [...productos];

    const normalizedSearch = String(search || "").trim().toLowerCase();
    if (normalizedSearch) {
      list = list.filter((p) => {
        const productKey = getProductKey(p);
        const productVariants = editando[productKey]?.variantes ?? variantes[productKey] ?? [];
        const colorsText = productVariants.map((v) => String(v?.color || "")).join(" ").toLowerCase();
        const nombre = String(p?.nombre || "").toLowerCase();
        const categoria = String(p?.categoria || "").toLowerCase();
        const descripcion = String(p?.descripcion || "").toLowerCase();
        const codigoBarra = String(p?.codigo_barra || "").toLowerCase();
        return (
          nombre.includes(normalizedSearch) ||
          categoria.includes(normalizedSearch) ||
          descripcion.includes(normalizedSearch) ||
          codigoBarra.includes(normalizedSearch) ||
          colorsText.includes(normalizedSearch)
        );
      });
    }

    if (categoryFilter) {
      const selectedCategory = String(categoryFilter);
      list = list.filter((p) => String(p?.category_id ?? "") === selectedCategory);
    }

    if (sortOrder === "alphabetical") {
      list = list.sort((a, b) => String(a?.nombre || "").localeCompare(String(b?.nombre || "")));
    } else {
      list = list.sort(
        (a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0)
      );
    }
    return list;
  };

  const selectedProduct = productos.find(
    (p) => getProductKey(p) === modalConfirm.id
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto bg-slate-50 min-h-screen">
      <h1 className="text-4xl text-center font-bold text-indigo-700 mb-8">
        Editar Artículos
      </h1>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 md:p-5 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, color, código o categoría"
            className="w-full"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full border-slate-300 rounded-lg p-3 bg-white"
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.categori}
              </option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full border-slate-300 rounded-lg p-3 bg-white"
          >
            <option value="alphabetical">Orden alfabético</option>
            <option value="date">Más recientes primero</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="flex items-center justify-start">
          <div className="text-sm text-slate-600">
            Mostrando <span className="font-semibold text-slate-900">{filteredAndSortedProducts().length}</span> de <span className="font-semibold text-slate-900">{productos.length}</span> productos
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center text-gray-600 mb-4">Cargando...</div>
      )}

      {/* LISTA DE PRODUCTOS */}
      <div className="space-y-8">
        {filteredAndSortedProducts().map((prod) => {
          const productKey = getProductKey(prod);
          return (
          <ProductCard
            key={productKey}
            prod={prod}
            categories={categories}
            editData={{
              originalImages: imagenes[productKey],
              originalVariants: variantes[productKey] || [],
              ...editando[productKey],
            }}
            setEditDataField={setEditDataField}
            onAddVariantRow={handleAddVariantRow}
            onVariantFieldChange={handleVariantFieldChange}
            onRemoveVariantRow={handleRemoveVariantRow}
            handleAddImages={handleAddImages}
            handleRemoveImage={handleRemoveImage}
            handleReplaceImage={handleReplaceImage}
            handleReorderImages={handleReorderImages}
            openConfirm={openConfirm}
          />
        )})}
      </div>

      {/* MODAL CONFIRM */}
      <ConfirmModal
        visible={modalConfirm.visible}
        onCancel={closeConfirm}
        onConfirm={handleConfirmSave}
        title="Guardar cambios del producto"
        message="Se detectaron cambios pendientes en este producto."
        detail={selectedProduct ? `Producto: ${selectedProduct.nombre}` : "Verifica la informacion antes de confirmar."}
        confirmLabel="Si, guardar"
        cancelLabel="Volver"
      />

      <Toast />
    </div>
  );
}
