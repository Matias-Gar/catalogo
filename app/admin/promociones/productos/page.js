"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/SupabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { PrecioConPromocion } from "../../../../lib/promociones";

export default function PromocionesProductosPage() {
  const [productos, setProductos] = useState([]);
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editandoPromo, setEditandoPromo] = useState(null);
  const [nuevoPromo, setNuevoPromo] = useState({
    producto_id: "",
    tipo: "",
    valor: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    activa: true
  });
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroStock, setFiltroStock] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Cargar datos iniciales
  useEffect(() => {
    fetchDatos();
  }, []);

  const fetchDatos = async () => {
    setLoading(true);
    try {
      // Cargar productos con categorías
      const { data: productosData, error: prodError } = await supabase
        .from("productos")
        .select(`
          user_id, 
          nombre, 
          precio, 
          stock, 
          categoria,
          descripcion
        `)
        .order('nombre');

      console.log('Productos obtenidos:', productosData);
      console.log('Error productos:', prodError);

      // Cargar promociones
      const { data: promosData, error: promoError } = await supabase
        .from("promociones")
        .select("*")
        .order('id', { ascending: false });

      console.log('Promociones obtenidas:', promosData);
      console.log('Error promociones:', promoError);

      if (prodError) {
        console.error("Error específico productos:", prodError);
        alert("Error al cargar productos: " + prodError.message);
      } else if (productosData) {
        setProductos(productosData);
        console.log(`✅ ${productosData.length} productos cargados`);
      }

      if (promoError) {
        console.error("Error específico promociones:", promoError);
        alert("Error al cargar promociones: " + promoError.message);
      } else if (promosData) {
        setPromociones(promosData);
        console.log(`✅ ${promosData.length} promociones cargadas`);
      }
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar productos en tiempo real
  const productosFiltrados = productos.filter(producto => {
    // Búsqueda por nombre - coincidencia desde el inicio o contenida
    const nombreProducto = producto.nombre.toLowerCase();
    const textoBusqueda = busqueda.toLowerCase().trim();
    
    const matchBusqueda = textoBusqueda === '' || 
      nombreProducto.startsWith(textoBusqueda) || 
      nombreProducto.includes(textoBusqueda);
    
    const matchCategoria = !filtroCategoria || producto.categoria === filtroCategoria;
    const matchStock = !filtroStock || 
      (filtroStock === 'bajo' && producto.stock <= 10) ||
      (filtroStock === 'medio' && producto.stock > 10 && producto.stock <= 50) ||
      (filtroStock === 'alto' && producto.stock > 50);
    
    return matchBusqueda && matchCategoria && matchStock;
  });

  // Obtener promociones activas para un producto
  const getPromocionesProducto = (productoId) => {
    return promociones.filter(promo => 
      promo.producto_id === productoId && 
      promo.activa &&
      (!promo.fecha_fin || new Date(promo.fecha_fin) >= new Date())
    );
  };

  // Crear nueva promoción
  const crearPromocion = async () => {
    if (!nuevoPromo.producto_id || !nuevoPromo.tipo || !nuevoPromo.valor) {
      alert("Por favor completa todos los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("promociones").insert([{
        producto_id: nuevoPromo.producto_id,
        tipo: nuevoPromo.tipo,
        valor: parseFloat(nuevoPromo.valor),
        descripcion: nuevoPromo.descripcion,
        fecha_inicio: nuevoPromo.fecha_inicio || new Date().toISOString().split('T')[0],
        fecha_fin: nuevoPromo.fecha_fin || null,
        activa: nuevoPromo.activa
      }]);

      if (error) throw error;

      setNuevoPromo({
        producto_id: "",
        tipo: "",
        valor: "",
        descripcion: "",
        fecha_inicio: "",
        fecha_fin: "",
        activa: true
      });
      
      await fetchDatos();
      alert("Promoción creada exitosamente");
    } catch (error) {
      console.error("Error al crear promoción:", error);
      alert("Error al crear promoción: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar promoción
  const editarPromocion = async () => {
    if (!editandoPromo) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("promociones")
        .update({
          tipo: editandoPromo.tipo,
          valor: parseFloat(editandoPromo.valor),
          descripcion: editandoPromo.descripcion,
          fecha_inicio: editandoPromo.fecha_inicio,
          fecha_fin: editandoPromo.fecha_fin,
          activa: editandoPromo.activa
        })
        .eq("id", editandoPromo.id);

      if (error) throw error;

      setEditandoPromo(null);
      await fetchDatos();
      alert("Promoción actualizada exitosamente");
    } catch (error) {
      console.error("Error al editar promoción:", error);
      alert("Error al editar promoción: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar promoción
  const eliminarPromocion = async (promoId) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta promoción?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("promociones").delete().eq("id", promoId);
      if (error) throw error;

      await fetchDatos();
      alert("Promoción eliminada exitosamente");
    } catch (error) {
      console.error("Error al eliminar promoción:", error);
      alert("Error al eliminar promoción: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Activar/Desactivar promoción
  const togglePromocion = async (promoId, activa) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("promociones")
        .update({ activa: !activa })
        .eq("id", promoId);

      if (error) throw error;
      await fetchDatos();
    } catch (error) {
      console.error("Error al cambiar estado de promoción:", error);
      alert("Error al cambiar estado: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Obtener categorías únicas
  const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];

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
    <div className="p-6 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">
            Gestión de Promociones de Productos
          </h1>
          <p className="text-gray-800">
            Administra descuentos, ofertas y promociones especiales para tus productos
          </p>
        </div>

        {/* Filtros y búsqueda */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Buscar producto
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Escribe para buscar productos..."
                    className="w-full p-2 pr-8 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    autoComplete="off"
                  />
                  {busqueda && (
                    <button
                      onClick={() => setBusqueda('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {busqueda && (
                  <div className="text-xs text-blue-600 mt-1 font-medium">
                    📋 {productosFiltrados.length} productos encontrados
                    {busqueda.length === 1 && (
                      <span className="text-gray-600"> - productos que empiezan con &quot;{busqueda.toUpperCase()}&quot;</span>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Categoría
                </label>
                <select
                  className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Nivel de stock
                </label>
                <select
                  className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                  value={filtroStock}
                  onChange={(e) => setFiltroStock(e.target.value)}
                >
                  <option value="">Todos los niveles</option>
                  <option value="bajo">Stock bajo (≤10)</option>
                  <option value="medio">Stock medio (11-50)</option>
                  <option value="alto">Stock alto (&gt;50)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Acciones
                </label>
                <Button 
                  onClick={fetchDatos} 
                  className="w-full font-bold"
                  variant="outline"
                >
                  🔄 Actualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Formulario para nueva promoción */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Crear Nueva Promoción</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Producto *
                </label>
                <select
                  className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                  value={nuevoPromo.producto_id}
                  onChange={(e) => setNuevoPromo({...nuevoPromo, producto_id: e.target.value})}
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map(producto => (
                    <option key={producto.user_id} value={producto.user_id}>
                      {producto.nombre} (Stock: {producto.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Tipo *
                </label>
                <select
                  className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                  value={nuevoPromo.tipo}
                  onChange={(e) => setNuevoPromo({...nuevoPromo, tipo: e.target.value})}
                >
                  <option value="">Seleccionar tipo</option>
                  <option value="descuento">Descuento (%)</option>
                  <option value="precio_fijo">Precio fijo</option>
                  <option value="descuento_absoluto">Descuento absoluto (Bs)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Valor *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={
                    nuevoPromo.tipo === 'descuento' ? "Ej: 20 (20%)" :
                    nuevoPromo.tipo === 'precio_fijo' ? "Ej: 50.00" :
                    nuevoPromo.tipo === 'descuento_absoluto' ? "Ej: 10.00" :
                    "Valor"
                  }
                  className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                  value={nuevoPromo.valor}
                  onChange={(e) => setNuevoPromo({...nuevoPromo, valor: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                  value={nuevoPromo.fecha_inicio}
                  onChange={(e) => setNuevoPromo({...nuevoPromo, fecha_inicio: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Fecha fin
                </label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                  value={nuevoPromo.fecha_fin}
                  onChange={(e) => setNuevoPromo({...nuevoPromo, fecha_fin: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  placeholder="Descripción opcional"
                  className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                  value={nuevoPromo.descripcion}
                  onChange={(e) => setNuevoPromo({...nuevoPromo, descripcion: e.target.value})}
                />
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={crearPromocion} 
                  disabled={loading || !nuevoPromo.producto_id || !nuevoPromo.tipo || !nuevoPromo.valor}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  ➕ Crear Promoción
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de productos */}
        <Card>
          <CardHeader>
            <CardTitle>
              {busqueda ? (
                <span>
                  🔍 Resultados de búsqueda: "{busqueda}" 
                  <span className="text-blue-600"> ({productosFiltrados.length} de {productos.length} productos)</span>
                </span>
              ) : (
                <span>
                  Productos y Promociones ({productosFiltrados.length} productos)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-black font-bold">Cargando productos y promociones...</p>
                <p className="text-sm text-gray-500">
                  Productos: {productos.length} | Promociones: {promociones.length}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border border-gray-400 px-4 py-3 text-left font-bold text-black">
                        Producto
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left font-bold text-black">
                        Categoría
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left font-bold text-black">
                        Precio Base
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left font-bold text-black">
                        Stock
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left font-bold text-black">
                        Precio con Promoción
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left font-bold text-black">
                        Promociones Activas
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left font-bold text-black">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.map(producto => {
                      const promocionesProducto = getPromocionesProducto(producto.user_id);
                      const stockClass = 
                        producto.stock <= 10 ? 'text-red-600 font-semibold' :
                        producto.stock <= 50 ? 'text-yellow-600 font-semibold' :
                        'text-green-600 font-semibold';

                      return (
                        <tr key={producto.user_id} className="hover:bg-gray-50">
                          <td className="border border-gray-400 px-4 py-3">
                            <div>
                              <div className="font-bold text-black">
                                {resaltarTexto(producto.nombre, busqueda)}
                              </div>
                              {producto.descripcion && (
                                <div className="text-sm text-gray-700 font-medium">
                                  {resaltarTexto(producto.descripcion, busqueda)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="border border-gray-400 px-4 py-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-200 text-blue-900">
                              {producto.categoria || 'Sin categoría'}
                            </span>
                          </td>
                          <td className="border border-gray-400 px-4 py-3">
                            <span className="font-bold text-black text-lg">
                              Bs {Number(producto.precio).toFixed(2)}
                            </span>
                          </td>
                          <td className="border border-gray-400 px-4 py-3">
                            <span className={stockClass}>
                              {producto.stock} unidades
                            </span>
                            {producto.stock <= 10 && (
                              <div className="text-xs text-red-600 font-bold">⚠️ Stock bajo</div>
                            )}
                          </td>
                          <td className="border border-gray-400 px-4 py-3">
                            <PrecioConPromocion 
                              producto={producto} 
                              promociones={promociones}
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-3">
                            {promocionesProducto.length > 0 ? (
                              <div className="space-y-2">
                                {promocionesProducto.map(promo => (
                                  <div key={promo.id} className="bg-green-50 border border-green-200 rounded-lg p-2">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="text-sm font-medium text-green-800">
                                          {promo.tipo === 'descuento' && `${promo.valor}% descuento`}
                                          {promo.tipo === 'precio_fijo' && `Precio fijo: Bs ${promo.valor}`}
                                          {promo.tipo === 'descuento_absoluto' && `Descuento: Bs ${promo.valor}`}
                                        </div>
                                        {promo.descripcion && (
                                          <div className="text-xs text-green-600">{promo.descripcion}</div>
                                        )}
                                        {promo.fecha_fin && (
                                          <div className="text-xs text-green-600">
                                            Hasta: {new Date(promo.fecha_fin).toLocaleDateString()}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => setEditandoPromo(promo)}
                                          className="text-blue-600 hover:text-blue-800 text-sm"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={() => togglePromocion(promo.id, promo.activa)}
                                          className={`text-sm ${promo.activa ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`}
                                        >
                                          {promo.activa ? '⏸️' : '▶️'}
                                        </button>
                                        <button
                                          onClick={() => eliminarPromocion(promo.id)}
                                          className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-600 text-sm font-medium">Sin promociones</span>
                            )}
                          </td>
                          <td className="border border-gray-400 px-4 py-3">
                            <Button
                              onClick={() => setNuevoPromo({...nuevoPromo, producto_id: producto.user_id})}
                              size="sm"
                              variant="outline"
                              className="text-xs font-bold"
                            >
                              + Promoción
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {productosFiltrados.length === 0 && (
                  <div className="text-center py-8">
                    {busqueda ? (
                      <div>
                        <div className="text-black font-bold text-lg">
                          🔍 No se encontraron productos con "{busqueda}"
                        </div>
                        <div className="text-gray-600 mt-2">
                          Intenta con otras palabras o verifica la ortografía
                        </div>
                        <Button 
                          onClick={() => setBusqueda('')}
                          className="mt-3"
                          variant="outline"
                        >
                          Limpiar búsqueda
                        </Button>
                      </div>
                    ) : (
                      <div className="text-black font-bold text-lg">
                        No se encontraron productos que coincidan con los filtros
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de edición */}
        {editandoPromo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-black mb-4">
                Editar Promoción
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Tipo
                  </label>
                  <select
                    className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                    value={editandoPromo.tipo}
                    onChange={(e) => setEditandoPromo({...editandoPromo, tipo: e.target.value})}
                  >
                    <option value="descuento">Descuento (%)</option>
                    <option value="precio_fijo">Precio fijo</option>
                    <option value="descuento_absoluto">Descuento absoluto (Bs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Valor
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                    value={editandoPromo.valor}
                    onChange={(e) => setEditandoPromo({...editandoPromo, valor: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Descripción
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                    value={editandoPromo.descripcion || ''}
                    onChange={(e) => setEditandoPromo({...editandoPromo, descripcion: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                    value={editandoPromo.fecha_inicio || ''}
                    onChange={(e) => setEditandoPromo({...editandoPromo, fecha_inicio: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    className="w-full p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium"
                    value={editandoPromo.fecha_fin || ''}
                    onChange={(e) => setEditandoPromo({...editandoPromo, fecha_fin: e.target.value})}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activa"
                    checked={editandoPromo.activa}
                    onChange={(e) => setEditandoPromo({...editandoPromo, activa: e.target.checked})}
                  />
                  <label htmlFor="activa" className="text-sm font-bold text-black">
                    Promoción activa
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setEditandoPromo(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={editarPromocion}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}