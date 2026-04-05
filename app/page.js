"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/SupabaseClient';
import { PrecioConPromocion } from '../lib/promociones';
import { usePromociones } from '../lib/usePromociones';
import { usePacks, calcularDescuentoPack } from '../lib/packs';
import ExpandableDescription from '../components/ui/ExpandableDescription';
import { getOptimizedImageUrl, buildImageSrcSet } from '../lib/imageOptimization';





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
          src={getOptimizedImageUrl(imageList[imageIndex], 2000, { quality: 98, format: 'origin' })}
          srcSet={buildImageSrcSet(imageList[imageIndex], [800, 1200, 2000], { quality: 98, format: 'origin' })}
          sizes="(max-width: 768px) 100vw, 80vw"
          loading="lazy"
          decoding="async"
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
                src={getOptimizedImageUrl(img, 200, { quality: 95, format: 'origin' })}
                srcSet={buildImageSrcSet(img, [100, 200, 400], { quality: 95, format: 'origin' })}
                sizes="56px"
                loading="lazy"
                decoding="async"
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
        .from('v_productos_catalogo')
        .select('producto_id, nombre, descripcion, precio_base, imagen_base, category_id, categoria, stock_total, codigo_barra, variantes');
        
      if (error) {
        throw new Error(`Error al cargar productos: ${error.message}`);
      }
      
      if (!data) {
        setProductos([]);
        return;
      }

      // Normalizar datos de la vista
      const normalized = data.map(p => ({
        user_id: p.producto_id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: Number(p.precio_base || 0),
        stock: Number(p.stock_total || 0),
        category_id: p.category_id,
        variantes: Array.isArray(p.variantes) ? p.variantes : []
      }));
      
      setProductos(normalized);
      // Buscar imágenes
      const ids = normalized.map(p => p.user_id);
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
  const productosFiltrados = productos.filter(p => {
    if (filtroCategoria === '') return true;
    const match = Number(p.category_id) === Number(filtroCategoria);
    console.log('🔍 Filtro categoria PRINCIPAL:', {
      producto: p.nombre,
      categoria_producto: p.category_id,
      categoria_seleccionada: filtroCategoria,
      match: match
    });
    return match;
  });

  const normalizeColorName = (colorName) =>
    String(colorName || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Devuelve estilos visuales para mostrar el color de forma fiel en el swatch.
  const getColorStyle = (colorName) => {
    const normalized = normalizeColorName(colorName);

    if (!normalized) return { backgroundColor: '#9CA3AF' };

    if (normalized.includes('animal print')) {
      return {
        backgroundColor: '#C7A06B',
        backgroundImage:
          'radial-gradient(circle at 25% 25%, #3A2515 14%, transparent 15%), radial-gradient(circle at 70% 55%, #4A2E1B 15%, transparent 16%), radial-gradient(circle at 45% 78%, #2E1C12 11%, transparent 12%)',
        backgroundSize: '16px 16px',
      };
    }

    if (normalized.includes('negro') || normalized.includes('black')) return { backgroundColor: '#111827' };
    if (normalized.includes('blanco') || normalized.includes('white')) return { backgroundColor: '#FFFFFF' };
    if (normalized.includes('beige') || normalized.includes('nude') || normalized.includes('natural') || normalized.includes('crema')) return { backgroundColor: '#D9B995' };
    if (normalized.includes('gris') || normalized.includes('gray') || normalized.includes('plomo')) return { backgroundColor: '#6B7280' };
    if (normalized.includes('rojo') || normalized.includes('red') || normalized.includes('bordo')) return { backgroundColor: '#C92A2A' };
    if (normalized.includes('azul') || normalized.includes('blue') || normalized.includes('navy') || normalized.includes('celeste')) return { backgroundColor: '#2563EB' };
    if (normalized.includes('verde') || normalized.includes('green') || normalized.includes('oliva')) return { backgroundColor: '#16A34A' };
    if (normalized.includes('amarillo') || normalized.includes('yellow') || normalized.includes('mostaza')) return { backgroundColor: '#EAB308' };
    if (normalized.includes('naranja') || normalized.includes('orange') || normalized.includes('coral')) return { backgroundColor: '#F97316' };
    if (normalized.includes('rosa') || normalized.includes('rosado') || normalized.includes('pink') || normalized.includes('fucsia')) return { backgroundColor: '#EC4899' };
    if (normalized.includes('morado') || normalized.includes('lila') || normalized.includes('violeta') || normalized.includes('purple')) return { backgroundColor: '#7C3AED' };
    if (normalized.includes('marron') || normalized.includes('cafe') || normalized.includes('brown')) return { backgroundColor: '#8B5A3C' };
    if (normalized.includes('dorado') || normalized.includes('gold')) return { backgroundColor: '#D4AF37' };
    if (normalized.includes('plateado') || normalized.includes('silver')) return { backgroundColor: '#C0C0C0' };
    if (normalized.includes('transparente')) return { backgroundColor: '#FFFFFF', opacity: 0.35 };
    if (normalized.includes('multicolor')) {
      return {
        backgroundImage: 'linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7)',
      };
    }

    return { backgroundColor: '#9CA3AF' };
  };

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
        {/* Sección de Filtros - VERSIÓN RESPONSIVA IDÉNTICA A PRODUCTOS */}
        {categorias.length > 0 && (
            <div className="mb-6">
                {/* Versión móvil - Selector desplegable compacto */}
                <div className="block sm:hidden">
                    <div className="bg-white rounded-xl shadow-lg p-3 mx-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            📂 Filtrar por categoría:
                        </label>
                        <select
                            value={filtroCategoria}
                            onChange={(e) => {
                                console.log('🏷️ Categoría seleccionada PRINCIPAL:', e.target.value);
                                setFiltroCategoria(e.target.value);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-gray-700 font-medium"
                        >
                            <option value="">🌟 Todas las Categorías</option>
                            {categorias.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                    🏷️ {cat.categori || cat.nombre || '-'}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                
                {/* Versión desktop - Horizontal */}
                <div className="hidden sm:flex flex-wrap gap-2 justify-center">
                    <button
                        className={`px-4 py-2 rounded-full font-bold border transition-all duration-200 ${!filtroCategoria ? 'bg-violet-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        onClick={() => {
                            console.log('🏷️ Categoría seleccionada PRINCIPAL: todas');
                            setFiltroCategoria('');
                        }}
                    >
                        Todas las Categorías
                    </button>
                    {categorias.map(cat => (
                        <button
                            key={cat.id}
                            className={`px-4 py-2 rounded-full font-bold border transition-all duration-200 ${Number(filtroCategoria) === cat.id ? 'bg-violet-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            onClick={() => {
                                console.log('🏷️ Categoría seleccionada PRINCIPAL:', cat.id, cat.categori);
                                setFiltroCategoria(cat.id.toString());
                            }}
                        >
                            {cat.categori || cat.nombre || '-'}
                        </button>
                    ))}
                </div>
            </div>
        )}
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
                      src={getOptimizedImageUrl(imagenesProductos[p.user_id][0], 800, { quality: 96, format: 'origin' })}
                      srcSet={buildImageSrcSet(imagenesProductos[p.user_id][0], [400, 800, 1200], { quality: 96, format: 'origin' })}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                      loading="lazy"
                      decoding="async"
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
                  <ExpandableDescription
                    text={p.descripcion}
                    lines={3}
                    className="mb-2"
                    textClassName="text-gray-600 text-xs sm:text-sm"
                    buttonClassName="mt-1 text-[11px] sm:text-xs font-semibold text-blue-600 hover:text-blue-800"
                  />
                  
                  {/* Usar el componente de precio con promoción */}
                  <PrecioConPromocion 
                    producto={p} 
                    promociones={promociones}
                    className="mb-2"
                  />
                  
                  <div className="text-xs text-gray-500 mb-2">Categoría: {getCategoriaNombre(p.category_id, categorias)}</div>

                  {/* Mostrar colores disponibles como paleta de círculos */}
                  {/* Mostrar colores disponibles como paleta de círculos */}
                  {(() => {
                    const coloresEnStock = Array.isArray(p.variantes)
                      ? p.variantes.filter(v => {
                          const colorNormalizado = String(v?.color || '')
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .trim();
                          return Number(v?.stock || 0) > 0 && colorNormalizado && colorNormalizado !== 'unico';
                        })
                      : [];
                    if (coloresEnStock.length <= 1) return null;
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-600 font-medium mb-2">Disponible en color:</p>
                        <div className="flex gap-2 flex-wrap justify-center">
                          {coloresEnStock.map((v, vIdx) => {
                              const colorStyle = getColorStyle(v.color);
                              return (
                                <div
                                  key={`${p.user_id}-${vIdx}`}
                                  className="relative group"
                                >
                                  <div
                                    className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-gray-500 transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-110"
                                    style={colorStyle}
                                  />
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-blue-700 !text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md">
                                    {v.color}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })()}
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
