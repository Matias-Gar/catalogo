    "use client";
    // Función para imprimir el código de barras
        const handlePrintBarcode = (codigo, nombre) => {
            const printWindow = window.open('', '_blank', 'width=400,height=250');
            if (!printWindow) return;
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Imprimir Código de Barras</title>
                        <style>
                            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                            .barcode-label { font-family: Arial, sans-serif; text-align: center; }
                            .barcode-label span { display: block; margin-top: 8px; font-size: 16px; }
                        </style>
                    </head>
                    <body>
                        <div class="barcode-label">
                            <div id="barcode"></div>
                            <span>${nombre || ''}</span>
                            <span>${codigo}</span>
                        </div>
                        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                        <script>
                            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                            svg.setAttribute('id', 'barcode-svg');
                            document.getElementById('barcode').appendChild(svg);
                            JsBarcode(svg, '${codigo}', { width: 2, height: 60, displayValue: true, fontSize: 18, margin: 0 });
                            setTimeout(function() { window.print(); window.close(); }, 500);
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        };
import dynamic from 'next/dynamic';
// import { useEffect, useState, useRef } from 'react';
// import { supabase } from "../../../lib/SupabaseClient";
// import { useRouter } from "next/navigation";
// import Link from 'next/link';
// import { v4 as uuidv4 } from 'uuid';
const Barcode = dynamic(() => import('react-barcode'), { ssr: false });
// Generador de código de barras EAN13 simple
function generateBarcode() {
    // Genera un número de 12 dígitos, el 13 lo calcula el lector
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}
import { useEffect, useState, useRef } from 'react';
import { supabase } from "../../../lib/SupabaseClient";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';

// --------------------------------------------------------------------------
// COMPONENTE 1: Modal de Vista Previa de Imagen (IMAGEN COMPLETA)
// --------------------------------------------------------------------------
function ImagePreviewModal({ isOpen, onClose, imageList, imageIndex, productName, onPrev, onNext }) {
    if (!isOpen || !imageList || imageList.length === 0) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-2 sm:p-4 z-[999]" onClick={onClose}>
            <div className="relative w-full h-full max-w-screen-2xl max-h-[95vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white text-4xl font-extrabold z-50 opacity-75 hover:opacity-100 transition"
                    aria-label="Cerrar vista previa"
                >
                    &times;
                </button>
                <img
                    src={imageList[imageIndex]}
                    alt={`Vista previa de ${productName}`}
                    className="max-w-full max-h-full object-scale-down rounded-lg shadow-2xl"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-center p-2 rounded-b-lg text-sm opacity-80">
                    {productName} ({imageIndex + 1} / {imageList.length})
                </div>
                {imageList.length > 1 && (
                    <>
                        <button onClick={onPrev} className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70">&#8592;</button>
                        <button onClick={onNext} className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70">&#8594;</button>
                    </>
                )}
            </div>
        </div>
    );
}

// --------------------------------------------------------------------------
// COMPONENTE 2: Modal de Confirmación de Eliminación
function DeleteConfirmationModal({ isOpen, onClose, onConfirm, productName }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-sm p-6 rounded-xl shadow-2xl">
                <h3 className="text-xl font-bold mb-4 text-red-700">Confirmar Eliminación</h3>
                <p className="text-gray-700 mb-6">¿Estás seguro de que quieres eliminar el producto <b>{productName}</b>? Esta acción no se puede deshacer.</p>
                <div className="flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                        Sí, Eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------- 
// Lógica para subir la imagen a Supabase Storage (¡REVISAR RLS DE STORAGE!)
// -------------------------------------------------------------------------- 
const uploadProductImages = async (files) => {
    if (!files || files.length === 0) return [];
    const BUCKET_NAME = 'product_images';
    const urls = [];
    const { data: { user } = {} } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';
    for (const file of files) {
        const fileExtension = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;
        const filePath = `${userId}/${fileName}`;
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });
        if (uploadError) {
            throw new Error(`Error al subir imagen a storage (Bucket: ${BUCKET_NAME}): ${uploadError.message}`);
        }
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);
        urls.push(publicUrlData.publicUrl);
    }
    return urls;
};

// -------------------------------------------------------------------------- 
// COMPONENTE PRINCIPAL
// -------------------------------------------------------------------------- 
export default function AdminProductosPage() { 
    const router = useRouter(); 
    const [userRole, setUserRole] = useState('admin'); 
    const [productos, setProductos] = useState([]);
    // Estado para imágenes de productos: { [producto_id]: [urls] }
    const [imagenesProductos, setImagenesProductos] = useState({});
    const newImageInputRef = useRef(null); 
    const [showDeleteModal, setShowDeleteModal] = useState(false); 
    const [productToDelete, setProductToDelete] = useState(null); 
    const [categories, setCategories] = useState([]); 

    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [selectedImageList, setSelectedImageList] = useState([]);
    const [selectedImageName, setSelectedImageName] = useState('');
    
    const [newProduct, setNewProduct] = useState({ 
        nombre: '', 
        descripcion: '', 
        precio: '', 
        stock: '', 
        category_id: '',
        codigo_barra: ''
    }); 

    const [editingProduct, setEditingProduct] = useState(null); 
    const [editImageFiles, setEditImageFiles] = useState([]); 
    const [editImageList, setEditImageList] = useState([]); // URLs actuales
    const [imageFiles, setImageFiles] = useState([]); // Para alta
    const [loading, setLoading] = useState(false); 
    const [message, setMessage] = useState(''); 
    const [isDeleting, setIsDeleting] = useState(false); 

    // Funciones de Manejo de Estado y UI 
    // Modal para galería de imágenes
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

    const handleNewProductChange = (e) => { 
    setNewProduct({ ...newProduct, [e.target.name]: e.target.value }); 
    }; 
    
    const handleEditProductChange = (e) => { 
        setEditingProduct({ ...editingProduct, [e.target.name]: e.target.value }); 
    }; 

    const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(prev => [...prev, ...files]);
    };

    const handleEditImageChange = (e) => {
    setEditImageFiles(prev => [...prev, ...Array.from(e.target.files)]);
    };

    // Eliminar imagen existente de la lista local (no borra de storage hasta guardar)
    const handleRemoveEditImage = (url) => {
        setEditImageList(editImageList.filter(img => img !== url));
    };

    const closeEditModal = () => { 
        setEditingProduct(null); 
        setEditImageFiles([]); 
        setEditImageList([]); 
        setMessage(''); 
    }; 

    const openEditModal = (producto) => {
        setEditingProduct(producto);
        setEditImageFiles([]);
        setEditImageList(imagenesProductos[producto.user_id] || []);
        setMessage('');
    };
    
    // -------------------------------------------------------------------------- 
    // FUNCIONES DE SUPABASE 
    // -------------------------------------------------------------------------- 

    // Función para cargar categorías 
    const fetchCategories = async () => {
        const { data, error } = await supabase
            .from('categorias')
            .select('id, categori')
            .order('categori', { ascending: true });
        if (error) {
            setCategories([]);
            setMessage('❌ Error al cargar categorías.');
            return;
        }
        setCategories(data || []);
    }

    // Función para cargar productos y sus imágenes
    const fetchProductos = async () => {
        if (userRole !== 'admin') {
            return;
        }
        setLoading(true);
        // 1. Traer productos
        const { data, error } = await supabase
            .from('productos')
            .select(`
                user_id,
                nombre,
                descripcion,
                precio,
                stock,
                imagen_url,
                category_id,
                codigo_barra,
                categorias (categori)
            `)
            .order('nombre', { ascending: true });

        if (error) {
            setMessage(`❌ Error al cargar productos: ${error.message || JSON.stringify(error)}.`);
            console.error("Error en fetchProductos:", error);
            setLoading(false);
            return;
        }
        const formattedData = data.map(p => ({
            ...p,
            category_name: p.categorias ? p.categorias.categori : 'Sin Categoría'
        }));
        setProductos(formattedData);

        // 2. Traer imágenes de todos los productos
        const ids = formattedData.map(p => p.user_id);
        if (ids.length > 0) {
            const { data: imgs, error: imgsError } = await supabase
                .from('producto_imagenes')
                .select('producto_id, imagen_url')
                .in('producto_id', ids);
            if (!imgsError && imgs) {
                // Agrupar por producto_id
                const agrupadas = {};
                imgs.forEach(img => {
                    if (!agrupadas[img.producto_id]) agrupadas[img.producto_id] = [];
                    agrupadas[img.producto_id].push(img.imagen_url);
                });
                setImagenesProductos(agrupadas);
            }
        } else {
            setImagenesProductos({});
        }
        setLoading(false);
    };
    
    // Función para Añadir Producto (CORREGIDA: Soluciona "invalid input syntax for type bigint")
    const handleAñadirProducto = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);
        let imagenUrls = [];
        try {
            // Subir imágenes ANTES de insertar en la tabla
            if (imageFiles && imageFiles.length > 0) {
                imagenUrls = await uploadProductImages(imageFiles);
            }
            const categoryIdValue = newProduct.category_id ? parseInt(newProduct.category_id) : null;
            // Generar código de barras automáticamente si no se proporciona
            const codigoBarra = newProduct.codigo_barra || generateBarcode();
            const { data: productoInsertado, error: insertError } = await supabase
                .from('productos')
                .insert([
                    {
                        nombre: newProduct.nombre,
                        descripcion: newProduct.descripcion,
                        precio: parseFloat(newProduct.precio) || 0,
                        stock: parseInt(newProduct.stock) || 0,
                        category_id: categoryIdValue,
                        codigo_barra: codigoBarra
                    }
                ]).select();
            if (insertError) {
                throw new Error(insertError.message);
            }
            // Insertar las imágenes en la tabla producto_imagenes
            if (productoInsertado && productoInsertado.length > 0 && imagenUrls.length > 0) {
                const productoId = productoInsertado[0].user_id;
                const imagesToInsert = imagenUrls.map(url => ({ producto_id: productoId, imagen_url: url }));
                const { error: imgInsertError } = await supabase.from('producto_imagenes').insert(imagesToInsert);
                if (imgInsertError) {
                    throw new Error(imgInsertError.message);
                }
            }
            setMessage('✅ Producto creado con éxito!');
            setNewProduct({ nombre: '', descripcion: '', precio: '', stock: '', category_id: '', codigo_barra: '' });
            setImageFiles([]);
            if (newImageInputRef.current) {
                newImageInputRef.current.value = '';
            }
            fetchProductos();
        } catch (e) {
            console.error("Error crítico al crear producto:", e);
            setMessage(`❌ Error crítico al crear: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDelete = async (producto) => { 
        setProductToDelete(producto); 
        setShowDeleteModal(true); 
    }; 

    const confirmDelete = async () => { 
        if (!productToDelete) return; 

        setShowDeleteModal(false); 
        setIsDeleting(true); 
        setMessage(''); 

        try { 
            const { error } = await supabase 
                .from('productos') 
                .delete() 
                // Usamos user_id como ID único del producto para filtrar
                .eq('user_id', productToDelete.user_id); 

            if (error) { 
                throw new Error(error.message); 
            } 

            setMessage(`✅ Producto "${productToDelete.nombre}" eliminado con éxito.`); 
            fetchProductos(); 
        } catch (e) { 
            setMessage(`❌ Error al eliminar: ${e.message}`); 
        } finally { 
            setIsDeleting(false); 
            setProductToDelete(null); 
        } 
    }; 
    
    const handleGuardarEdicion = async (e) => {
        e.preventDefault();
        if (!editingProduct) return;

        setMessage('');
        setLoading(true);
        try {
            // 1. Subir nuevas imágenes si hay
            let nuevasUrls = [];
            if (editImageFiles && editImageFiles.length > 0) {
                nuevasUrls = await uploadProductImages(editImageFiles);
            }
            // 2. Actualizar producto (sin tocar imagen_url principal)
            const categoryIdValue = editingProduct.category_id ? parseInt(editingProduct.category_id) : null;
            const { error: updateError } = await supabase
                .from('productos')
                .update({
                    nombre: editingProduct.nombre,
                    descripcion: editingProduct.descripcion,
                    precio: parseFloat(editingProduct.precio) || 0,
                    stock: parseInt(editingProduct.stock) || 0,
                    category_id: categoryIdValue,
                })
                .eq('user_id', editingProduct.user_id);
            if (updateError) {
                throw new Error(updateError.message);
            }
            // 3. Eliminar imágenes quitadas (de la tabla, no del storage)
            const originales = imagenesProductos[editingProduct.user_id] || [];
            const aEliminar = originales.filter(url => !editImageList.includes(url));
            if (aEliminar.length > 0) {
                await supabase.from('producto_imagenes')
                    .delete()
                    .in('imagen_url', aEliminar)
                    .eq('producto_id', editingProduct.user_id);
            }
            // 4. Insertar nuevas imágenes
            if (nuevasUrls.length > 0) {
                const imagesToInsert = nuevasUrls.map(url => ({ producto_id: editingProduct.user_id, imagen_url: url }));
                const { error: imgInsertError } = await supabase.from('producto_imagenes').insert(imagesToInsert);
                if (imgInsertError) {
                    throw new Error(imgInsertError.message);
                }
            }
            setMessage(`✅ Producto "${editingProduct.nombre}" actualizado con éxito.`);
            closeEditModal();
            fetchProductos();
        } catch (e) {
            setMessage(`❌ Error al actualizar: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // -------------------------------------------------------------------------- 
    // EFECTOS Y RENDERIZADO 
    // -------------------------------------------------------------------------- 
    useEffect(() => { 
        fetchCategories(); 
        fetchProductos(); 
        
        // Listener de tiempo real 
        const channel = supabase 
            .channel('productos-channel') 
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
    }, []); // eslint-disable-line react-hooks/exhaustive-deps 

    if (userRole !== 'admin') { 
        return <div className="p-10 text-center text-xl">Acceso Denegado.</div>; 
    } 

    return ( 
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10"> 
            <header className="flex justify-between items-center mb-10 border-b pb-4"> 
                <h1 className="text-4xl font-extrabold text-gray-900">Administración de Productos</h1> 
                <Link
                    href="/"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition"
                > 
                    🏠 Ir a la Tienda 
                </Link> 
            </header> 

            {/* Sección de Mensajes (Éxito/Error) */} 
            {message && ( 
                <div className={`p-4 mb-6 rounded-lg font-medium shadow-md ${message.startsWith('❌') 
                    ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}> 
                    {message} 
                </div> 
            )} 

            {/* 1. Formulario de Añadir Producto */} 
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg mb-10 border-t-4 border-indigo-500"> 
                <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-3">Añadir Nuevo Artículo</h2> 
                <form onSubmit={handleAñadirProducto} className="space-y-6"> 
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> 
                        <input 
                            type="text" 
                            name="nombre" 
                            placeholder="Nombre del Producto" 
                            value={newProduct.nombre} 
                            onChange={handleNewProductChange} 
                            required 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-700 font-semibold bg-white" 
                        /> 
                        <input 
                            type="number" 
                            name="precio" 
                            placeholder="Precio (Bs)" 
                            value={newProduct.precio} 
                            onChange={handleNewProductChange} 
                            required 
                            step="0.01" 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-700 font-semibold bg-white" 
                        /> 
                        <input 
                            type="number" 
                            name="stock" 
                            placeholder="Stock (Cantidad)" 
                            value={newProduct.stock} 
                            onChange={handleNewProductChange} 
                            required 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-700 font-semibold bg-white" 
                        /> 
                        
                        {/* Selección de Categoría */} 
                        <select
                            name="category_id"
                            value={newProduct.category_id}
                            onChange={handleNewProductChange}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                        >
                            <option value="">-- Seleccionar Categoría --</option>
                            {categories && categories.length > 0 && categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.categori}</option>
                            ))}
                        </select>
                    </div> 
                    <textarea 
                        name="descripcion" 
                        placeholder="Descripción del Producto" 
                        value={newProduct.descripcion} 
                        onChange={handleNewProductChange} 
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 h-24 text-gray-900 placeholder-gray-700 font-semibold bg-white" 
                    /> 
                    
                    {/* Campo de Subida de Imagen */} 
                    <div className="flex flex-col">
                        <label className="text-gray-700 font-medium mb-2">Imágenes del Producto</label>
                        <div className="flex items-center space-x-4">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageChange}
                                ref={newImageInputRef}
                                className="hidden"
                                id="new-product-image"
                            />
                            <label
                                htmlFor="new-product-image"
                                className="px-4 py-2 bg-indigo-500 text-white rounded-lg shadow-md hover:bg-indigo-600 transition cursor-pointer"
                            >
                                Seleccionar archivos
                            </label>
                            <span className="text-gray-500">
                                {imageFiles && imageFiles.length > 0 ? `${imageFiles.length} archivo(s) seleccionado(s)` : 'Ningún archivo seleccionado'}
                            </span>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading} 
                        className={`w-full py-3 font-bold text-white rounded-lg transition ${ 
                            loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-lg' 
                        }`} 
                    > 
                        {loading ? 'Añadiendo...' : '🛒 Añadir Producto'} 
                    </button> 
                </form> 
            </div> 
            
            {/* 2. Catálogo Actual (Tabla) */} 
            <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-3">Catálogo Actual</h2> 
            
            {loading && productos.length === 0 && <p className="text-center text-gray-600">Cargando catálogo...</p>} 
            
            {productos.length > 0 ? ( 
                                <div className="overflow-x-auto bg-white rounded-xl shadow-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-white">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-white">ID Producto (user_id)</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-white">Imagen</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-white">Código de Barra</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-white">Nombre</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-white">Categoría</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-white">Precio (Bs)</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-white">Stock</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-white">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200 text-gray-900">
                                            {productos.map((producto) => {
                                                const isNumericBarcode = /^[0-9]{12,13}$/.test(producto.codigo_barra || '');
                                                return (
                                                    <tr key={producto.user_id} className="hover:bg-gray-50 transition duration-150">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{producto.user_id}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            <div className="flex space-x-1">
                                                                {(imagenesProductos[producto.user_id]?.length > 0
                                                                    ? imagenesProductos[producto.user_id]
                                                                    : ["https://placehold.co/50x50/374151/FFFFFF?text=No"]
                                                                ).map((img, idx, arr) => (
                                                                    <img
                                                                        key={img}
                                                                        src={img}
                                                                        alt={producto.nombre}
                                                                        className="h-12 w-12 object-cover rounded-md cursor-pointer hover:shadow-lg transition border"
                                                                        onClick={() => openImageModal(arr, idx, producto.nombre)}
                                                                        onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/50x50/374151/FFFFFF?text=No"; }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                                                            {producto.codigo_barra ? (
                                                                                                <div className="flex flex-col items-center">
                                                                                                    {isNumericBarcode ? (
                                                                                                        <Barcode value={producto.codigo_barra} width={1.5} height={40} displayValue={true} fontSize={14} margin={0} />
                                                                                                    ) : null}
                                                                                                    <span className="text-xs text-gray-700 mt-1 font-mono">{producto.codigo_barra}</span>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="mt-1 px-2 py-1 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-700 transition"
                                                                                                        onClick={() => handlePrintBarcode(producto.codigo_barra, producto.nombre)}
                                                                                                    >
                                                                                                        Imprimir
                                                                                                    </button>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <span className="text-gray-400">Sin código</span>
                                                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{producto.nombre}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{producto.category_name}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold">{producto.precio ? producto.precio.toFixed(2) : '0.00'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{producto.stock}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                            <button
                                                                onClick={() => openEditModal(producto)}
                                                                className="text-indigo-600 hover:text-indigo-900 transition duration-150"
                                                            >
                                                                ✏️ Editar
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(producto)}
                                                                disabled={isDeleting}
                                                                className="text-red-600 hover:text-red-900 transition duration-150 disabled:opacity-50"
                                                            >
                                                                {isDeleting && productToDelete?.user_id === producto.user_id ? 'Eliminando...' : '🗑️ Eliminar'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
            ) : ( 
                !loading && <p className="text-center text-gray-600">No hay productos en el catálogo.</p> 
            )} 

            {/* 3. Modal de Edición */} 
            {editingProduct && ( 
                                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-40">
                                    <div className="bg-white w-full max-w-lg p-6 rounded-xl shadow-2xl">
                                        <h3 className="text-2xl font-bold mb-6 text-indigo-700">Editar Producto: {editingProduct.nombre}</h3>
                                        {editingProduct.codigo_barra && (
                                                                    <div className="flex flex-col items-center mb-4">
                                                                        {/^[0-9]{12,13}$/.test(editingProduct.codigo_barra) ? (
                                                                            <Barcode value={editingProduct.codigo_barra} width={1.5} height={40} displayValue={true} fontSize={14} margin={0} />
                                                                        ) : null}
                                                                        <span className="text-xs text-gray-700 mt-1 font-mono">{editingProduct.codigo_barra}</span>
                                                                        <button
                                                                            type="button"
                                                                            className="mt-1 px-2 py-1 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-700 transition"
                                                                            onClick={() => handlePrintBarcode(editingProduct.codigo_barra, editingProduct.nombre)}
                                                                        >
                                                                            Imprimir
                                                                        </button>
                                                                    </div>
                                        )}
                                                <form onSubmit={handleGuardarEdicion} className="space-y-4"> 
                            <input 
                                type="text" 
                                name="nombre" 
                                value={editingProduct.nombre} 
                                onChange={handleEditProductChange} 
                                required 
                                className="w-full p-3 border rounded-lg" 
                            />
                            <textarea 
                                name="descripcion" 
                                value={editingProduct.descripcion || ''} 
                                onChange={handleEditProductChange} 
                                className="w-full p-3 border rounded-lg h-20" 
                            />
                            <div className="grid grid-cols-2 gap-4"> 
                                <input 
                                    type="number" 
                                    name="precio" 
                                    placeholder="Precio (Bs)" 
                                    value={editingProduct.precio} 
                                    onChange={handleEditProductChange} 
                                    required 
                                    step="0.01" 
                                    className="w-full p-3 border rounded-lg" 
                                /> 
                                <input 
                                    type="number" 
                                    name="stock" 
                                    placeholder="Stock" 
                                    value={editingProduct.stock} 
                                    onChange={handleEditProductChange} 
                                    required 
                                    className="w-full p-3 border rounded-lg" 
                                /> 
                            </div> 

                            {/* Selección de Categoría en Edición */} 
                            <select 
                                name="category_id" 
                                value={editingProduct.category_id || ''} 
                                onChange={handleEditProductChange} 
                                className="w-full p-3 border rounded-lg" 
                            > 
                                <option value="">-- Sin Categoría --</option> 
                                {categories.map(cat => ( 
                                    <option key={cat.id} value={cat.id}>{cat.categori}</option> 
                                ))} 
                            </select> 
                            
                            {/* Edición de Imágenes */}
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Imágenes actuales</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {editImageList.length > 0 ? editImageList.map((img, idx) => (
                                        <div key={img} className="relative group">
                                            <img src={img} alt="img" className="h-16 w-16 object-cover rounded-md border" />
                                            <button type="button" onClick={() => handleRemoveEditImage(img)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-80 group-hover:opacity-100">&times;</button>
                                        </div>
                                    )) : <span className="text-gray-400">Sin imágenes</span>}
                                </div>
                                <label className="block text-gray-700 font-medium mb-2">Agregar nuevas imágenes</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleEditImageChange}
                                    className="w-full p-1"
                                />
                                {editImageFiles.length > 0 && (
                                    <div className="text-xs text-gray-500 mt-1">{editImageFiles.length} archivo(s) seleccionado(s)</div>
                                )}
                            </div>

                            <div className="flex justify-end space-x-4 pt-4"> 
                                <button 
                                    type="button" 
                                    onClick={closeEditModal} 
                                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition" 
                                > 
                                    Cancelar 
                                </button> 
                                <button 
                                    type="submit" 
                                    disabled={loading} 
                                    className={`px-4 py-2 text-white rounded-lg transition ${ 
                                        loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700' 
                                    }`} 
                                > 
                                    {loading ? 'Guardando...' : '💾 Guardar Cambios'} 
                                </button> 
                            </div> 
                        </form> 
                    </div> 
                </div> 
            )} 

            {/* 4. Modal de Confirmación de Eliminación */} 
            <DeleteConfirmationModal 
                isOpen={showDeleteModal} 
                onClose={() => setShowDeleteModal(false)} 
                onConfirm={confirmDelete} 
                productName={productToDelete?.nombre || 'este producto'} 
            />

            {/* 5. Modal de Vista Previa de Imagen */}
            <ImagePreviewModal
                isOpen={isImageModalOpen}
                onClose={closeImageModal}
                imageList={selectedImageList}
                imageIndex={selectedImageIndex}
                productName={selectedImageName}
                onPrev={prevImage}
                onNext={nextImage}
            />
        </div> 
    ); 
}