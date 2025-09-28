"use client";
import { useEffect, useState, useRef } from 'react';
import { supabase } from "../../../lib/SupabaseClient";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
// --------------------------------------------------------------------------
// COMPONENTE 1: Modal de Vista Previa de Imagen (IMAGEN COMPLETA) - VERSIÓN FINAL Y REFORZADA
// --------------------------------------------------------------------------
function ImagePreviewModal({ isOpen, onClose, imageUrl, productName }) {
    // Si no está abierto, no renderiza nada. También verifica si la URL es válida.
    if (!isOpen || !imageUrl || imageUrl.includes('placehold.co')) return null;

    return (
        // Contenedor de fondo oscuro (z-[999] para máxima prioridad)
        <div 
            className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-2 sm:p-4 z-[999]" 
            onClick={onClose} // Cierra al hacer clic en el fondo
        >
            
            {/* Contenedor principal: Ocupa el MÁXIMO de la ventana */}
            <div 
                // Añadimos max-w-screen-2xl para darle un tamaño GIGANTE
                className="relative w-full h-full max-w-screen-2xl max-h-[95vh] flex flex-col items-center justify-center" 
                onClick={e => e.stopPropagation()} // Evita que el clic dentro cierre el modal
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white text-4xl font-extrabold z-50 opacity-75 hover:opacity-100 transition"
                    aria-label="Cerrar vista previa"
                >
                    &times;
                </button>
                
                {/* LA IMAGEN: max-w-full y max-h-full para que se ajuste al 100% de su contenedor.
                  Hemos cambiado object-contain por object-scale-down para una prueba de compatibilidad.
                */}
                <img
                    src={imageUrl}
                    alt={`Vista previa de ${productName}`}
                    className="max-w-full max-h-full object-scale-down rounded-lg shadow-2xl" 
                />
                
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-center p-2 rounded-b-lg text-sm opacity-80">
                    {productName}
                </div>
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
                <p className="text-gray-700 mb-6">¿Estás seguro de que quieres eliminar el producto **{productName}**? Esta acción no se puede deshacer.</p> 
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
// Lógica para subir la imagen a Supabase Storage 
const uploadProductImage = async (file) => { 
    if (!file) return null; 

    const BUCKET_NAME = 'product_images'; 
    
    const fileExtension = file.name.split('.').pop(); 
    const fileName = `${uuidv4()}.${fileExtension}`; 
    const filePath = fileName; 

    // 1. Subir el archivo 
    const { error: uploadError } = await supabase.storage 
        .from(BUCKET_NAME) 
        .upload(filePath, file, { 
            cacheControl: '3600', 
            upsert: false, 
        }); 

    if (uploadError) { 
        throw new Error(`Error al subir imagen a storage (Bucket: ${BUCKET_NAME}): ${uploadError.message}`); 
    } 

    // 2. Obtener la URL pública del archivo
    const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME) 
        .getPublicUrl(filePath); 
        
    console.log("✅ URL Pública de la Imagen Generada:", publicUrlData.publicUrl); 

    return publicUrlData.publicUrl; 
}; 
// -------------------------------------------------------------------------- 
 
export default function AdminProductosPage() { 
    const router = useRouter(); 
    const [userRole, setUserRole] = useState('admin'); 
    const [productos, setProductos] = useState([]);
    const newImageInputRef = useRef(null); 
    const [showDeleteModal, setShowDeleteModal] = useState(false); 
    const [productToDelete, setProductToDelete] = useState(null); 
    const [categories, setCategories] = useState([]); 

    // **ESTADOS PARA LA VISTA PREVIA DE IMAGEN**
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState('');
    const [selectedImageName, setSelectedImageName] = useState('');
    // ------------------------------------------------
    
    // ESTADO PARA NUEVO PRODUCTO 
    const [newProduct, setNewProduct] = useState({ 
        nombre: '', 
        descripcion: '', 
        precio: '', 
        stock: '', 
        category_id: '', 
    }); 

    // ESTADO PARA EDICIÓN 
    const [editingProduct, setEditingProduct] = useState(null); 
    const [editImageFile, setEditImageFile] = useState(null); 
    const [imageFile, setImageFile] = useState(null); 
    const [loading, setLoading] = useState(false); 
    const [message, setMessage] = useState(''); 
    const [isDeleting, setIsDeleting] = useState(false); 

    // Funciones de Manejo de Estado y UI 

    // **FUNCIONES PARA EL MODAL DE IMAGEN**
    const openImageModal = (url, name) => {
        setSelectedImageUrl(url);
        setSelectedImageName(name);
        setIsImageModalOpen(true);
    };

    const closeImageModal = () => {
        setIsImageModalOpen(false);
        setSelectedImageUrl('');
        setSelectedImageName('');
    };
    // -------------------------------------------

    const handleNewProductChange = (e) => { 
        setNewProduct({ ...newProduct, [e.target.name]: e.target.value }); 
    }; 
    
    const handleEditProductChange = (e) => { 
        setEditingProduct({ ...editingProduct, [e.target.name]: e.target.value }); 
    }; 

    const handleImageChange = (e) => { 
        setImageFile(e.target.files[0]); 
    }; 

    const handleEditImageChange = (e) => { 
        setEditImageFile(e.target.files[0]); 
    }; 

    const closeEditModal = () => { 
        setEditingProduct(null); 
        setEditImageFile(null); 
        setMessage(''); 
    }; 

    const openEditModal = (producto) => { 
        setEditingProduct(producto); 
        setMessage(''); 
    }; 
    
    // --------------------------------------------------------------------------
    // FUNCIONES DE SUPABASE (CON CORRECCIÓN DE ERROR DEL SELECT)
    // -------------------------------------------------------------------------- 

    // Función para cargar categorías 
    const fetchCategories = async () => { 
        const { data, error } = await supabase 
            .from('categorias')
            .select('id, nombre')
            .order('nombre', { ascending: true }); 
        
        if (error) { 
            console.error("Error al cargar categorías:", error); 
            return; 
        } 
        setCategories(data); 
    } 

    // Función para cargar productos (CORREGIDA SIN COMENTARIO DENTRO DE SELECT)
    const fetchProductos = async () => { 
        if (userRole !== 'admin') { 
            return; 
        } 
        setLoading(true); 
        
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
                categorias (nombre) 
            `) 
            .order('nombre', { ascending: true }); 

        if (error) { 
            setMessage(`❌ Error al cargar productos (RLS/Relación faltante?): ${error.message}.`); 
            console.error("Error en fetchProductos:", error); 
        } else { 
            const formattedData = data.map(p => ({ 
                ...p, 
                category_name: p.categorias ? p.categorias.nombre : 'Sin Categoría' 
            })); 
            setProductos(formattedData); 
        } 
        setLoading(false); 
    }; 
    
    const handleAñadirProducto = async (e) => { 
        e.preventDefault(); 
        setMessage(''); 
        setLoading(true); 
        let imagenUrl = null; 

        try { 
            if (imageFile) { 
                imagenUrl = await uploadProductImage(imageFile); 
            } 

            const categoryIdValue = newProduct.category_id ? parseInt(newProduct.category_id) : null; 

            const { error: insertError } = await supabase.from('productos').insert([ 
                { 
                    nombre: newProduct.nombre, 
                    descripcion: newProduct.descripcion, 
                    precio: parseFloat(newProduct.precio) || 0, 
                    stock: parseInt(newProduct.stock) || 0, 
                    category_id: categoryIdValue, 
                    imagen_url: imagenUrl
                } 
            ]); 

            if (insertError) { 
                throw new Error(insertError.message); 
            } 

            setMessage('✅ Producto creado con éxito!'); 
            setNewProduct({ nombre: '', descripcion: '', precio: '', stock: '', category_id: '' }); 
            setImageFile(null); 
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
        let imagenUrl = editingProduct.imagen_url; 

        try { 
            if (editImageFile) { 
                imagenUrl = await uploadProductImage(editImageFile); 
            } 
            
            const categoryIdValue = editingProduct.category_id ? parseInt(editingProduct.category_id) : null; 

            const { error: updateError } = await supabase 
                .from('productos') 
                .update({ 
                    nombre: editingProduct.nombre, 
                    descripcion: editingProduct.descripcion, 
                    precio: parseFloat(editingProduct.precio) || 0, 
                    stock: parseInt(editingProduct.stock) || 0, 
                    category_id: categoryIdValue, 
                    imagen_url: imagenUrl, 
                }) 
                .eq('user_id', editingProduct.user_id); 

            if (updateError) { 
                throw new Error(updateError.message); 
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
                    console.log('Cambio detectado:', payload); 
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
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                        /> 
                        <input 
                            type="number" 
                            name="precio" 
                            placeholder="Precio (Bs)" 
                            value={newProduct.precio} 
                            onChange={handleNewProductChange} 
                            required 
                            step="0.01" 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                        /> 
                        <input 
                            type="number" 
                            name="stock" 
                            placeholder="Stock (Cantidad)" 
                            value={newProduct.stock} 
                            onChange={handleNewProductChange} 
                            required 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                        /> 
                        
                        {/* Selección de Categoría */} 
                        <select 
                            name="category_id" 
                            value={newProduct.category_id} 
                            onChange={handleNewProductChange} 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                        > 
                            <option value="">-- Seleccionar Categoría --</option> 
                            {categories.map(cat => ( 
                                <option key={cat.id} value={cat.id}>{cat.nombre}</option> 
                            ))} 
                        </select> 
                    </div> 
                    <textarea 
                        name="descripcion" 
                        placeholder="Descripción del Producto" 
                        value={newProduct.descripcion} 
                        onChange={handleNewProductChange} 
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 h-24" 
                    /> 
                    
                    {/* Campo de Subida de Imagen */} 
                    <div className="flex flex-col"> 
                        <label className="text-gray-700 font-medium mb-2">Imagen del Producto</label> 
                        <div className="flex items-center space-x-4"> 
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleImageChange} 
                                ref={newImageInputRef} 
                                className="hidden" 
                                id="new-product-image" 
                            />
                            <label 
                                htmlFor="new-product-image" 
                                className="px-4 py-2 bg-indigo-500 text-white rounded-lg shadow-md hover:bg-indigo-600 transition cursor-pointer" 
                            > 
                                Seleccionar archivo 
                            </label> 
                            <span className="text-gray-500"> 
                                {imageFile ? imageFile.name : 'Ningún archivo seleccionado'} 
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
                        <thead> 
                            <tr> 
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID (User ID)</th> 
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagen</th> 
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th> 
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th> 
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio (Bs)</th> 
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th> 
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th> 
                            </tr> 
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200"> 
                            {productos.map((producto) => ( 
                                <tr key={producto.user_id} className="hover:bg-gray-50 transition duration-150"> 
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{producto.user_id}</td> 
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"> 
                                        {/* IMPLEMENTACIÓN DEL CLICK Y HOVER PARA VISTA COMPLETA */}
                                        <img 
                                            src={producto.imagen_url || "https://placehold.co/50x50/374151/FFFFFF?text=No"} 
                                            alt={producto.nombre} 
                                            className="h-12 w-12 object-cover rounded-md cursor-pointer hover:shadow-lg transition"
                                            onClick={() => openImageModal(producto.imagen_url, producto.nombre)} // <--- CLIC AGREGADO
                                            onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/50x50/374151/FFFFFF?text=No"; }}
                                        /> 
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
                            ))} 
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
                                    <option key={cat.id} value={cat.id}>{cat.nombre}</option> 
                                ))} 
                            </select> 
                            
                            {/* Edición de Imagen */} 
                            <div> 
                                <label className="block text-gray-700 font-medium mb-2">Cambiar Imagen</label> 
                                <div className="flex items-center space-x-4"> 
                                    <img 
                                        src={editImageFile ? URL.createObjectURL(editImageFile) : editingProduct.imagen_url || "https://placehold.co/60x60/374151/FFFFFF?text=Actual"} 
                                        alt="Imagen actual" 
                                        className="h-16 w-16 object-cover rounded-md border" 
                                    /> 
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={handleEditImageChange} 
                                        className="w-full p-1" 
                                    /> 
                                </div> 
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

            {/* 5. Modal de Vista Previa de Imagen (funcionalidad solicitada) */}
            <ImagePreviewModal
                isOpen={isImageModalOpen}
                onClose={closeImageModal}
                imageUrl={selectedImageUrl}
                productName={selectedImageName}
            />
        </div> 
    ); 
}