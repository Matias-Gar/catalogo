"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- INICIALIZACIÓN DE SUPABASE (Movido aquí para evitar error de ruta) ---
// NOTA: Estas variables se esperan del entorno de Canvas.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || firebaseConfig.supabaseUrl;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || firebaseConfig.supabaseAnonKey;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("❌ ERROR: Las claves de Supabase no están definidas.");
}
// --------------------------------------------------------------------------


// Función para obtener la URL de la imagen
const getProductImageUrl = (path) => {
    if (!path) {
        return "https://placehold.co/200x200/cccccc/333333?text=Sin+Imagen";
    }
    // Dado que el administrador guarda la URL completa, la usamos directamente
    return path;
};


// Componente principal de la página (Tienda)
export default function Home() {
  // 1. Definición de las variables de estado
  const [productos, setProductos] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Función para cargar los datos de Supabase
  const fetchProductos = async () => {
    if (!supabase) {
        setLoading(false);
        setError("El cliente de Supabase no está inicializado. Verifica las variables de entorno.");
        return;
    }

    setLoading(true);
    setError(null);
    try {
        // Consultamos la tabla 'productos'
        const { data, error } = await supabase
            .from('productos')
            .select('user_id, nombre, descripcion, precio, stock, category_id, imagen_url'); 
            
        if (error) {
            throw new Error(`Error al cargar productos: ${error.message}`);
        }
        
        // Mapeamos los datos y asignamos nombres de categoría (simulado)
        const dataConCategorias = data.map(p => ({
            ...p,
            // Asignación simple de categoría basada en el ID
            categoria: p.category_id === 1 ? 'Ropa' : p.category_id === 2 ? 'Tecnología' : 'Otros',
        }));

        setProductos(dataConCategorias);
    } catch (e) {
        console.error("Error al cargar productos:", e.message);
        setError(`Error al cargar productos: ${e.message}. (Verifique RLS y nombre de tabla)`);
    } finally {
        setLoading(false);
    }
  };


  // Cargar productos al inicio y configurar el listener
  useEffect(() => {
    fetchProductos();
    
    // Configuración del Listener de tiempo real
    if (supabase) {
        const channel = supabase
          .channel('productos-public-channel')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'productos' },
            (payload) => {
              console.log('Cambio detectado en productos:', payload.eventType);
              fetchProductos(); 
            }
          )
          .subscribe();
        
        return () => {
          supabase.removeChannel(channel);
        };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // 2. Definición de la variable calculada: productosFiltrados
  const productosFiltrados = productos.filter(p => 
    filtroCategoria === '' || p.categoria === filtroCategoria
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
        <div className="mb-8 p-4 bg-white rounded-xl shadow-md flex flex-wrap justify-center space-x-2 sm:space-x-4">
          <button 
            onClick={() => setFiltroCategoria('')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition duration-150 ${filtroCategoria === '' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-indigo-100'}`}
          >
            Todas las Categorías
          </button>
          <button 
            onClick={() => setFiltroCategoria('Ropa')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition duration-150 ${filtroCategoria === 'Ropa' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-indigo-100'}`}
          >
            Ropa
          </button>
          <button 
            onClick={() => setFiltroCategoria('Tecnología')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition duration-150 ${filtroCategoria === 'Tecnología' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-indigo-100'}`}
          >
            Tecnología
          </button>
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
                  className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition duration-300 transform hover:-translate-y-1"
                >
                  <div className="w-full h-48 bg-gray-200 rounded-t-xl overflow-hidden">
                    <img
                        src={getProductImageUrl(p.imagen_url)}
                        alt={p.nombre}
                        className="w-full h-full object-cover transition duration-500 ease-in-out hover:scale-105"
                        onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/400x400/cccccc/333333?text=ERROR+IMAGEN"; }}
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-1 uppercase">{p.categoria}</p>
                    <h2 className="text-lg font-semibold text-gray-800 truncate mb-2">{p.nombre}</h2>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{p.descripcion}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-indigo-600">Bs {p.precio ? p.precio.toFixed(2) : '0.00'}</span>
                      <span className={`text-sm font-medium px-3 py-1 rounded-full ${p.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {p.stock > 0 ? `Stock: ${p.stock}` : 'Agotado'}
                      </span>
                    </div>
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
