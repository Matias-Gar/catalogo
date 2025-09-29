"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import { supabase } from "../../../lib/SupabaseClient";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';

// Desactivar SSR para el componente de código de barras si usa librerías de cliente como 'react-barcode'
// Si la tabla usa react-barcode, este dynamic es necesario. Si solo usa la función handlePrintBarcode, se podría quitar.
// Lo mantendremos por si acaso el componente de tabla lo usa internamente.
const Barcode = dynamic(() => import('react-barcode'), { ssr: false });

// Generador de código de barras EAN13 simple
function generateBarcode() {
    // Genera un número de 12 dígitos, el 13 lo calcula el lector
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

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
// --------------------------------------------------------------------------
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
    // Usar un prefijo genérico para todos los usuarios (no requiere login para ver)
    const userId = 'public';
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
    // HOOKS AL INICIO
    const router = useRouter(); 
    const [userRole, setUserRole] = useState(null); 
    const [productos, setProductos] = useState([]);
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

    // --------------------------------------------------------------------------
    // FUNCIÓN DE IMPRESIÓN DE CÓDIGO DE BARRAS (Movida y Arreglada)
    // --------------------------------------------------------------------------
    const handlePrintBarcode = (codigo) => {
        if (!window._barcodeRefs) window._barcodeRefs = {};
        const ref = window._barcodeRefs[codigo];
        let svgString = '';
        if (ref && ref.current) {
            const svgNode = ref.current.querySelector ? ref.current.querySelector('svg') : null;
            if (svgNode) {
                const serializer = new window.XMLSerializer();
                svgString = serializer.serializeToString(svgNode);
            }
        }
        const printWindow = window.open('', '_blank', 'width=600,height=300');
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
                <head>
                    <title>Imprimir Código de Barras</title>
                    <style>
                        @media print {
                            body * { visibility: hidden !important; }
                            #barcode-print, #barcode-print * { visibility: visible !important; }
                            #barcode-print { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
                        }
                        body { display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 0; background: white; }
                        #barcode-print svg { width: 400px; height: 120px; display: block; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div id="barcode-print">
                        ${svgString}
                    </div>
                    <script>
                        setTimeout(function() { window.print(); window.close(); }, 200);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // useEffect de autenticación y rol
    useEffect(() => {
        const checkAuthAndRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                setUserRole('not_logged');
                return;
            }
            // Verificar el rol en la base de datos
            const { data: profile, error } = await supabase
                .from('perfiles')
                .select('rol')
                .eq('id', user.id)
                .single();
            if (error || !profile) {
                setUserRole('cliente');
                router.push('/');
                return;
            }
            if (profile.rol !== 'admin') {
                setUserRole(profile.rol);
                router.push('/');
                return;
            }
            setUserRole('admin');
        };
        checkAuthAndRole();
    }, [router]);

    // --- FUNCIONES ---
    
    const nextImage = () => {
        setSelectedImageIndex((prev) => (prev + 1) % selectedImageList.length);
    };
    const prevImage = () => {
        setSelectedImageIndex((prev) => (prev - 1 + selectedImageList.length) % selectedImageList.length);
    };

    // Función auxiliar que faltaba para abrir el modal de imagen
    const openImageModal = (list, index, name) => {
        setSelectedImageList(list);
        setSelectedImageIndex(index);
        setSelectedImageName(name);
        setIsImageModalOpen(true);
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

    // useEffect para cargar categorías y productos después de declarar las funciones
    useEffect(() => {
        // Solo cargar datos si el rol no se ha determinado o es admin
        if (userRole === 'admin' || userRole === null) {
            fetchCategories();
            fetchProductos();
        }
        
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
    }, [userRole]); // eslint-disable-line react-hooks/exhaustive-deps

    
    // Función para Añadir Producto
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

            // Usamos .select() para obtener el producto insertado y su user_id
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
                    // Nota: Idealmente, aquí también se debería intentar borrar los archivos subidos al storage.
                    throw new Error(`Error al insertar imágenes: ${imgInsertError.message}`);
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
            // La eliminación en cascada debería manejar las imágenes relacionadas
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
                    // Dejamos el codigo_barra para que no se re-genere si se guarda sin querer
                    codigo_barra: editingProduct.codigo_barra
                })
                .eq('user_id', editingProduct.user_id);
            if (updateError) {
                throw new Error(updateError.message);
            }

            // 3. Eliminar imágenes quitadas (de la tabla producto_imagenes)
            const originales = imagenesProductos[editingProduct.user_id] || [];
            // Comparamos las URLs originales con las que quedaron en editImageList
            const urlsAEliminar = originales.filter(url => !editImageList.includes(url));

            if (urlsAEliminar.length > 0) {
                // Eliminamos las referencias de la tabla producto_imagenes
                const { error: deleteImgError } = await supabase.from('producto_imagenes')
                    .delete()
                    .in('imagen_url', urlsAEliminar)
                    .eq('producto_id', editingProduct.user_id);
                
                if(deleteImgError) console.error("Error al eliminar referencias de imágenes:", deleteImgError.message);
                
                // NOTA: ELIMINAR del Storage es más complejo y no está implementado aquí,
                // ya que requeriría el path exacto del archivo, no solo la URL pública.
                // Esto es una mejora pendiente.
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
    
    // Si no es admin, no renderizar nada (o un mensaje de acceso denegado)
    if (userRole === 'not_logged') {
        return <div className="p-8 text-center text-xl text-gray-500">Redirigiendo a Login...</div>;
    }
    if (userRole !== 'admin') {
        return <div className="p-8 text-center text-xl text-red-500">Acceso Denegado. No tiene permisos de Administrador.</div>;
    }

    // Retorno del JSX del componente
    return (
        <div className="p-4 sm:p-6 md:p-10 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-extrabold mb-8 text-indigo-700">Panel de Administración de Productos</h1>
            
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
                    
                    {/* Campo de Código de Barras (Opcional) */}
                    <input 
                        type="text" 
                        name="codigo_barra" 
                        placeholder="Código de Barra (Opcional - Se genera si está vacío)" 
                        value={newProduct.codigo_barra} 
                        onChange={handleNewProductChange} 
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-700 font-semibold bg-white" 
                        maxLength={13}
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
                                const safe = (val) => (typeof val === 'string' || typeof val === 'number') ? val : JSON.stringify(val ?? '');
                                // Unificar lógica: usar imagenesProductos, luego imagen_url, luego placeholder
                                const imagenes = (imagenesProductos[producto.user_id]?.length > 0)
                                    ? imagenesProductos[producto.user_id]
                                    : (producto.imagen_url ? [producto.imagen_url] : ["https://placehold.co/300x200/cccccc/333333?text=Sin+Imagen"]);
                                return (
                                    <tr key={safe(producto.user_id)} className="hover:bg-gray-50 transition duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{String(safe(producto.user_id)).substring(0, 8) + '...'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex space-x-1">
                                                {imagenes.map((img, idx, arr) => {
                                                    if (typeof img !== 'string') return null;
                                                    return (
                                                        <img
                                                            key={safe(img)}
                                                            src={safe(img)}
                                                            alt={safe(producto.nombre)}
                                                            className="h-12 w-12 object-cover rounded-md cursor-pointer hover:shadow-lg transition border"
                                                            onClick={() => openImageModal(arr, idx, producto.nombre)}
                                                            onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/300x200/cccccc/333333?text=Sin+Imagen"; }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                                            <div className="flex flex-col items-center justify-center">
                                                <Barcode
                                                    value={safe(producto.codigo_barra)}
                                                    width={2}
                                                    height={60}
                                                    fontSize={18}
                                                    displayValue={false}
                                                />
                                                <button
                                                    onClick={() => {
                                                        // Selecciona el SVG del código de barras más cercano y lo imprime
                                                        const svg = event.target.closest('td').querySelector('svg');
                                                        if (!svg) return;
                                                        const svgString = new XMLSerializer().serializeToString(svg);
                                                        const printWindow = window.open('', '_blank', 'width=400,height=250');
                                                        if (!printWindow) return;
                                                        printWindow.document.write(`
                                                            <html>
                                                                <head>
                                                                    <title>Imprimir Código de Barras</title>
                                                                    <style>
                                                                        @media print {
                                                                            body * { visibility: hidden !important; }
                                                                            #barcode-print, #barcode-print * { visibility: visible !important; }
                                                                            #barcode-print { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
                                                                        }
                                                                        body { display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 0; background: white; }
                                                                        #barcode-print svg { width: 400px; height: 120px; display: block; margin: 0 auto; }
                                                                    </style>
                                                                </head>
                                                                <body>
                                                                    <div id="barcode-print">
                                                                        ${svgString}
                                                                    </div>
                                                                    <script>
                                                                        setTimeout(function() { window.print(); window.close(); }, 200);
                                                                    </script>
                                                                </body>
                                                            </html>
                                                        `);
                                                        printWindow.document.close();
                                                    }}
                                                    className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition text-base font-semibold"
                                                    title="Imprimir Código de Barra"
                                                >
                                                    🖨️ Imprimir
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{safe(producto.nombre)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{safe(producto.category_name)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Bs. {parseFloat(producto.precio).toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">{safe(producto.stock)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => openEditModal(producto)}
                                                    className="text-indigo-600 hover:text-indigo-900"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(producto)}
                                                    className="text-red-600 hover:text-red-900"
                                                    disabled={isDeleting}
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
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
            
            {/* Modal de Edición (Faltaba en tu código, lo agregué con la lógica base) */}
            {editingProduct && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white w-full max-w-2xl p-6 rounded-xl shadow-2xl my-10" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold mb-6 text-indigo-700 border-b pb-3">Editar Producto: {editingProduct.nombre}</h3>
                        <form onSubmit={handleGuardarEdicion} className="space-y-6">
                            {/* Campos de Edición (Iguales al de Añadir) */}
                            <input type="text" name="nombre" placeholder="Nombre" value={editingProduct.nombre} onChange={handleEditProductChange} required className="w-full p-3 border rounded-lg"/>
                            <textarea name="descripcion" placeholder="Descripción" value={editingProduct.descripcion} onChange={handleEditProductChange} className="w-full p-3 border rounded-lg h-20"/>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" name="precio" placeholder="Precio (Bs)" value={editingProduct.precio} onChange={handleEditProductChange} required step="0.01" className="w-full p-3 border rounded-lg"/>
                                <input type="number" name="stock" placeholder="Stock" value={editingProduct.stock} onChange={handleEditProductChange} required className="w-full p-3 border rounded-lg"/>
                                <select
                                    name="category_id"
                                    value={editingProduct.category_id}
                                    onChange={handleEditProductChange}
                                    className="w-full p-3 border rounded-lg bg-white"
                                >
                                    <option value="">-- Seleccionar Categoría --</option>
                                    {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.categori}</option>))}
                                </select>
                                <input 
                                    type="text" 
                                    name="codigo_barra" 
                                    placeholder="Código de Barra" 
                                    value={editingProduct.codigo_barra} 
                                    onChange={handleEditProductChange} 
                                    className="w-full p-3 border rounded-lg" 
                                    maxLength={13}
                                /> 
                            </div>
                            
                            {/* Imágenes Actuales (con opción a eliminar) */}
                            <div className="border p-3 rounded-lg">
                                <label className="block text-gray-700 font-medium mb-2">Imágenes Actuales (Click para eliminar)</label>
                                <div className="flex flex-wrap gap-2">
                                    {editImageList.map((url) => (
                                        <div key={url} className="relative group">
                                            <img 
                                                src={url} 
                                                alt="Imagen de producto" 
                                                className="h-16 w-16 object-cover rounded-md border cursor-pointer" 
                                                onClick={() => handleRemoveEditImage(url)}
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 rounded-md cursor-pointer" onClick={() => handleRemoveEditImage(url)}>
                                                <span className="text-white font-bold text-xl">&times;</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Añadir Nuevas Imágenes */}
                            <div className="flex flex-col">
                                <label className="text-gray-700 font-medium mb-2">Añadir más Imágenes</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleEditImageChange}
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                                />
                                {editImageFiles.length > 0 && <span className="text-sm text-gray-500 mt-1">{editImageFiles.length} nuevo(s) archivo(s) listo(s) para subir.</span>}
                            </div>
                            
                            <div className="flex justify-end space-x-4 pt-4">
                                <button type="button" onClick={closeEditModal} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition">Cancelar</button>
                                <button type="submit" disabled={loading} className={`px-4 py-2 font-bold text-white rounded-lg transition ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                    {loading ? 'Guardando...' : '💾 Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Modal de Confirmación de Eliminación */}
            <DeleteConfirmationModal 
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                productName={productToDelete?.nombre}
            />

            {/* Modal de Vista Previa de Imagen */}
            <ImagePreviewModal
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                imageList={selectedImageList}
                imageIndex={selectedImageIndex}
                productName={selectedImageName}
                onPrev={prevImage}
                onNext={nextImage}
            /> 
        </div> // Cierre del div principal
    ); // Cierre del return
} // Cierre de la función AdminProductosPage