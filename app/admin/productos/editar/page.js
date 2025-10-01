"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Button } from "../../../../components/ui/button";

export default function EditarCatalogo() {
  const [productos, setProductos] = useState([]);
  const [imagenes, setImagenes] = useState({});
  const [categories, setCategories] = useState([]);
  const [editando, setEditando] = useState({});
  const fileInputs = useRef({});

  useEffect(() => {
    async function fetchProductos() {
      const { data, error } = await supabase
        .from("productos")
        .select("user_id, nombre, precio, stock, categoria, category_id, imagen_url");
      if (!error && data) {
        setProductos(data);
        // Obtener imágenes
        const ids = data.map(p => p.user_id);
        if (ids.length > 0) {
          const { data: imgs } = await supabase
            .from("producto_imagenes")
            .select("producto_id, imagen_url")
            .in("producto_id", ids);
          if (imgs) {
            const agrupadas = {};
            imgs.forEach(img => {
              if (!agrupadas[img.producto_id]) agrupadas[img.producto_id] = [];
              agrupadas[img.producto_id].push(img.imagen_url);
            });
            setImagenes(agrupadas);
          }
        }
      }
    }
    async function fetchCategories() {
      const { data } = await supabase.from('categorias').select('id, categori');
      setCategories(data || []);
    }
    fetchProductos();
    fetchCategories();
  }, []);

  const handleEdit = (user_id, field, value) => {
    setEditando(prev => ({ ...prev, [user_id]: { ...prev[user_id], [field]: value } }));
  };

  const handleSave = async (user_id) => {
    const cambios = editando[user_id];
    if (!cambios) return;
    // Actualizar producto
    const { error } = await supabase.from("productos").update({
      nombre: cambios.nombre,
      precio: cambios.precio,
      stock: cambios.stock,
      categoria: cambios.categoria,
      category_id: cambios.category_id ? parseInt(cambios.category_id) : null,
    }).eq("user_id", user_id);
    if (!error && cambios.imagenFile) {
      // Subir imagen y actualizar producto_imagenes
      const BUCKET_NAME = 'product_images';
      const file = cambios.imagenFile;
      const fileExtension = file.name.split('.').pop();
      const fileName = `${user_id}.${fileExtension}`;
      const filePath = `public/${fileName}`;
      await supabase.storage.from(BUCKET_NAME).upload(filePath, file, { upsert: true });
      const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      await supabase.from("producto_imagenes").upsert({ producto_id: user_id, imagen_url: publicUrlData.publicUrl });
    }
    setEditando(prev => ({ ...prev, [user_id]: undefined }));
    // Refrescar productos
    const { data, error: err } = await supabase
      .from("productos")
      .select("user_id, nombre, precio, stock, categoria, category_id, imagen_url");
    if (!err && data) setProductos(data);
  };

  const handleImageChange = (user_id, e) => {
    const file = e.target.files[0];
    if (file) {
      setEditando(prev => ({ ...prev, [user_id]: { ...prev[user_id], imagenFile: file } }));
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Editar Catálogo</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {productos.length === 0 ? (
          <div className="col-span-full text-gray-700">No hay productos para editar.</div>
        ) : (
          productos.map(prod => {
            const ed = editando[prod.user_id] || {};
            return (
              <Card key={prod.user_id}>
                <CardHeader>
                  <CardTitle>{prod.nombre}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-2">
                    <img src={ed.imagenFile ? URL.createObjectURL(ed.imagenFile) : (imagenes[prod.user_id]?.[0] || "/globe.svg")} alt="img" className="h-28 w-28 object-cover rounded-lg border shadow" />
                    <input type="file" accept="image/*" className="mt-2" onChange={e => handleImageChange(prod.user_id, e)} ref={el => fileInputs.current[prod.user_id] = el} />
                    <Input className="mt-2 text-gray-900 font-bold" value={ed.nombre ?? prod.nombre} onChange={e => handleEdit(prod.user_id, 'nombre', e.target.value)} placeholder="Nombre" />
                    <select className="mt-2 text-gray-900 font-bold" value={ed.category_id ?? prod.category_id ?? ''} onChange={e => handleEdit(prod.user_id, 'category_id', e.target.value)}>
                      <option value="">-- Categoría --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.categori}</option>
                      ))}
                    </select>
                    <Input className="mt-2 text-gray-900 font-bold" type="number" value={ed.precio ?? prod.precio} onChange={e => handleEdit(prod.user_id, 'precio', e.target.value)} placeholder="Precio" />
                    <Input className="mt-2 text-gray-900 font-bold" type="number" value={ed.stock ?? prod.stock} onChange={e => handleEdit(prod.user_id, 'stock', e.target.value)} placeholder="Stock" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleSave(prod.user_id)} className="w-full">Guardar</Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
