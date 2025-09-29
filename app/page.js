"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/SupabaseClient';



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
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">
          Catálogo de Productos
        </h1>
        
        {/* Enlace a la administración (Usando <a> en lugar de <Link>) */}
        <div className="text-center mb-6">
            <a href="/admin/productos" className="text-indigo-600 hover:text-indigo-800 transition font-medium">
                Ir a Administración de Productos
            </a>
        </div>


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
            <p className="text-center text-lg text-indigo-600 mt-10 animate-pulse">Cargando productos...</p>
        )}
        {error && (
             <div className="text-center p-4 bg-red-100 text-red-700 rounded-lg mt-10">
                <p className="font-bold">Error de Conexión o Datos:</p>
                <p className="text-sm">{error}</p>
                <p className="text-xs mt-2">Asegúrate de que las claves de Supabase y las políticas RLS permitan la lectura.</p>
             </div>
        )}

        {/* Contenedor de la lista de productos */}
        {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {productosFiltrados.map((p) => (
                <div 
                  key={p.user_id} 
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-lg flex flex-col transition-shadow duration-300 hover:shadow-xl"
                >
                  <div className="relative">
                    {imagenesProductos[p.user_id] && imagenesProductos[p.user_id].length > 0 ? (
                      <div className="w-full h-40 mb-2 overflow-hidden rounded-lg relative group cursor-pointer">
                        <img
                          src={imagenesProductos[p.user_id][0]}
                          alt={p.nombre}
                          className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-105"
                          onClick={() => openImageModal(imagenesProductos[p.user_id], 0, p.nombre)}
                          onError={e => { e.target.onerror = null; e.target.src = getProductImageUrl(); }}
                        />
                        {/* Flechas si hay más de una imagen */}
                        {imagenesProductos[p.user_id].length > 1 && (
                          <div className="absolute bottom-2 left-2 flex gap-1">
                            {imagenesProductos[p.user_id].map((img, idx) => (
                              <button
                                key={idx}
                                className={`w-3 h-3 rounded-full border-2 ${idx === 0 ? 'bg-green-600 border-green-700' : 'bg-white border-gray-400'} focus:outline-none`}
                                title={`Ver imagen ${idx + 1}`}
                                onClick={e => { e.stopPropagation(); openImageModal(imagenesProductos[p.user_id], idx, p.nombre); }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-40 mb-2 bg-gray-100 flex flex-col items-center justify-center rounded-lg relative">
                        <span className="text-gray-400 text-center">Sin imagen</span>
                      </div>
                    )}
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
                  <div className="flex-1 flex flex-col">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-1">{getCategoriaNombre(p.category_id, categorias)}</div>
                    <div className="text-lg font-bold mb-1 line-clamp-2">{p.nombre}</div>
                    <div className="text-blue-700 font-bold text-xl mb-1">Bs {p.precio ? p.precio.toFixed(2) : '0.00'}</div>
                    <div className="text-green-700 text-xs font-semibold">Stock: {p.stock ?? '-'}</div>
                  </div>
                </div>
              ))}
            </div>
        )}

        {/* Mensaje si no hay productos (después de la carga) */}
        {!loading && productosFiltrados.length === 0 && (
          <p className="text-center text-gray-600 mt-10 text-lg">
            No se encontraron productos para la categoría seleccionada.
          </p>
        )}

      </div>
    </div>
  );
}
