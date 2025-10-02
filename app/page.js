"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/SupabaseClient';
import { PrecioConPromocion } from '../lib/promociones';
import { usePromociones } from '../lib/usePromociones';
import { usePacks, calcularDescuentoPack } from '../lib/packs';



const getProductImageUrl = (path) => {
  if (!path) {
    return "https://placehold.co/300x200/cccccc/333333?text=Sin+Imagen";
  }
  return path;
};


// Componente principal de la página (Tienda)
// Utilidad para obtener nombre de categoría por id
function getCategoriaNombre(id, categorias) {
  const cat = categorias.find(c => c.id === id);
  return cat ? cat.categori : 'Sin categoría';
}

function ImageGalleryModal({ isOpen, onClose, imageList, imageIndex, productName, onPrev, onNext }) {
  if (!isOpen || !imageList || imageList.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="relative max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
        <button
          className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-700 rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold shadow-lg z-10"
          onClick={onClose}
          title="Cerrar"
        >
          ×
        </button>
        {/* Flechas de navegación */}
        {imageList.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold shadow-lg z-10"
              onClick={onPrev}
              title="Anterior"
            >
              &#8592;
            </button>
            <button
              className="absolute right-12 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold shadow-lg z-10"
              onClick={onNext}
              title="Siguiente"
            >
              &#8594;
            </button>
          </>
        )}
        <img
          src={imageList[imageIndex]}
          alt={productName}
          className="w-full max-h-[80vh] object-contain rounded-xl bg-white"
        />
        <div className="text-center text-white font-bold mt-2 text-lg drop-shadow-lg">{productName} ({imageIndex + 1} / {imageList.length})</div>
        {/* Miniaturas */}
        {imageList.length > 1 && (
          <div className="flex justify-center gap-2 mt-2">
            {imageList.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={productName + ' miniatura ' + (idx + 1)}
                className={`w-14 h-14 object-cover rounded border-2 cursor-pointer ${idx === imageIndex ? 'border-green-600' : 'border-gray-300'}`}
                onClick={() => onPrev(idx - imageIndex < 0 ? imageList.length - 1 : idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Botón flotante para invitar a hacer pedido */}
      <a
        href="/productos"
        className="fixed bottom-8 right-8 z-50 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full shadow-xl text-lg font-bold flex items-center gap-2 animate-bounce transition-colors duration-200"
        title="Ir a hacer un pedido"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        ¿Quieres hacer un pedido? Ingresa aquí
      </a>
    </div>
  );
}

export default function Home() {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedImageList, setSelectedImageList] = useState([]);
  const [selectedImageName, setSelectedImageName] = useState('');

  const openImageModal = (imageList, index, name) => {
    setSelectedImageList(imageList);
    setSelectedImageIndex(index);
    setSelectedImageName(name);
    setIsImageModalOpen(true);
  };
  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImageList([]);
    setSelectedImageIndex(0);
    setSelectedImageName('');
  };
  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % selectedImageList.length);
  };
  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + selectedImageList.length) % selectedImageList.length);
  };
  const [productos, setProductos] = useState([]);
  const [imagenesProductos, setImagenesProductos] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Usar el hook para promociones
  const { promociones, loading: loadingPromociones } = usePromociones();
  
  // Usar el hook para packs
  const { packs, loading: loadingPacks } = usePacks();

  const fetchCategorias = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('categorias')
      .select('id, categori')
      .order('categori', { ascending: true });
    if (!error && data) setCategorias(data);
  };

  const fetchProductos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('user_id, nombre, descripcion, precio, stock, category_id');
        
      if (error) {
        throw new Error(`Error al cargar productos: ${error.message}`);
      }
      
      if (!data) {
        setProductos([]);
        return;
      }
      
      setProductos(data);
      // Buscar imágenes
      const ids = data.map(p => p.user_id);
      if (ids.length > 0) {
        const { data: imgs, error: imgsError } = await supabase
          .from('producto_imagenes')
          .select('producto_id, imagen_url')
          .in('producto_id', ids);
        if (!imgsError && imgs) {
          const agrupadas = {};
          imgs.forEach(img => {
            if (!agrupadas[img.producto_id]) agrupadas[img.producto_id] = [];
            agrupadas[img.producto_id].push(img.imagen_url);
          });
          setImagenesProductos(agrupadas);
        }
      }
    } catch (e) {
      setError(`Error al cargar productos: ${e.message}. (Verifique RLS y nombre de tabla)`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
    fetchProductos();
    
    if (supabase) {
      const channel = supabase
        .channel('productos-public-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'productos' },
          (payload) => {
            fetchProductos();
          }
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);


  // 2. Definición de la variable calculada: productosFiltrados
  const productosFiltrados = productos.filter(p => 
    filtroCategoria === '' || p.category_id === filtroCategoria
  );

  return (
  <div className="min-h-screen bg-gray-100 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">
          Catálogo de Productos
        </h1>

        {/* Sección de Packs Especiales */}
        {!loadingPacks && packs.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-purple-800 mb-6 text-center">
              📦 Packs Especiales - ¡Ofertas Exclusivas!
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {packs.map((pack) => {
                const { precioIndividual, descuentoAbsoluto, descuentoPorcentaje } = calcularDescuentoPack(pack);
                
                return (
                  <div key={pack.id} className="bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-300 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    {/* Header del pack */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-purple-800">
                        📦 {pack.nombre}
                      </h3>
                      <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                        -{descuentoPorcentaje.toFixed(0)}% OFF
                      </span>
                    </div>

                    {/* Descripción */}
                    {pack.descripcion && (
                      <p className="text-purple-700 text-sm mb-4">
                        {pack.descripcion}
                      </p>
                    )}

                    {/* Productos incluidos */}
                    <div className="mb-4">
                      <h4 className="font-bold text-purple-800 text-sm mb-2">
                        📋 Incluye:
                      </h4>
                      <div className="space-y-1">
                        {pack.pack_productos.map((item, index) => (
                          <div key={index} className="flex justify-between items-center bg-white/60 rounded p-2 text-sm">
                            <span className="text-purple-800 font-medium">
                              {item.cantidad}x {item.productos.nombre}
                            </span>
                            <span className="text-gray-600">
                              Bs {(item.productos.precio * item.cantidad).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Precios */}
                    <div className="bg-white/80 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 text-sm">Precio individual:</span>
                        <span className="text-gray-500 line-through">
                          Bs {precioIndividual.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-purple-800">Precio del pack:</span>
                        <span className="text-2xl font-bold text-green-600">
                          Bs {pack.precio_pack}
                        </span>
                      </div>
                      <div className="text-center mt-2 text-sm font-bold text-green-700">
                        💰 Ahorras: Bs {descuentoAbsoluto.toFixed(2)}
                      </div>
                    </div>

                    {/* Vigencia */}
                    <div className="text-xs text-purple-600 mb-4">
                      {pack.fecha_fin ? (
                        <div>⏰ Oferta válida hasta: {new Date(pack.fecha_fin).toLocaleDateString()}</div>
                      ) : (
                        <div>♾️ Oferta por tiempo limitado</div>
                      )}
                    </div>

                    {/* Botón de acción */}
                    <a
                      href="/productos"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-bold text-center block transition-colors duration-200"
                    >
                      🛒 Ver en Catálogo
                    </a>
                  </div>
                );
              })}
            </div>

            {/* Separador visual */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex-grow border-t border-purple-300"></div>
              <span className="px-4 text-purple-600 font-medium">Productos Individuales</span>
              <div className="flex-grow border-t border-purple-300"></div>
            </div>
          </div>
        )}
        {/* Enlace a la administración (opcional, solo si lo quieres aquí) */}
        {/* Si quieres eliminarlo por completo, borra este bloque */}
        {/* Sección de Filtros */}
        <div className="mb-8 p-4 bg-white rounded-xl shadow-md flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setFiltroCategoria('')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition duration-150 ${filtroCategoria === '' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-indigo-100'}`}
          >
            Todas las Categorías
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFiltroCategoria(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition duration-150 ${filtroCategoria === cat.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-indigo-100'}`}
            >
              {cat.categori}
            </button>
          ))}
        </div>
        {/* Mensajes de Estado */}
        {loading && (
          <div className="text-center mt-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-800">Cargando productos...</p>
          </div>
        )}
        {error && (
          <div className="text-center p-6 bg-red-50 border border-red-200 text-red-800 rounded-lg mt-10 max-w-2xl mx-auto">
            <p className="font-bold text-lg mb-2">Error de Conexión o Datos:</p>
            <p className="text-sm mb-2">{error}</p>
            <p className="text-xs">Asegúrate de que las claves de Supabase y las políticas RLS permitan la lectura.</p>
          </div>
        )}
        {/* Contenedor de Productos */}
        {!loading && productosFiltrados.length === 0 && (
          <div className="text-center mt-10 p-8 bg-gray-50 rounded-lg">
            <p className="text-xl font-medium text-gray-800 mb-2">
              No se encontraron productos
            </p>
            <p className="text-gray-600">
              para la categoría seleccionada.
            </p>
          </div>
        )}
        {/* Grid de productos */}
  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-8">
          {productosFiltrados.map((p) => {
            return (
              <div key={p.user_id} className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center">
                <div className="w-full h-32 sm:h-48 flex items-center justify-center mb-2 cursor-pointer relative group">
                  {imagenesProductos[p.user_id] && imagenesProductos[p.user_id].length > 0 ? (
                    <img
                      src={imagenesProductos[p.user_id][0]}
                      alt={p.nombre}
                      className="w-full h-48 object-contain rounded-xl bg-gray-50 group-hover:opacity-80 transition"
                      onClick={() => openImageModal(imagenesProductos[p.user_id], 0, p.nombre)}
                    />
                  ) : (
                    <img
                      src="https://placehold.co/300x200/cccccc/333333?text=Sin+Imagen"
                      alt="Sin imagen"
                      className="w-full h-48 object-contain rounded-xl bg-gray-50"
                    />
                  )}
                </div>
                <div className="w-full text-center">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">{p.nombre}</h2>
                  <p className="text-gray-600 text-xs sm:text-sm mb-2">{p.descripcion}</p>
                  
                  {/* Usar el componente de precio con promoción */}
                  <PrecioConPromocion 
                    producto={p} 
                    promociones={promociones}
                    className="mb-2"
                  />
                  
                  <div className="text-xs text-gray-500 mb-2">Categoría: {getCategoriaNombre(p.category_id, categorias)}</div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Modal de galería de imágenes */}
        <ImageGalleryModal
          isOpen={isImageModalOpen}
          onClose={closeImageModal}
          imageList={selectedImageList}
          imageIndex={selectedImageIndex}
          productName={selectedImageName}
          onPrev={prevImage}
          onNext={nextImage}
        />
      </div>
    </div>
  );
}
