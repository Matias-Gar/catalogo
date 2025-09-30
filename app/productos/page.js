"use client"; // <--- ESTA ES LA CLAVE

// CÓDIGO CORREGIDO Y COMPLETO
// Cambia este número por el tuyo (sin + ni espacios, solo números, ej: 5491122334455)
const WHATSAPP_NUMBER = "59160353747";
import { useState, useEffect } from 'react';


import { supabase } from '../../lib/SupabaseClient';

export default function CatalogoPage() {
    // --- Estados ---
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const [productos, setProductos] = useState([]);
    const [imagenesProductos, setImagenesProductos] = useState({});
    const [categorias, setCategorias] = useState([]);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
    // Estado para modal de imagen
    const [modalImg, setModalImg] = useState(null); // { urls: string[], index: number, nombre: string }

    // --- Efectos (Hooks) ---
    // Detectar usuario logeado
    const [usuario, setUsuario] = useState(null);
    useEffect(() => {
        const supa = supabase;
        const getUser = async () => {
            const { data: { user } } = await supa.auth.getUser();
            setUsuario(user);
        };
        getUser();
    }, []);


    // 1. Cargar productos y sus imágenes desde Supabase
    useEffect(() => {
        const fetchProductosYCategoriasYImagenes = async () => {
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

            // Traer categorías
            const { data: categoriasData, error: categoriasError } = await supabase
                .from('categorias')
                .select('*');
            if (!categoriasError && categoriasData) {
                setCategorias(categoriasData);
            }

            // Traer imágenes asociadas
            const { data: imagenesData, error: imagenesError } = await supabase
                .from('producto_imagenes')
                .select('producto_id, imagen_url');
            if (imagenesError || !imagenesData) {
                setImagenesProductos({});
                return;
            }
            // Agrupar imágenes por producto_id (usar tipo number para coincidir con producto.user_id)
            const imgs = {};
            imagenesData.forEach(img => {
                const key = Number(img.producto_id);
                if (!imgs[key]) imgs[key] = [];
                imgs[key].push(img.imagen_url);
            });
            setImagenesProductos(imgs);
        };
        fetchProductosYCategoriasYImagenes();
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

    // Buscar producto en el carrito por id
    const getProductInCart = (user_id) => cart.find(p => p.user_id === user_id);

    // Añadir producto al carrito (por id)
    const addToCart = (producto) => {
        setCart(prev => {
            const idx = prev.findIndex(p => p.user_id === producto.user_id);
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

    // Cambiar cantidad de producto en el carrito (por id)
    const updateCartQty = (user_id, newQty) => {
        const quantity = Math.max(1, newQty); // Asegura que la cantidad sea al menos 1
        setCart(prev =>
            prev.map(item =>
                item.user_id === user_id ? { ...item, cantidad: quantity } : item
            )
        );
    };

    // Eliminar producto del carrito (por id)
    const removeFromCart = (user_id) => {
        setCart(prev => prev.filter(item => item.user_id !== user_id));
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
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-extrabold text-gray-900 text-center flex items-center gap-2">
                    <img src="/free-shopping-icons-vector.jpg" alt="icono pedido" className="w-9 h-9 inline-block align-middle mr-2 rounded" />
                    Realiza tu pedido
                </h1>
                {usuario && (
                    <div className="flex gap-2">
                        <a href="/admin" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-bold shadow transition-colors duration-150 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v1.5M3 7.5v10.125c0 1.243 1.007 2.25 2.25 2.25h13.5A2.25 2.25 0 0021 17.625V7.5M3 7.5h18M7.5 10.5h9" />
                            </svg>
                            Panel Admin
                        </a>
                        <a href="/admin/ventas" className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full font-bold shadow transition-colors duration-150 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293a1 1 0 00-.293.707V17a1 1 0 001 1h12a1 1 0 001-1v-1a1 1 0 00-.293-.707L17 13M9 17v2a2 2 0 104 0v-2" />
                            </svg>
                            Pedidos
                        </a>
                    </div>
                )}
            </div>

            {/* FILTRO POR CATEGORÍA */}
            {categorias.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-8">
                    <button
                        className={`px-4 py-2 rounded-full font-bold border ${!categoriaSeleccionada ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => setCategoriaSeleccionada('')}
                    >
                        Todas las Categorías
                    </button>
                    {categorias.map(cat => (
                        <button
                            key={cat.id}
                            className={`px-4 py-2 rounded-full font-bold border ${categoriaSeleccionada === cat.id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                            onClick={() => setCategoriaSeleccionada(cat.id)}
                        >
                            {cat.categori || cat.nombre || '-'}
                        </button>
                    ))}
                </div>
            )}

            {/* LISTA DE PRODUCTOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {productos.length > 0 ? (
                    productos
                        .filter(producto => !categoriaSeleccionada || producto.category_id === categoriaSeleccionada)
                        .map((producto, idx) => {
                            const isInCart = getProductInCart(producto.user_id);
                            const imagenes = imagenesProductos[producto.user_id] || [];
                            // Definir la variable categoria justo antes del return
                            const categoria = Array.isArray(categorias) ? categorias.find(c => c.id === producto.category_id) : null;
                            return (
                                <div
                                    key={producto.user_id ? producto.user_id : 'producto-' + idx}
                                    className="bg-white border border-gray-200 rounded-xl p-4 shadow-lg flex flex-col transition-shadow duration-300 hover:shadow-xl"
                                >
                                    <div className="relative">
                                        {Array.isArray(imagenes) && imagenes.length > 0 && typeof imagenes[0] === 'string' ? (
                                            <div className="w-full h-40 mb-2 overflow-hidden rounded-lg relative group cursor-pointer">
                                                <img
                                                    src={imagenes[0]}
                                                    alt={producto.nombre}
                                                    className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-105"
                                                    onClick={() => setModalImg({ urls: imagenes, index: 0, nombre: producto.nombre })}
                                                    onError={e => { e.target.onerror = null; e.target.src = 'https://placehold.co/300x200/cccccc/333333?text=Sin+Imagen'; }}
                                                />
                                                {/* Miniaturas si hay más de una imagen */}
                                                {imagenes.length > 1 && (
                                                    <div className="absolute bottom-2 left-2 flex gap-1">
                                                        {imagenes.map((img, idx2) => (
                                                            <button
                                                                key={img + '-' + idx2}
                                                                className={`w-3 h-3 rounded-full border-2 ${idx2 === 0 ? 'bg-green-600 border-green-700' : 'bg-white border-gray-400'} focus:outline-none`}
                                                                title={`Ver imagen ${idx2 + 1}`}
                                                                onClick={e => { e.stopPropagation(); setModalImg({ urls: imagenes, index: idx2, nombre: producto.nombre }); }}
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
                                    <div className="flex-1 flex flex-col">
                                        <div className="text-lg text-black font-bold mb-0.5 line-clamp-2">{categoria ? (categoria.categori || categoria.nombre) : '-'}</div>
                                        <div className="text-lg font-bold mb-1 line-clamp-2">{producto.nombre}</div>
                                        <div className="text-blue-700 font-bold text-xl mb-1">Bs {producto.precio.toFixed(2)}</div>
                                        {/* Stock eliminado por requerimiento */}
                                    </div>
                                    <button
                                        className={`mt-4 self-end ${isInCart ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'} text-white rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold shadow-xl focus:outline-none transition-colors duration-150`}
                                        onClick={() => addToCart(producto)}
                                        title={isInCart ? `Añadir otra unidad (actual: ${isInCart.cantidad})` : "Agregar a la cesta"}
                                    >
                                        +
                                    </button>
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
                                        key={img + '-' + idx}
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
                                {cart.length > 0 ? (
                                    cart.map(item => (
                                        <li key={item.user_id} className="flex items-center py-2 gap-2 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg mb-2 shadow-sm">
                                            <span className="flex-1 truncate text-sm font-bold text-green-900">{item.nombre}</span>
                                            <input
                                                type="number"
                                                min={1}
                                                value={item.cantidad}
                                                onChange={e => updateCartQty(item.user_id, parseInt(e.target.value) || 1)}
                                                className="w-12 border-2 border-green-400 rounded px-1 py-0.5 text-center text-sm font-semibold text-green-800 bg-white focus:border-blue-500 focus:ring-blue-500"
                                            />
                                            <button
                                                className="ml-2 text-white bg-red-600 hover:bg-red-700 rounded-full w-6 h-6 flex items-center justify-center text-base font-bold shadow transition"
                                                onClick={() => removeFromCart(item.user_id)}
                                                title="Quitar"
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))
                                ) : null}
                            </ul>
                            <div className="flex justify-between items-center mb-3 pt-2 border-t-2 border-green-600 font-extrabold">
                                <span className="text-lg text-green-800">Total:</span>
                                <span className="text-2xl text-blue-800 bg-yellow-200 px-3 py-1 rounded-lg shadow">Bs {cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0).toFixed(2)}</span>
                            </div>
                        </>
                    )}

                    <button
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white py-2 rounded-xl font-bold shadow-xl transition-colors duration-150 flex items-center justify-center gap-2 text-base disabled:bg-gray-400"
                        onClick={sendWhatsapp}
                        disabled={cart.length === 0}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-.527-.084-1.05-.25-1.558l-1.99-1.99a1.5 1.5 0 00-2.122 0l-3.232 3.232a1.5 1.5 0 000 2.122l1.99 1.99c.508.166 1.03.25 1.558.25h.001c.527 0 1.05-.084 1.558-.25l1.99-1.99a1.5 1.5 0 000-2.122zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Enviar pedido por WhatsApp
                    </button>
                </div>
            )}
        </div>
    );
}