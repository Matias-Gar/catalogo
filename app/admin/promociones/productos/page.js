"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";

export default function PromocionesProductosPage() {

  const [productos, setProductos] = useState([]);
  const [promociones, setPromociones] = useState([]);
  const [promo, setPromo] = useState({});
  const [loading, setLoading] = useState(false);

  // Cargar productos y promociones
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const { data: productosData, error: prodError } = await supabase
        .from("productos")
        .select("user_id, nombre, precio, stock, categoria");
      const { data: promosData, error: promoError } = await supabase
        .from("promociones")
        .select("id, producto_id, tipo, valor, descripcion, activa, fecha_inicio, fecha_fin");
      if (!prodError && productosData) setProductos(productosData);
      if (!promoError && promosData) setPromociones(promosData);
      setLoading(false);
    }
    fetchAll();
  }, []);

  // Manejar cambios en el formulario de promoción
  const handlePromoChange = (id, field, value) => {
    setPromo(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  // Guardar promoción en la tabla promociones
  const guardarPromo = async (id) => {
    const p = promo[id];
    if (!p?.tipo || !p?.valor) {
      alert("Completa todos los campos de la promoción.");
      return;
    }
    setLoading(true);
    // Insertar nueva promoción
    const { error } = await supabase.from("promociones").insert([
      {
        producto_id: id,
        tipo: p.tipo,
        valor: p.valor,
        descripcion: p.descripcion || null,
        activa: true,
      },
    ]);
    if (error) {
      alert("Error al guardar promoción: " + error.message);
    } else {
      setPromo(prev => ({ ...prev, [id]: {} }));
      // Recargar promociones
      const { data: promosData } = await supabase
        .from("promociones")
        .select("id, producto_id, tipo, valor, descripcion, activa, fecha_inicio, fecha_fin");
      setPromociones(promosData || []);
    }
    setLoading(false);
  };

  // Eliminar promoción
  const eliminarPromo = async (promoId) => {
    setLoading(true);
    const { error } = await supabase.from("promociones").delete().eq("id", promoId);
    if (error) {
      alert("Error al eliminar promoción: " + error.message);
    } else {
      // Recargar promociones
      const { data: promosData } = await supabase
        .from("promociones")
        .select("id, producto_id, tipo, valor, descripcion, activa, fecha_inicio, fecha_fin");
      setPromociones(promosData || []);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-4">Agregar Promociones a Productos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-gray-900">Cargando...</div>
        ) : productos.length === 0 ? (
          <div className="col-span-full text-gray-900">No hay productos.</div>
        ) : (
          productos.map(prod => {
            // Buscar promociones activas para este producto
            const promosProd = promociones.filter(p => p.producto_id === prod.user_id && p.activa !== false);
            return (
              <Card key={prod.user_id}>
                <CardHeader>
                  <CardTitle className="text-gray-900">{prod.nombre}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2 text-gray-900">
                    <div>Precio: Bs {Number(prod.precio).toFixed(2)}</div>
                    <div>Categoría: {prod.categoria || '-'}</div>
                    {promosProd.length > 0 && (
                      <div className="mb-2">
                        <div className="font-bold text-green-700">Promociones activas:</div>
                        {promosProd.map(promo => (
                          <div key={promo.id} className="flex items-center gap-2">
                            <span className="text-sm">{promo.tipo === 'descuento' ? `Descuento: ${promo.valor}%` : `Pack/Combo: ${promo.valor}`}</span>
                            <Button variant="destructive" size="sm" onClick={() => eliminarPromo(promo.id)}>Eliminar</Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="font-bold">Agregar nueva promoción:</div>
                    <div>Tipo de promoción:</div>
                    <select className="text-gray-900" value={promo[prod.user_id]?.tipo || ''} onChange={e => handlePromoChange(prod.user_id, 'tipo', e.target.value)}>
                      <option value="">-- Seleccionar --</option>
                      <option value="descuento">Descuento</option>
                      <option value="pack">Pack/Combo</option>
                    </select>
                    {promo[prod.user_id]?.tipo === 'descuento' && (
                      <input type="number" className="border rounded p-1 text-gray-900" placeholder="% descuento" value={promo[prod.user_id]?.valor || ''} onChange={e => handlePromoChange(prod.user_id, 'valor', e.target.value)} />
                    )}
                    {promo[prod.user_id]?.tipo === 'pack' && (
                      <input type="text" className="border rounded p-1 text-gray-900" placeholder="Ej: 2x1, 3x2, combo especial" value={promo[prod.user_id]?.valor || ''} onChange={e => handlePromoChange(prod.user_id, 'valor', e.target.value)} />
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => guardarPromo(prod.user_id)} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold" disabled={loading}>Guardar promoción</Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}