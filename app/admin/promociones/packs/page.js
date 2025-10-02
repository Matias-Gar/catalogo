"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";

export default function PromocionesPacksPage() {
  const [productos, setProductos] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [editandoPack, setEditandoPack] = useState(null);
  const [creandoPack, setCreandoPack] = useState(false);
  
  // Estado para nuevo pack
  const [nuevoPack, setNuevoPack] = useState({
    nombre: "",
    descripcion: "",
    precio_pack: "",
    productosSeleccionados: [], // [{producto_id, cantidad}]
    fecha_inicio: "",
    fecha_fin: "",
    activo: true
  });

  useEffect(() => {
    fetchProductos();
    fetchPacks();
  }, []);

  async function fetchProductos() {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("user_id, nombre, precio, categoria, stock")
        .gt('stock', 0)
        .order('nombre');
      
      if (error) throw error;
      setProductos(data || []);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      alert("Error al cargar productos: " + error.message);
    }
  }

  async function fetchPacks() {
    try {
      setLoading(true);
      const { data: packsData, error: packsError } = await supabase
        .from("packs")
        .select(`
          *,
          pack_productos (
            cantidad,
            productos!pack_productos_producto_id_fkey (
              user_id,
              nombre,
              precio,
              categoria
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (packsError) throw packsError;
      setPacks(packsData || []);
    } catch (error) {
      console.error("Error al cargar packs:", error);
      alert("Error al cargar packs: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Crear nuevo pack
  const crearPack = async () => {
    if (!nuevoPack.nombre || !nuevoPack.precio_pack || nuevoPack.productosSeleccionados.length === 0) {
      alert("Por favor completa nombre, precio y selecciona al menos un producto");
      return;
    }

    setLoading(true);
    try {
      // Crear el pack
      const { data: packData, error: packError } = await supabase
        .from("packs")
        .insert([{
          nombre: nuevoPack.nombre,
          descripcion: nuevoPack.descripcion,
          precio_pack: parseFloat(nuevoPack.precio_pack),
          fecha_inicio: nuevoPack.fecha_inicio || new Date().toISOString().split('T')[0],
          fecha_fin: nuevoPack.fecha_fin || null,
          activo: nuevoPack.activo
        }])
        .select()
        .single();

      if (packError) throw packError;

      // Agregar productos al pack
      const productosParaInsertar = nuevoPack.productosSeleccionados.map(item => ({
        pack_id: packData.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad
      }));

      const { error: productosError } = await supabase
        .from("pack_productos")
        .insert(productosParaInsertar);

      if (productosError) throw productosError;

      // Resetear formulario
      setNuevoPack({
        nombre: "",
        descripcion: "",
        precio_pack: "",
        productosSeleccionados: [],
        fecha_inicio: "",
        fecha_fin: "",
        activo: true
      });
      
      setCreandoPack(false);
      await fetchPacks();
      alert("Pack creado exitosamente");
    } catch (error) {
      console.error("Error al crear pack:", error);
      alert("Error al crear pack: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar pack
  const eliminarPack = async (packId) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("packs")
        .delete()
        .eq("id", packId);

      if (error) throw error;
      await fetchPacks();
      alert("Pack eliminado exitosamente");
    } catch (error) {
      console.error("Error al eliminar pack:", error);
      alert("Error al eliminar pack: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Alternar estado activo del pack
  const togglePack = async (packId, estadoActual) => {
    try {
      const nuevoEstado = !estadoActual;
      
      const { error } = await supabase
        .from('packs')
        .update({ activo: nuevoEstado })
        .eq('id', packId);

      if (error) throw error;

      setPacks(prevPacks => 
        prevPacks.map(pack => 
          pack.id === packId 
            ? { ...pack, activo: nuevoEstado }
            : pack
        )
      );

      alert(`Pack ${nuevoEstado ? 'activado' : 'pausado'} correctamente`);
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('Error al cambiar el estado del pack');
    }
  };

  // Agregar producto al pack
  const agregarProductoAlPack = (productoId) => {
    const productoExiste = nuevoPack.productosSeleccionados.find(p => p.producto_id === productoId);
    
    if (productoExiste) {
      // Incrementar cantidad
      setNuevoPack(prev => ({
        ...prev,
        productosSeleccionados: prev.productosSeleccionados.map(p =>
          p.producto_id === productoId 
            ? { ...p, cantidad: p.cantidad + 1 }
            : p
        )
      }));
    } else {
      // Agregar nuevo producto
      setNuevoPack(prev => ({
        ...prev,
        productosSeleccionados: [...prev.productosSeleccionados, {
          producto_id: productoId,
          cantidad: 1
        }]
      }));
    }
  };

  // Quitar producto del pack
  const quitarProductoDelPack = (productoId) => {
    setNuevoPack(prev => ({
      ...prev,
      productosSeleccionados: prev.productosSeleccionados.filter(p => p.producto_id !== productoId)
    }));
  };

  // Calcular precio total individual de productos en pack
  const calcularPrecioIndividual = (pack) => {
    return pack.pack_productos.reduce((total, item) => {
      return total + (item.productos.precio * item.cantidad);
    }, 0);
  };

  // Calcular descuento del pack
  const calcularDescuentoPack = (pack) => {
    const precioIndividual = calcularPrecioIndividual(pack);
    const descuentoAbsoluto = precioIndividual - pack.precio_pack;
    const descuentoPorcentaje = precioIndividual > 0 ? (descuentoAbsoluto / precioIndividual) * 100 : 0;
    
    return {
      precioIndividual,
      descuentoAbsoluto,
      descuentoPorcentaje
    };
  };

  // Filtrar packs por búsqueda
  const packsFiltrados = packs.filter(pack =>
    pack.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    pack.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ||
    pack.pack_productos.some(item => 
      item.productos.nombre.toLowerCase().includes(busqueda.toLowerCase())
    )
  );

  // Función para resaltar texto de búsqueda
  const resaltarTexto = (texto, busqueda) => {
    if (!busqueda.trim()) return texto;
    
    const regex = new RegExp(`(${busqueda.trim()})`, 'gi');
    const partes = texto.split(regex);
    
    return partes.map((parte, index) => 
      regex.test(parte) ? (
        <span key={index} className="bg-yellow-200 font-bold text-black px-1 rounded">
          {parte}
        </span>
      ) : (
        parte
      )
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-black">
            📦 Gestión de Packs de Productos
          </CardTitle>
          <p className="text-gray-700">
            Crea packs combinando 2 o más productos con un precio especial. Los packs se mostrarán en el catálogo como ofertas especiales.
          </p>
        </CardHeader>
      </Card>

      {/* Estadísticas */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{packs.filter(p => p.activo).length}</div>
            <div className="text-sm text-gray-600">Packs Activos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{packs.filter(p => !p.activo).length}</div>
            <div className="text-sm text-gray-600">Packs Pausados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{packs.length}</div>
            <div className="text-sm text-gray-600">Total Packs</div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar packs por nombre o productos..."
                  className="w-full p-2 pr-8 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {busqueda && (
                  <button
                    onClick={() => setBusqueda('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Botón crear pack */}
            <Button
              onClick={() => setCreandoPack(!creandoPack)}
              className="bg-green-600 hover:bg-green-700 font-bold"
            >
              {creandoPack ? '❌ Cancelar' : '📦 Nuevo Pack'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de creación */}
      {creandoPack && (
        <Card>
          <CardHeader>
            <CardTitle className="text-black">📦 Crear Nuevo Pack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Información del pack */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Nombre del Pack *
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-400 rounded-md text-black font-medium"
                    value={nuevoPack.nombre}
                    onChange={(e) => setNuevoPack(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Ej: Pack Familia, Combo Estudiante..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Descripción
                  </label>
                  <textarea
                    className="w-full p-2 border border-gray-400 rounded-md text-black font-medium"
                    rows="3"
                    value={nuevoPack.descripcion}
                    onChange={(e) => setNuevoPack(prev => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Describe el pack..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Precio del Pack (Bs) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-2 border border-gray-400 rounded-md text-black font-medium"
                    value={nuevoPack.precio_pack}
                    onChange={(e) => setNuevoPack(prev => ({ ...prev, precio_pack: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-400 rounded-md text-black font-medium"
                      value={nuevoPack.fecha_inicio}
                      onChange={(e) => setNuevoPack(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      Fecha Fin (Opcional)
                    </label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-400 rounded-md text-black font-medium"
                      value={nuevoPack.fecha_fin}
                      onChange={(e) => setNuevoPack(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Selección de productos */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Productos en el Pack
                  </label>
                  
                  {/* Productos seleccionados */}
                  {nuevoPack.productosSeleccionados.length > 0 && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                      <div className="text-sm font-bold text-green-800 mb-2">
                        📦 Productos seleccionados:
                      </div>
                      {nuevoPack.productosSeleccionados.map((item) => {
                        const producto = productos.find(p => p.user_id === item.producto_id);
                        return (
                          <div key={item.producto_id} className="flex items-center justify-between bg-white p-2 rounded border mb-2">
                            <div>
                              <div className="font-bold text-black">{producto?.nombre}</div>
                              <div className="text-sm text-gray-600">
                                Bs {producto?.precio} × {item.cantidad} = Bs {(producto?.precio * item.cantidad).toFixed(2)}
                              </div>
                            </div>
                            <button
                              onClick={() => quitarProductoDelPack(item.producto_id)}
                              className="text-red-600 hover:text-red-800 font-bold"
                            >
                              🗑️
                            </button>
                          </div>
                        );
                      })}
                      
                      {/* Total individual */}
                      <div className="text-right pt-2 border-t border-green-200">
                        <div className="text-sm text-gray-600">
                          Total individual: Bs {nuevoPack.productosSeleccionados.reduce((total, item) => {
                            const producto = productos.find(p => p.user_id === item.producto_id);
                            return total + (producto?.precio * item.cantidad || 0);
                          }, 0).toFixed(2)}
                        </div>
                        {nuevoPack.precio_pack && (
                          <div className="text-sm font-bold text-green-800">
                            Descuento: Bs {(nuevoPack.productosSeleccionados.reduce((total, item) => {
                              const producto = productos.find(p => p.user_id === item.producto_id);
                              return total + (producto?.precio * item.cantidad || 0);
                            }, 0) - parseFloat(nuevoPack.precio_pack || 0)).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Lista de productos para agregar */}
                  <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-md">
                    {productos.map((producto) => (
                      <div key={producto.user_id} className="flex items-center justify-between p-3 border-b border-gray-200 hover:bg-gray-50">
                        <div>
                          <div className="font-bold text-black">{producto.nombre}</div>
                          <div className="text-sm text-gray-600">
                            {producto.categoria} - Bs {producto.precio} - Stock: {producto.stock}
                          </div>
                        </div>
                        <Button
                          onClick={() => agregarProductoAlPack(producto.user_id)}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 font-bold"
                          disabled={nuevoPack.productosSeleccionados.some(p => p.producto_id === producto.user_id)}
                        >
                          {nuevoPack.productosSeleccionados.some(p => p.producto_id === producto.user_id) ? '✓ Agregado' : '➕ Agregar'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2">
                  <Button
                    onClick={crearPack}
                    disabled={loading || !nuevoPack.nombre || !nuevoPack.precio_pack || nuevoPack.productosSeleccionados.length === 0}
                    className="bg-green-600 hover:bg-green-700 font-bold flex-1"
                  >
                    {loading ? 'Creando...' : '💾 Crear Pack'}
                  </Button>
                  <Button
                    onClick={() => setCreandoPack(false)}
                    variant="outline"
                    className="font-bold"
                  >
                    ❌ Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de packs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-black">
            {busqueda ? (
              <span>🔍 Resultados: "{busqueda}" ({packsFiltrados.length} de {packs.length})</span>
            ) : (
              <span>📦 Packs Creados ({packs.length} total)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-black font-bold">Cargando packs...</p>
            </div>
          ) : packsFiltrados.length === 0 ? (
            <div className="text-center py-8">
              {busqueda ? (
                <div>
                  <div className="text-black font-bold text-lg">
                    🔍 No se encontraron packs con "{busqueda}"
                  </div>
                  <div className="text-gray-600 mt-2">
                    Intenta con otras palabras o verifica la ortografía
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-black font-bold text-lg">
                    📦 No hay packs creados
                  </div>
                  <div className="text-gray-600 mt-2">
                    Crea tu primer pack combinando productos con un precio especial
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-6">
              {packsFiltrados.map((pack) => {
                const { precioIndividual, descuentoAbsoluto, descuentoPorcentaje } = calcularDescuentoPack(pack);
                
                return (
                  <div key={pack.id} className="border border-gray-300 rounded-lg p-6 bg-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-black">
                            {resaltarTexto(pack.nombre, busqueda)}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            pack.activo 
                              ? 'bg-green-200 text-green-800' 
                              : 'bg-yellow-200 text-yellow-800'
                          }`}>
                            {pack.activo ? '✅ Activo' : '⏸️ Pausado'}
                          </span>
                        </div>
                        
                        {pack.descripcion && (
                          <p className="text-gray-700 mb-3">
                            {resaltarTexto(pack.descripcion, busqueda)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Productos del pack */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-bold text-black mb-3">📋 Productos incluidos:</h4>
                        <div className="space-y-2">
                          {pack.pack_productos.map((item, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                              <div>
                                <div className="font-bold text-black">
                                  {resaltarTexto(item.productos.nombre, busqueda)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {item.productos.categoria}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-gray-600">
                                  Cantidad: {item.cantidad}
                                </div>
                                <div className="font-bold text-black">
                                  Bs {(item.productos.precio * item.cantidad).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-black mb-3">💰 Precios y Descuento:</h4>
                        <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-700">Precio individual:</span>
                            <span className="line-through text-gray-500">Bs {precioIndividual.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">Precio del pack:</span>
                            <span className="font-bold text-green-600 text-lg">Bs {pack.precio_pack}</span>
                          </div>
                          <div className="border-t border-blue-200 pt-2 mt-2">
                            <div className="flex justify-between">
                              <span className="font-bold text-blue-800">Descuento:</span>
                              <span className="font-bold text-blue-800">
                                Bs {descuentoAbsoluto.toFixed(2)} ({descuentoPorcentaje.toFixed(1)}% OFF)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Vigencia */}
                        <div className="mt-4 text-sm">
                          <div className="text-gray-700">
                            📅 Desde: {pack.fecha_inicio ? new Date(pack.fecha_inicio).toLocaleDateString() : 'Sin fecha'}
                          </div>
                          {pack.fecha_fin ? (
                            <div className="text-red-600 font-medium">
                              ⏰ Hasta: {new Date(pack.fecha_fin).toLocaleDateString()}
                            </div>
                          ) : (
                            <div className="text-green-600 font-medium">
                              ♾️ Sin límite de tiempo
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200">
                      <Button
                        onClick={() => togglePack(pack.id, pack.activo)}
                        size="sm"
                        variant="outline"
                        className="font-bold"
                      >
                        {pack.activo ? '⏸️ Pausar' : '▶️ Activar'}
                      </Button>
                      <Button
                        onClick={() => eliminarPack(pack.id)}
                        size="sm"
                        variant="destructive"
                        className="font-bold"
                      >
                        🗑️ Eliminar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}