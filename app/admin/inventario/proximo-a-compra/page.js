"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { CONFIG, whatsappUtils } from "../../../../lib/config";

export default function ProximoACompraPage() {
  const [productos, setProductos] = useState([]);
  const [imagenes, setImagenes] = useState({});

  useEffect(() => {
    async function fetchProductos() {
      const { data, error } = await supabase
        .from("productos")
        .select("user_id, nombre, descripcion, precio, stock, categoria");
      if (!error && data) {
        const bajos = data.filter(p => Number(p.stock) < 3);
        setProductos(bajos);
        // Obtener imágenes
        const ids = bajos.map(p => p.user_id);
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
  }, []);

  const enviarWhatsapp = (prod) => {
    const mensaje = `Hola, necesito reponer el producto: ${prod.nombre} (Stock actual: ${prod.stock})`;
    whatsappUtils.sendToBusinessWhatsApp(mensaje);
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-4">Productos próximos a compra</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {productos.length === 0 ? (
          <div className="col-span-full text-gray-900">No hay productos con stock bajo.</div>
        ) : (
          productos.map(prod => (
            <Card key={prod.user_id}>
              <CardHeader>
                <CardTitle className="text-gray-900">{prod.nombre}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-2 text-gray-900">
                  {imagenes[prod.user_id]?.[0] ? (
                    <img src={imagenes[prod.user_id][0]} alt="img" className="h-32 w-32 object-cover rounded-lg border shadow" />
                  ) : (
                    <span className="text-gray-400">Sin imagen</span>
                  )}
                  <div className="text-gray-900 text-sm mt-2">{prod.descripcion}</div>
                  <div className="text-gray-900 font-bold">Bs {Number(prod.precio).toFixed(2)}</div>
                  <div className="text-red-600 font-bold">Stock: {prod.stock}</div>
                  <div className="text-gray-900">Categoría: {prod.categoria || '-'}</div>
                  <Button onClick={() => enviarWhatsapp(prod)} className="w-full bg-green-700 hover:bg-green-800 text-white font-bold mt-2">Enviar mensaje de compra</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}