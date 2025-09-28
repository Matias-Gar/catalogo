"use client";
import { useEffect, useState } from "react";
// 💡 ASEGÚRATE DE QUE ESTA RUTA ES CORRECTA:
import { supabase } from "../lib/SupabaseClient"; 
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function Page() {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null); // Estado para el filtro

    useEffect(() => {
        async function fetchProductos() {
            try {
                setLoading(true);
                setError(null);
                
                // Carga de todos los productos
                const { data, error: fetchError } = await supabase
                    .from("productos")
                    // Asegúrate de incluir 'categoria' aquí para que el filtro funcione
                    .select("*, descripcion, categoria"); 

                if (fetchError) {
                    throw fetchError;
                }

                setProductos(data || []);
            } catch (e) {
                console.error("Error al cargar productos:", e.message);
                setError("No pudimos cargar el catálogo. Inténtalo más tarde.");
            } finally {
                setLoading(false);
            }
        }
        fetchProductos();
    }, []);

    const telefono = "59169477200";

    // 💡 Lógica ÚNICA para obtener y filtrar categorías (Debe ir aquí, ANTES del return)
    const categorias = [...new Set(productos.map(p => p.categoria))].filter(Boolean);
    const productosFiltrados = categoriaSeleccionada
        ? productos.filter(p => p.categoria === categoriaSeleccionada)
        : productos;

    // 💡 El componente Header ya lo pusiste en layout.tsx, así que lo quitamos de aquí.
    return (
        <div className="min-h-screen bg-white"> 
            
            {/* El Header ya lo pusiste en layout.tsx, no va aquí. */}
            
            <main className="p-6">
                <h2 className="text-4xl font-extrabold text-center mb-10 text-gray-800">Catálogo de Productos</h2>

                {/* ⚠️ Manejo de Errores y Carga */}
                {loading && <p className="text-center text-xl text-gray-700">Cargando productos...</p>}
                {error && (
                    <div className="text-center p-4 my-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                        <p>{error}</p>
                    </div>
                )}

                {/* 💡 Botones de Categoría */}
                {!loading && !error && productos.length > 0 && (
                    <div className="flex justify-center space-x-4 flex-wrap gap-2 mb-12">
                        
                        <button
                            onClick={() => setCategoriaSeleccionada(null)}
                            className={`px-6 py-3 rounded-full font-bold text-lg transition duration-200 shadow-md ${
                                categoriaSeleccionada === null ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-indigo-300 hover:bg-indigo-50'
                            }`}
                        >
                            Todos los Productos
                        </button>
                        
                        {categorias.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoriaSeleccionada(cat)}
                                className={`px-6 py-3 rounded-full font-bold text-lg transition duration-200 shadow-md ${
                                    categoriaSeleccionada === cat ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-indigo-300 hover:bg-indigo-50'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
                
                {/* 💡 Grid de Productos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {productosFiltrados.map((p) => (
                        <div key={p.id} className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition duration-300 p-4 text-center flex flex-col justify-between">
                            {/* ... (Tu código de tarjeta de producto) ... */}
                            {/* Asegúrate de que tu mapeo original de productos está aquí */}
                            
                            <div>
                                <img
                                    src={p.imagen_url || "https://via.placeholder.com/300x200?text=No+Imagen"}
                                    alt={p.nombre}
                                    className="w-full h-48 object-cover rounded-lg mb-4"
                                />
                                <h2 className="text-xl font-semibold mt-2 text-gray-800 line-clamp-2">{p.nombre}</h2>
                                {p.descripcion && <p className="text-sm text-gray-500 mb-2 line-clamp-3">{p.descripcion}</p>}
                                <p className="text-2xl font-bold text-green-600 mb-4">Bs {p.precio}</p>
                            </div>
                            <a
                                href={`https://wa.me/${telefono}?text=Hola%2C%20estoy%20interesado%2Fa%20en%20el%20producto%20${encodeURIComponent(
                                    p.nombre
                                )}%20con%20precio%20Bs%20${p.precio}.`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-block bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-full transition duration-300 shadow-md"
                            >
                                🛒 Pedir por WhatsApp
                            </a>
                            
                        </div>
                    ))}
                </div>
            </main>
            <SpeedInsights />
        </div>
    );
}