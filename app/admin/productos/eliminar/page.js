"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";

export default function EliminarCatalogo() {
  const [productos, setProductos] = useState([]);
  const [imagenes, setImagenes] = useState({});
  const [eliminando, setEliminando] = useState(null);

  useEffect(() => {
    async function fetchProductos() {
      const { data, error } = await supabase
        .from("productos")
        .select("user_id, nombre, precio, stock, categoria");
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
    fetchProductos();
  }, [eliminando]);

  const eliminarProducto = async (user_id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este producto?")) return;
    setEliminando(user_id);
    await supabase.from("productos").delete().eq("user_id", user_id);
    await supabase.from("producto_imagenes").delete().eq("producto_id", user_id);
    setEliminando(null);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Eliminar Catálogo</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {productos.length === 0 ? (
          <div className="col-span-full text-gray-700">No hay productos para eliminar.</div>
        ) : (
          productos.map(prod => (
            <Card key={prod.user_id}>
              <CardHeader>
                <CardTitle className="text-gray-900">{prod.nombre}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-2">
                  {imagenes[prod.user_id]?.[0] ? (
                    <img src={imagenes[prod.user_id][0]} alt="img" className="h-28 w-28 object-cover rounded-lg border shadow" />
                  ) : (
                    <span className="text-gray-400">Sin imagen</span>
                  )}
                  <div className="text-gray-900 text-sm mt-2 font-semibold">Precio: Bs {Number(prod.precio).toFixed(2)}</div>
                  <div className="text-gray-900">Stock: <span className={prod.stock < 3 ? 'text-red-600 font-bold' : ''}>{prod.stock}</span></div>
                  <div className="text-gray-900">Categoría: {prod.categoria || '-'}</div>
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
