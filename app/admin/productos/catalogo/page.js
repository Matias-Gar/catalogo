"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { PrecioConPromocion } from "../../../../lib/promociones";
import { usePromociones } from "../../../../lib/usePromociones";
import { usePacks, calcularDescuentoPack } from "../../../../lib/packs";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function CatalogoAdmin() {
  const [productos, setProductos] = useState([]);
  const [imagenes, setImagenes] = useState({});
  
  // Hook para promociones
  const { promociones, loading: loadingPromociones } = usePromociones();
  
  // Hook para packs
  const { packs, loading: loadingPacks } = usePacks();
  useEffect(() => {
    async function fetchProductos() {
      const { data, error } = await supabase
        .from("productos")
        .select("user_id, nombre, descripcion, precio, stock, categoria");
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
  }, []);

  // Generar PDF de productos
  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.text("Catálogo de Productos", 14, 16);
    const rows = productos.map(prod => [
      prod.nombre,
      prod.categoria || '-',
      prod.descripcion || '-',
      `Bs ${Number(prod.precio).toFixed(2)}`,
      prod.stock
    ]);
    doc.autoTable({
      head: [["Nombre", "Categoría", "Descripción", "Precio", "Stock"]],
      body: rows,
      startY: 22,
      styles: { fontSize: 10 }
    });
    doc.save("catalogo_productos.pdf");
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Catálogo de Productos</h1>
        <Button onClick={exportarPDF} className="bg-green-700 hover:bg-green-800 text-white font-bold">Exportar PDF</Button>
      </div>

      {/* Sección de Packs */}
      {!loadingPacks && packs.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-purple-800">📦 Packs Especiales Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packs.map((pack) => {
                const { precioIndividual, descuentoAbsoluto, descuentoPorcentaje } = calcularDescuentoPack(pack);
                
                return (
                  <div key={pack.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-purple-800">{pack.nombre}</h3>
                      <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                        -{descuentoPorcentaje.toFixed(0)}% OFF
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="text-purple-700">
                        <strong>Productos:</strong> {pack.pack_productos.map(item => 
                          `${item.cantidad}x ${item.productos.nombre}`
                        ).join(', ')}
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Precio individual:</span>
                        <span className="line-through text-gray-500">Bs {precioIndividual.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between font-bold">
                        <span>Precio pack:</span>
                        <span className="text-green-600">Bs {pack.precio_pack}</span>
                      </div>
                      
                      <div className="text-center bg-green-100 rounded p-2 font-bold text-green-700">
                        💰 Descuento: Bs {descuentoAbsoluto.toFixed(2)}
                      </div>
                      
                      {pack.fecha_fin && (
                        <div className="text-xs text-red-600">
                          ⏰ Válido hasta: {new Date(pack.fecha_fin).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {productos.length === 0 ? (
            <div className="col-span-full text-gray-900">No hay productos registrados.</div>
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
                  <PrecioConPromocion 
                    producto={prod} 
                    promociones={promociones}
                    className=""
                    compact={true}
                  />
                  <div className="text-gray-900">Stock: <span className={prod.stock < 3 ? 'text-red-600 font-bold' : ''}>{prod.stock}</span></div>
                  <div className="text-gray-900">Categoría: {prod.categoria || '-'}</div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
