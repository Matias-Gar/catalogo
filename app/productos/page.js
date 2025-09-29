"use client"; // <--- ESTA ES LA CLAVE

// CÓDIGO CORREGIDO Y COMPLETO
import { useState, useEffect } from 'react';

// Reemplaza con tu número de WhatsApp Business (código de país + número, sin signos + ni guiones)
const WHATSAPP_NUMBER = "59169477200"; 


import { supabase } from '../../lib/SupabaseClient';

export default function CatalogoPage() {
    // --- Estados ---
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const [productos, setProductos] = useState([]);
    const [imagenesProductos, setImagenesProductos] = useState({});
    // Estado para modal de imagen
    const [modalImg, setModalImg] = useState(null); // { urls: string[], index: number, nombre: string }

    // --- Efectos (Hooks) ---


    // 1. Cargar productos y sus imágenes desde Supabase
    useEffect(() => {
        const fetchProductosYImagenes = async () => {
            // Traer productos
            const { data: productosData, error: productosError } = await supabase
                .from('productos')
                .select('*');
            if (productosError || !productosData) {
                setProductos([]);
                setImagenesProductos({});
                return;
            }
            setProductos(productosData);

            // Traer imágenes asociadas
            const { data: imagenesData, error: imagenesError } = await supabase
                .from('producto_imagenes')
                .select('producto_id, imagen_url');
            if (imagenesError || !imagenesData) {
                setImagenesProductos({});
                return;
            }
            // Agrupar imágenes por producto_id
            const imgs = {};
            imagenesData.forEach(img => {
                if (!imgs[img.producto_id]) imgs[img.producto_id] = [];
                imgs[img.producto_id].push(img.imagen_url);
            });
            setImagenesProductos(imgs);
        };
        fetchProductosYImagenes();
    }, []);

    // 2. Cargar carrito desde localStorage al inicio
    useEffect(() => {
        const stored = localStorage.getItem('cart');
        if (stored) setCart(JSON.parse(stored));
    }, []);

    // 3. Guardar carrito en localStorage cada vez que cambia
    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(cart));
    }, [cart]);

    // --- Funciones del Carrito ---

    const getProductInCart = (id) => cart.find(p => p.id === id);

    const addToCart = (producto) => {
        setCart(prev => {
            const idx = prev.findIndex(p => p.id === producto.id);
            if (idx !== -1) {
                // Producto ya en el carrito: Aumentar cantidad
                const updated = [...prev];
                updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
                return updated;
            } else {
                // Producto nuevo: Añadir al carrito con cantidad 1
                return [...prev, { ...producto, cantidad: 1 }];
            }
        });
    };

    const updateCartQty = (id, newQty) => {
        const quantity = Math.max(1, newQty); // Asegura que la cantidad sea al menos 1
        setCart(prev =>
            prev.map(item =>
                item.id === id ? { ...item, cantidad: quantity } : item
            )
        );
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    // --- Función de WhatsApp (CORREGIDA) ---

    const sendWhatsapp = () => {
        if (cart.length === 0) {
            alert("Tu cesta está vacía. Agrega productos para enviar un pedido.");
            return;
        }

        const itemsList = cart.map(item => {
            // CORRECCIÓN: aplicar toFixed(2) al resultado de la multiplicación.
            const subtotal = (item.precio * item.cantidad).toFixed(2); 
            return `*${item.cantidad}x* ${item.nombre} - (Bs ${subtotal})`;
        }).join('\n');

        const total = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0).toFixed(2);

        const message = encodeURIComponent(
            `¡Hola! Me gustaría hacer el siguiente pedido:\n\n${itemsList}\n\n*Total:* Bs ${total}\n\nGracias.`
        );

        const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
        window.open(whatsappURL, '_blank');
        setShowCart(false); 
    };

    // --- Renderizado ---

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 relative">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">
                🛍️ Catálogo de Productos
            </h1>

            {/* LISTA DE PRODUCTOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {productos.length > 0 ? (
                    productos.map(producto => {
                        const isInCart = getProductInCart(producto.user_id);
                        const imagenes = imagenesProductos[producto.user_id] || [];

                        return (
                            <div
                                key={producto.user_id}
                                className="bg-white border border-gray-200 rounded-xl p-4 shadow-lg flex flex-col transition-shadow duration-300 hover:shadow-xl"
                            >
                                <div className="relative">
                                    {/* Imagen del Producto o Placeholder */}
                                    {imagenes.length > 0 ? (
                                        <div className="w-full h-40 mb-2 overflow-hidden rounded-lg relative group cursor-pointer">
                                            {/* Carrusel de miniaturas */}
                                            <img
                                                src={imagenes[0]}
                                                alt={producto.nombre}
                                                className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-105"
                                                onClick={() => setModalImg({ urls: imagenes, index: 0, nombre: producto.nombre })}
                                                onError={e => { e.target.onerror = null; e.target.src = 'https://placehold.co/300x200/cccccc/333333?text=Sin+Imagen'; }}
                                            />
                                            {/* Flechas si hay más de una imagen */}
                                            {imagenes.length > 1 && (
                                                <div className="absolute bottom-2 left-2 flex gap-1">
                                                    {imagenes.map((img, idx) => (
                                                        <button
                                                            key={idx}
                                                            className={`w-3 h-3 rounded-full border-2 ${idx === 0 ? 'bg-green-600 border-green-700' : 'bg-white border-gray-400'} focus:outline-none`}
                                                            title={`Ver imagen ${idx + 1}`}
                                                            onClick={e => { e.stopPropagation(); setModalImg({ urls: imagenes, index: idx, nombre: producto.nombre }); }}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {/* Botón de Añadir */}
                                            <button
                                                className={`absolute bottom-2 right-2 ${isInCart ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'} text-white rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold shadow-xl focus:outline-none transition-colors duration-150`}
                                                onClick={e => { e.stopPropagation(); addToCart(producto); }}
                                                title={isInCart ? `Añadir otra unidad (actual: ${isInCart.cantidad})` : "Agregar a la cesta"}
                                            >
                                                +
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full h-40 mb-2 bg-gray-100 flex flex-col items-center justify-center rounded-lg relative">
                                            <span className="text-gray-400 text-center">Sin imagen</span>
                                            <button
                                                className={`absolute bottom-2 right-2 ${isInCart ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'} text-white rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold shadow-xl focus:outline-none transition-colors duration-150`}
                                                onClick={() => addToCart(producto)}
                                                title={isInCart ? `Añadir otra unidad (actual: ${isInCart.cantidad})` : "Agregar a la cesta"}
                                            >
                                                +
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 flex flex-col">
                                    <div className="text-xs text-gray-500 uppercase font-bold mb-1">{producto.categoria_nombre || '-'}</div>
                                    <div className="text-lg font-bold mb-1 line-clamp-2">{producto.nombre}</div>
                                    <div className="text-blue-700 font-bold text-xl mb-1">Bs {producto.precio.toFixed(2)}</div>
                                    <div className="text-green-700 text-xs font-semibold">Stock: {producto.stock ?? '-'}</div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full text-center text-gray-400 py-8">
                        {productos.length === 0 ? 'No hay productos disponibles.' : null}
                    </div>
                )}
            </div>

            {/* MODAL DE IMAGEN COMPLETA CON CARRUSEL */}
            {modalImg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setModalImg(null)}>
                    <div className="relative max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
                        <button
                            className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-700 rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold shadow-lg z-10"
                            onClick={() => setModalImg(null)}
                            title="Cerrar"
                        >
                            ×
                        </button>
                        {/* Flechas de navegación */}
                        {modalImg.urls.length > 1 && (
                            <>
                                <button
                                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold shadow-lg z-10"
                                    onClick={() => setModalImg(m => ({ ...m, index: (m.index - 1 + m.urls.length) % m.urls.length }))}
                                    title="Anterior"
                                >
                                    &#8592;
                                </button>
                                <button
                                    className="absolute right-12 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold shadow-lg z-10"
                                    onClick={() => setModalImg(m => ({ ...m, index: (m.index + 1) % m.urls.length }))}
                                    title="Siguiente"
                                >
                                    &#8594;
                                </button>
                            </>
                        )}
                        <img
                            src={modalImg.urls[modalImg.index]}
                            alt={modalImg.nombre}
                            className="w-full max-h-[80vh] object-contain rounded-xl bg-white"
                        />
                        <div className="text-center text-white font-bold mt-2 text-lg drop-shadow-lg">{modalImg.nombre}</div>
                        {/* Miniaturas */}
                        {modalImg.urls.length > 1 && (
                            <div className="flex justify-center gap-2 mt-2">
                                {modalImg.urls.map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={img}
                                        alt={modalImg.nombre + ' miniatura ' + (idx + 1)}
                                        className={`w-14 h-14 object-cover rounded border-2 cursor-pointer ${idx === modalImg.index ? 'border-green-600' : 'border-gray-300'}`}
                                        onClick={() => setModalImg(m => ({ ...m, index: idx }))}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* ICONO DE CESTA GLOBAL */}
            <button
                className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-full shadow-xl p-3 flex items-center justify-center hover:bg-green-50 transition-colors focus:outline-none focus:ring-4 focus:ring-green-500/50"
                onClick={() => setShowCart(v => !v)}
                aria-label="Ver cesta"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-green-700">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.023.832l.71 4.256c.068.406.402.696.818.696h11.332a.973.973 0 00.916-.658l3.1-9.289a1.001 1.001 0 00-.916-1.348H3.64c-.536 0-1.033.433-1.033.97s.497.97 1.033.97zm2.4 12.75a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm12.75 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                </svg>

                {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse">
                        {cart.reduce((a, p) => a + p.cantidad, 0)}
                    </span>
                )}
            </button>

            {/* MODAL DE CESTA */}
            {showCart && (
                <div className="fixed bottom-20 right-4 z-50 w-full max-w-xs bg-white border border-gray-300 rounded-xl shadow-2xl p-4 transition-all duration-300 transform animate-fade-in-up">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                        <h2 className="text-xl font-bold">🛒 Tu cesta</h2>
                        <button className="text-gray-500 hover:text-red-600 text-2xl font-bold ml-2 transition-colors" onClick={() => setShowCart(false)} title="Cerrar">&times;</button>
                    </div>

                    {cart.length === 0 ? (
                        <div className="text-gray-400 text-sm text-center py-4">La cesta está vacía.</div>
                    ) : (
                        <>
                            <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto mb-4">
                                {cart.map(item => (
                                    <li key={item.id} className="flex items-center py-3 gap-2">
                                        <span className="flex-1 truncate text-sm font-medium">{item.nombre}</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={item.cantidad}
                                            onChange={e => updateCartQty(item.id, parseInt(e.target.value) || 1)}
                                            className="w-14 border border-gray-300 rounded px-1 py-0.5 text-center text-sm focus:border-green-500 focus:ring-green-500"
                                        />
                                        <button
                                            className="ml-2 text-red-500 hover:text-red-700 text-lg font-bold px-1"
                                            onClick={() => removeFromCart(item.id)}
                                            title="Quitar"
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex justify-between items-center mb-3 pt-2 border-t font-bold">
                                <span>Total:</span>
                                <span className="text-xl text-blue-700">Bs {cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0).toFixed(2)}</span>
                            </div>
                        </>
                    )}

                    <button
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg transition-colors duration-150 flex items-center justify-center gap-2 disabled:bg-gray-400"
                        onClick={sendWhatsapp}
                        disabled={cart.length === 0}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-.527-.084-1.05-.25-1.558l-1.99-1.99a1.5 1.5 0 00-2.122 0l-3.232 3.232a1.5 1.5 0 000 2.122l1.99 1.99c.508.166 1.03.25 1.558.25h.001c.527 0 1.05-.084 1.558-.25l1.99-1.99a1.5 1.5 0 000-2.122zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Enviar pedido por WhatsApp
                    </button>
                </div>
            )}
        </div>
    );
}