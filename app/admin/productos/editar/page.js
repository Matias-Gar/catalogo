"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import ProductCard from "@/components/ProductCard";
import { Toast } from "@/components/ui/Toast";
import { showToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/SupabaseClient";
import { Input } from "@/components/ui/input";

export default function EditarCatalogo() {
  const [productos, setProductos] = useState([]);
  const [imagenes, setImagenes] = useState({});
  const [categories, setCategories] = useState([]);
  const [editando, setEditando] = useState({});
  const [modalConfirm, setModalConfirm] = useState({ visible: false, id: null });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("alphabetical");

  // Cargar datos
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data: prods } = await supabase
        .from("productos")
        .select(`
          user_id, nombre, descripcion, precio, stock,
          categoria, category_id, codigo_barra, created_at
        `)
        .order("nombre", { ascending: true });

      setProductos(prods || []);

      const { data: cats } = await supabase.from("categorias").select("id, categori");
      setCategories(cats || []);

      const ids = prods.map((p) => p.user_id);
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
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  const setEditDataField = (prodId, field, value) => {
    setEditando((prev) => ({
      ...prev,
      [prodId]: { ...prev[prodId], [field]: value },
    }));
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
    setEditDataField(prodId, "removeImages", [
      ...(editando[prodId]?.removeImages || []),
      imgObj,
    ]);
    // Actualiza UI local
    const updatedList = (imagenes[prodId] || []).filter((i) => i.id !== imgObj.id);
    setImagenes((prev) => ({ ...prev, [prodId]: updatedList }));
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

      // 1) Actualizar datos principales
      await supabase
        .from("productos")
        .update({
          nombre: cambios.nombre,
          descripcion: cambios.descripcion,
          precio: cambios.precio,
          stock: cambios.stock,
          categoria: cambios.categoria,
          category_id: cambios.category_id ? parseInt(cambios.category_id) : null,
          codigo_barra: cambios.codigo_barra,
        })
        .eq("user_id", prodId);

      // 2) Eliminar imágenes marcadas
      if (cambios.removeImages?.length) {
        for (const img of cambios.removeImages) {
          await supabase
            .from("producto_imagenes")
            .delete()
            .eq("id", img.id);
        }
      }

      // 3) Reemplazar imágenes
      if (cambios.replaceImages?.length) {
        for (const r of cambios.replaceImages) {
          await supabase
            .from("producto_imagenes")
            .delete()
            .eq("id", r.old.id);

          const file = r.file;
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
          }
        }
      }

      // 4) Añadir nuevas imágenes
      if (cambios.newImages?.length) {
        for (const file of cambios.newImages) {
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
          }
        }
      }

      showToast("Producto actualizado con éxito!");

      // Refrescar productos desde DB
      const { data: prods } = await supabase
        .from("productos")
        .select(
          "user_id, nombre, descripcion, precio, stock, categoria, category_id, codigo_barra, created_at"
        )
        .order("nombre", { ascending: true });

      setProductos(prods || []);
      setEditando((prev) => ({ ...prev, [prodId]: undefined }));
    } catch (err) {
      showToast("Error guardando producto", "error");
    }

    setLoading(false);
    closeConfirm();
  };

  const filteredAndSortedProducts = () => {
    let list = productos;
    if (search)
      list = list.filter((p) =>
        p.nombre.toLowerCase().includes(search.toLowerCase())
      );
    if (categoryFilter)
      list = list.filter((p) => p.category_id === parseInt(categoryFilter));
    if (sortOrder === "alphabetical")
      list = list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    else
      list = list.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    return list;
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-4xl text-center font-bold text-indigo-700 mb-8">
        Editar Catálogo de Productos
      </h1>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre..."
          className="w-full md:w-1/3"
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full md:w-1/4 border-indigo-500 rounded-lg p-3"
        >
          <option value="">Filtrar por categoría</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.categori}
            </option>
          ))}
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="w-full md:w-1/4 border-indigo-500 rounded-lg p-3"
        >
          <option value="alphabetical">Orden alfabético</option>
          <option value="date">Orden por fecha</option>
        </select>
      </div>

      {loading && (
        <div className="text-center text-gray-600 mb-4">Cargando...</div>
      )}

      {/* LISTA DE PRODUCTOS */}
      <div className="space-y-8">
        {filteredAndSortedProducts().map((prod) => (
          <ProductCard
            key={prod.user_id}
            prod={prod}
            categories={categories}
            editData={{
              originalImages: imagenes[prod.user_id],
              ...editando[prod.user_id],
            }}
            setEditDataField={setEditDataField}
            handleAddImages={handleAddImages}
            handleRemoveImage={handleRemoveImage}
            handleReplaceImage={handleReplaceImage}
            handleReorderImages={handleReorderImages}
            openConfirm={openConfirm}
          />
        ))}
      </div>

      {/* MODAL CONFIRM */}
      <ConfirmModal
        visible={modalConfirm.visible}
        onCancel={closeConfirm}
        onConfirm={handleConfirmSave}
        message="¿Seguro que deseas guardar los cambios?"
      />

      <Toast />
    </div>
  );
}
