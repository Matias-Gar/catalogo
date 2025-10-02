"use client"; // <--- ESTA ES LA CLAVE

// CÓDIGO CORREGIDO Y COMPLETO
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/SupabaseClient';
import { PrecioConPromocion } from '../../lib/promociones';
import { usePromociones } from '../../lib/usePromociones';
import { usePacks, calcularDescuentoPack } from '../../lib/packs';
import { CONFIG, whatsappUtils } from '../../lib/config';

export default function CatalogoPage() {
    // --- Estados ---
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const [showConfirmOrder, setShowConfirmOrder] = useState(false); // Nuevo estado para confirmación
    const [productos, setProductos] = useState([]);
    const [imagenesProductos, setImagenesProductos] = useState({});
    const [categorias, setCategorias] = useState([]);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
    const [customerData, setCustomerData] = useState({ nombre: '', telefono: '' }); // Datos del cliente
    // Estado para modal de imagen
    const [modalImg, setModalImg] = useState(null); // { urls: string[], index: number, nombre: string }

    // Usar el hook para promociones
    const { promociones, loading: loadingPromociones } = usePromociones();
    
    // Usar el hook para packs
    const { packs, loading: loadingPacks } = usePacks();

    // --- Efectos (Hooks) ---
    // Detectar usuario logeado
    const [usuario, setUsuario] = useState(null);
    useEffect(() => {
        const getUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && session.user) {
                // Buscar nombre en perfiles si existe, si no usar email
                let nombre = session.user.email;
                const { data: perfil } = await supabase
                  .from('perfiles')
                  .select('nombre')
                  .eq('id', session.user.id)
                  .single();
                if (perfil && perfil.nombre) nombre = perfil.nombre;
                setUsuario({ id: session.user.id, email: session.user.email, nombre });
            } else {
                setUsuario(null);
            }
        };
        getUser();
    }, []);

    // Auto-llenar datos del cliente cuando el usuario esté logueado
    useEffect(() => {
        if (usuario && usuario.nombre) {
            setCustomerData(prevData => ({
                ...prevData,
                nombre: prevData.nombre || usuario.nombre
            }));
        }
    }, [usuario]);


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
        const stored = localStorage.getItem('carrito_temporal');
        if (stored) setCart(JSON.parse(stored));
    }, []);

    // 3. Guardar carrito en localStorage cada vez que cambia
    useEffect(() => {
        localStorage.setItem('carrito_temporal', JSON.stringify(cart));
    }, [cart]);

    // --- Funciones del Carrito ---
    
    // Función helper para obtener el precio final de un producto (con promoción si aplica)
    const getPrecioFinal = (producto) => {
        const promocion = promociones.find(
            promo => 
                promo.producto_id === producto.user_id && 
                promo.activa === true &&
                (!promo.fecha_fin || new Date(promo.fecha_fin) >= new Date())
        );

        if (!promocion) {
            return producto.precio;
        }

        let precioFinal = producto.precio;
        switch (promocion.tipo) {
            case 'descuento':
                precioFinal = producto.precio * (1 - promocion.valor / 100);
                break;
            case 'precio_fijo':
                precioFinal = promocion.valor;
                break;
            case 'descuento_absoluto':
                precioFinal = Math.max(0, producto.precio - promocion.valor);
                break;
            default:
                precioFinal = producto.precio;
        }
        return Math.max(0, precioFinal);
    };

    // Buscar producto en el carrito por id
    const getProductInCart = (user_id) => cart.find(p => p.user_id === user_id);

    // Añadir producto al carrito (por id)
    const addToCart = (producto) => {
        const precioFinal = getPrecioFinal(producto);
        
        setCart(prev => {
            const idx = prev.findIndex(p => p.user_id === producto.user_id);
            if (idx !== -1) {
                // Producto ya en el carrito: Aumentar cantidad
                const updated = [...prev];
                updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
                return updated;
            } else {
                // Producto nuevo: Añadir al carrito con cantidad 1 y precio promocional
                return [...prev, { ...producto, cantidad: 1, precio: precioFinal }];
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

    // --- Función para abrir confirmación de pedido ---
    const openOrderConfirmation = () => {
        if (cart.length === 0) {
            alert("Tu cesta está vacía. Agrega productos para enviar un pedido.");
            return;
        }
        
        // Auto-llenar datos si el usuario está logueado
        if (usuario && usuario.nombre) {
            setCustomerData(prevData => ({
                nombre: prevData.nombre || usuario.nombre,
                telefono: prevData.telefono || ''
            }));
        }
        
        setShowCart(false);
        setShowConfirmOrder(true);
    };

    // --- Función de WhatsApp (MEJORADA) ---
    const confirmAndSendWhatsapp = async () => {
        if (cart.length === 0) {
            alert("Tu cesta está vacía. Agrega productos para enviar un pedido.");
            return;
        }

        // 1. Guardar carrito en carritos_pendientes
        let nombreFinal = customerData.nombre || (usuario && usuario.nombre) || null;
        let telefonoFinal = customerData.telefono || null;
        let emailFinal = usuario && usuario.email ? usuario.email : null;
        
        // Insertar y obtener el número de pedido (id)
        const { data, error } = await supabase.from("carritos_pendientes").insert([
            {
                cliente_nombre: nombreFinal || null,
                cliente_telefono: telefonoFinal || null,
                usuario_id: usuario ? usuario.id : null,
                usuario_email: emailFinal || null,
                productos: cart.map(p => ({ producto_id: p.user_id, cantidad: p.cantidad, precio_unitario: p.precio })),
            }
        ]).select('id').single();
        
        if (error || !data) {
            alert("No se pudo guardar el pedido. Intenta de nuevo.");
            return;
        }
        
        const pedidoId = data.id;

        // 2. Preparar mensaje WhatsApp
        const itemsList = cart.map(item => {
            const subtotal = (item.precio * item.cantidad).toFixed(2); 
            return `*${item.cantidad}x* ${item.nombre} - (Bs ${subtotal})`;
        }).join('\n');
        
        const total = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0).toFixed(2);
        const nombreTexto = nombreFinal ? `Nombre: ${nombreFinal}\n` : '';
        const telefonoTexto = telefonoFinal ? `Teléfono: ${telefonoFinal}\n` : '';
        const pedidoTexto = `N° Pedido: ${pedidoId}`;
        
        const message = encodeURIComponent(
            `¡Hola! Me gustaría hacer el siguiente pedido:\n\n${pedidoTexto}\n${nombreTexto}${telefonoTexto}\n${itemsList}\n\n*Total:* Bs ${total}\n\n¡Gracias!`
        );
        
        const whatsappURL = `https://wa.me/${CONFIG.WHATSAPP_BUSINESS}?text=${message}`;
        window.open(whatsappURL, '_blank');
        
        // Limpiar carrito y cerrar modales
        setShowConfirmOrder(false);
        setCart([]);
        setCustomerData({ nombre: '', telefono: '' });
        localStorage.removeItem('carrito_temporal');
        
        // Mensaje de éxito
        alert("¡Pedido enviado exitosamente! Se ha abierto WhatsApp para completar tu pedido.");
    };

    // --- Renderizado ---

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 relative">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-extrabold text-gray-900 text-center flex items-center gap-2">
                    <img src="/free-shopping-icons-vector.jpg" alt="icono pedido" className="w-9 h-9 inline-block align-middle mr-2 rounded" />
                    Realiza tu pedido
                </h1>
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

            {/* SECCIÓN DE PACKS ESPECIALES */}
            {!loadingPacks && packs.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-purple-800 mb-4 text-center">
                        📦 Packs Especiales - ¡Combos con Descuento!
                    </h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {packs.map((pack) => {
                            const { precioIndividual, descuentoAbsoluto, descuentoPorcentaje } = calcularDescuentoPack(pack);
                            
                            return (
                                <div key={pack.id} className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-4 shadow-md hover:shadow-lg transition-all duration-200">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-bold text-purple-800">
                                            📦 {pack.nombre}
                                        </h3>
                                        <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                            -{descuentoPorcentaje.toFixed(0)}% OFF
                                        </span>
                                    </div>

                                    {/* Productos incluidos (compacto) */}
                                    <div className="mb-3">
                                        <div className="text-xs text-purple-700 font-medium mb-1">
                                            Incluye: {pack.pack_productos.map(item => 
                                                `${item.cantidad}x ${item.productos.nombre}`
                                            ).join(', ')}
                                        </div>
                                    </div>

                                    {/* Precios */}
                                    <div className="bg-white/70 rounded-md p-3 mb-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-gray-600">Individual:</span>
                                            <span className="text-xs text-gray-500 line-through">
                                                Bs {precioIndividual.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-purple-800">Pack:</span>
                                            <span className="text-lg font-bold text-green-600">
                                                Bs {pack.precio_pack}
                                            </span>
                                        </div>
                                        <div className="text-center text-xs font-bold text-green-700 mt-1">
                                            💰 Ahorras: Bs {descuentoAbsoluto.toFixed(2)}
                                        </div>
                                    </div>

                                    {/* Botón para agregar pack al carrito */}
                                    <button
                                        onClick={() => {
                                            // Agregar el pack como una unidad especial
                                            const itemPack = {
                                                user_id: `pack-${pack.id}`,
                                                nombre: `📦 ${pack.nombre}`,
                                                precio: pack.precio_pack,
                                                stock: 999,
                                                categoria: 'Pack Especial',
                                                cantidad: 1,
                                                tipo: 'pack',
                                                pack_id: pack.id,
                                                pack_data: pack,
                                                descuento_pack: descuentoAbsoluto
                                            };

                                            setCart(prev => {
                                                const existe = prev.find(p => p.user_id === itemPack.user_id);
                                                if (existe) {
                                                    return prev.map(p =>
                                                        p.user_id === itemPack.user_id
                                                            ? { ...p, cantidad: p.cantidad + 1 }
                                                            : p
                                                    );
                                                } else {
                                                    return [...prev, itemPack];
                                                }
                                            });
                                            alert(`¡Pack "${pack.nombre}" agregado al carrito!`);
                                        }}
                                        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-md font-bold text-sm transition-colors duration-200"
                                    >
                                        🛒 Agregar Pack al Carrito
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Separador */}
                    <div className="flex items-center justify-center mb-4">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="px-3 text-gray-500 text-sm">O elige productos individuales</span>
                        <div className="flex-grow border-t border-gray-300"></div>
                    </div>
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
                                            <div className="w-full h-28 sm:h-40 mb-2 overflow-hidden rounded-lg relative group cursor-pointer">
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
                                        <div className="text-base sm:text-lg text-black font-bold mb-0.5 line-clamp-2">{categoria ? (categoria.categori || categoria.nombre) : '-'}</div>
                                        <div className="text-base sm:text-lg font-bold mb-1 line-clamp-2">{producto.nombre}</div>
                                        
                                        {/* Usar el componente de precio con promoción */}
                                        <PrecioConPromocion 
                                            producto={producto} 
                                            promociones={promociones}
                                            className="mb-1"
                                        />
                                        
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
                        onClick={openOrderConfirmation}
                        disabled={cart.length === 0}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Revisar y confirmar pedido
                    </button>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN DE PEDIDO */}
            {showConfirmOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        {/* Header del modal */}
                        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 rounded-t-2xl">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Confirmar Pedido
                                </h2>
                                <button 
                                    onClick={() => setShowConfirmOrder(false)}
                                    className="text-white hover:text-red-200 text-3xl font-bold transition-colors"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Contenido del modal */}
                        <div className="p-6">
                            {/* Datos del cliente */}
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                    Datos del cliente
                                    {usuario && (
                                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold ml-2">
                                            Usuario logueado: {usuario.email}
                                        </span>
                                    )}
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nombre completo *
                                            {usuario && usuario.nombre && (
                                                <span className="text-green-600 text-xs ml-2">
                                                    ✓ Auto-completado desde tu perfil
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            value={customerData.nombre}
                                            onChange={(e) => setCustomerData({...customerData, nombre: e.target.value})}
                                            placeholder="Ingresa tu nombre completo"
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                                usuario && usuario.nombre 
                                                    ? 'border-green-300 bg-green-50' 
                                                    : 'border-gray-300'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Teléfono (opcional)
                                        </label>
                                        <input
                                            type="tel"
                                            value={customerData.telefono}
                                            onChange={(e) => setCustomerData({...customerData, telefono: e.target.value})}
                                            placeholder="Ej: 70123456"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Resumen del pedido */}
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                                    </svg>
                                    Resumen del pedido
                                </h3>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="space-y-3">
                                        {cart.map(item => (
                                            <div key={item.user_id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-800">{item.nombre}</h4>
                                                    <p className="text-sm text-gray-600">Bs {item.precio.toFixed(2)} c/u</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-semibold">
                                                        x{item.cantidad}
                                                    </span>
                                                    <span className="font-bold text-green-600">
                                                        Bs {(item.precio * item.cantidad).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t-2 border-green-500">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xl font-bold text-gray-800">Total:</span>
                                            <span className="text-2xl font-bold text-green-600 bg-green-100 px-4 py-2 rounded-lg">
                                                Bs {cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mensaje informativo */}
                            <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                                <div className="flex">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-400 mr-2 mt-0.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm text-blue-700">
                                            <strong>¿Todo correcto?</strong> Revisa tu pedido antes de enviarlo. 
                                            Se abrirá WhatsApp para completar tu compra con nosotros.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Botones de acción */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowConfirmOrder(false);
                                        setShowCart(true);
                                    }}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                    </svg>
                                    Editar cesta
                                </button>
                                <button
                                    onClick={confirmAndSendWhatsapp}
                                    disabled={!customerData.nombre && !usuario?.nombre}
                                    className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                    </svg>
                                    Enviar por WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}