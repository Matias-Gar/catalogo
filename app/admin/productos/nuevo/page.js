
"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import { supabase } from "../../../../lib/SupabaseClient";
import { v4 as uuidv4 } from 'uuid';

const Barcode = dynamic(() => import('react-barcode'), { ssr: false });

function generateBarcode() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

const uploadProductImages = async (files) => {
  if (!files || files.length === 0) return [];
  const BUCKET_NAME = 'product_images';
  const urls = [];
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

export default function NuevoProducto() {
  const [productosSesion, setProductosSesion] = useState([]);
  const [imagenesProductos, setImagenesProductos] = useState({});
  const [categories, setCategories] = useState([]);
  const [newProduct, setNewProduct] = useState({ nombre: '', descripcion: '', precio: '', stock: '', category_id: '', codigo_barra: '' });
  const [imageFiles, setImageFiles] = useState([]);
  const [message, setMessage] = useState('');
  const newImageInputRef = useRef(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedImageList, setSelectedImageList] = useState([]);
  const [selectedImageName, setSelectedImageName] = useState('');

  useEffect(() => {
    fetchCategories();
    return () => {
      setProductosSesion([]);
      setImagenesProductos({});
    };
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, categori')
      .order('categori', { ascending: true });
    if (!error) setCategories(data || []);
  };

  const handleNewProductChange = (e) => {
    setNewProduct({ ...newProduct, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(prev => [...prev, ...files]);
  };

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % selectedImageList.length);
  };
  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + selectedImageList.length) % selectedImageList.length);
  };
  const openImageModal = (list, index, name) => {
    setSelectedImageList(list);
    setSelectedImageIndex(index);
    setSelectedImageName(name);
    setIsImageModalOpen(true);
  };

  const handleAñadirProducto = async (e) => {
    e.preventDefault();
    setMessage('');
    let imagenUrls = [];
    try {
      if (imageFiles && imageFiles.length > 0) {
        imagenUrls = await uploadProductImages(imageFiles);
      }
      const categoryIdValue = newProduct.category_id ? parseInt(newProduct.category_id) : null;
      const codigoBarra = newProduct.codigo_barra || generateBarcode();
      // Simular inserción: crear objeto producto local
      const productoLocal = {
        user_id: uuidv4(),
        nombre: newProduct.nombre,
        descripcion: newProduct.descripcion,
        precio: newProduct.precio,
        stock: newProduct.stock,
        category_id: categoryIdValue,
        codigo_barra: codigoBarra,
        categorias: categories.find(c => c.id === categoryIdValue) ? { categori: categories.find(c => c.id === categoryIdValue).categori } : null
      };
      setProductosSesion(prev => [...prev, productoLocal]);
      if (imagenUrls.length > 0) {
        setImagenesProductos(prev => ({ ...prev, [productoLocal.user_id]: imagenUrls }));
      }
      setMessage('✅ Producto añadido a la sesión.');
      setNewProduct({ nombre: '', descripcion: '', precio: '', stock: '', category_id: '', codigo_barra: '' });
      setImageFiles([]);
      if (newImageInputRef.current) newImageInputRef.current.value = '';
    } catch (e) {
      setMessage(`❌ Error al añadir: ${e.message}`);
    }
  };

  // Render
  return (
    <div className="p-4 sm:p-6 md:p-10 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-extrabold mb-8 text-gray-900">Panel de Administración de Productos (Sesión)</h1>
      {message && (
        <div className={`p-4 mb-6 rounded-lg font-medium shadow-md ${message.startsWith('❌') ? 'bg-red-100 text-red-900' : 'bg-green-100 text-green-900'}`}>{message}</div>
      )}
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg mb-10 border-t-4 border-gray-900">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b pb-3">Añadir Nuevo Artículo</h2>
        <form onSubmit={handleAñadirProducto} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input type="text" name="nombre" placeholder="Nombre del Producto" value={newProduct.nombre} onChange={handleNewProductChange} required className="w-full p-3 border border-gray-700 rounded-lg focus:ring-gray-900 focus:border-gray-900 text-gray-900 placeholder-gray-700 font-semibold bg-white" />
            <input type="number" name="precio" placeholder="Precio (Bs)" value={newProduct.precio} onChange={handleNewProductChange} required step="0.01" className="w-full p-3 border border-gray-700 rounded-lg focus:ring-gray-900 focus:border-gray-900 text-gray-900 placeholder-gray-700 font-semibold bg-white" />
            <input type="number" name="stock" placeholder="Stock (Cantidad)" value={newProduct.stock} onChange={handleNewProductChange} required className="w-full p-3 border border-gray-700 rounded-lg focus:ring-gray-900 focus:border-gray-900 text-gray-900 placeholder-gray-700 font-semibold bg-white" />
            <select name="category_id" value={newProduct.category_id} onChange={handleNewProductChange} className="w-full p-3 border border-gray-700 rounded-lg focus:ring-gray-900 focus:border-gray-900 bg-white text-gray-900">
              <option value="">-- Seleccionar Categoría --</option>
              {categories && categories.length > 0 && categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.categori}</option>
              ))}
            </select>
          </div>
          <textarea name="descripcion" placeholder="Descripción del Producto" value={newProduct.descripcion} onChange={handleNewProductChange} rows={3} className="w-full p-3 border border-gray-700 rounded-lg focus:ring-gray-900 focus:border-gray-900 text-gray-900 placeholder-gray-700 font-semibold bg-white" />
          <input type="text" name="codigo_barra" placeholder="Código de Barra (Opcional - Se genera si está vacío)" value={newProduct.codigo_barra} onChange={handleNewProductChange} className="w-full p-3 border border-gray-700 rounded-lg focus:ring-gray-900 focus:border-gray-900 text-gray-900 placeholder-gray-700 font-semibold bg-white" maxLength={13} />
          <div>
            <label className="block mb-1 font-semibold text-gray-900">Imágenes del Producto</label>
            <label className="inline-block px-4 py-2 bg-gray-900 text-white font-semibold rounded cursor-pointer hover:bg-gray-800 transition">
              Seleccionar archivos
              <input type="file" multiple ref={newImageInputRef} onChange={handleImageChange} className="hidden" />
            </label>
            {imageFiles.length > 0 && <span className="text-sm text-gray-900 mt-1 ml-2 align-middle">{imageFiles.length} archivo(s) listo(s) para subir.</span>}
          </div>
          <button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-lg text-lg flex items-center justify-center gap-2 mt-4">🛒 Añadir Producto</button>
        </form>
      </div>
      {/* Tabla de productos añadidos en la sesión */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b pb-3">Catálogo Actual (Solo Sesión)</h2>
        {productosSesion.length === 0 ? (
          <div className="text-gray-700 text-center">No hay productos añadidos en esta sesión.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base bg-white rounded-xl shadow-xl border border-gray-700 text-center">
              <thead>
                <tr className="bg-gray-200 text-gray-900">
                  <th className="p-2 text-center">ID PRODUCTO (USER_ID)</th>
                  <th className="p-2 text-center">IMAGEN</th>
                  <th className="p-2 text-center">CÓDIGO DE BARRA</th>
                  <th className="p-2 text-left">NOMBRE</th>
                  <th className="p-2 text-center">CATEGORÍA</th>
                  <th className="p-2 text-center">PRECIO (Bs)</th>
                  <th className="p-2 text-center">STOCK</th>
                </tr>
              </thead>
              <tbody>
                {productosSesion.map(prod => (
                  <tr key={prod.user_id} className="border-b border-gray-300 last:border-b-0">
                    <td className="p-2 text-gray-900 text-center">{prod.user_id.slice(0, 6) + '...'}</td>
                    <td className="p-2 text-center">
                      <div className="flex gap-1 justify-center">
                        {(imagenesProductos[prod.user_id] || []).map((url, idx) => (
                          <img key={url} src={url} alt="img" className="h-10 w-10 object-cover rounded cursor-pointer border" onClick={() => openImageModal(imagenesProductos[prod.user_id], idx, prod.nombre)} />
                        ))}
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      {prod.codigo_barra && <Barcode value={prod.codigo_barra} width={1.5} height={40} fontSize={14} />}
                    </td>
                    <td className="p-2 text-left font-bold text-gray-900">{prod.nombre}</td>
                    <td className="p-2 text-center text-gray-900">{prod.categorias?.categori || 'Sin Categoría'}</td>
                    <td className="p-2 text-gray-900 font-bold text-center">Bs {Number(prod.precio).toFixed(2)}</td>
                    <td className="p-2 text-center text-gray-900">{prod.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Modal de Vista Previa de Imagen */}
      {isImageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-2 sm:p-4 z-[999]" onClick={() => setIsImageModalOpen(false)}>
          <div className="relative w-full h-full max-w-screen-2xl max-h-[95vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsImageModalOpen(false)} className="absolute top-4 right-4 text-white text-4xl font-extrabold z-50 opacity-75 hover:opacity-100 transition" aria-label="Cerrar vista previa">&times;</button>
            <img src={selectedImageList[selectedImageIndex]} alt={`Vista previa de ${selectedImageName}`} className="max-w-full max-h-full object-scale-down rounded-lg shadow-2xl" />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-center p-2 rounded-b-lg text-sm opacity-80">{selectedImageName} ({selectedImageIndex + 1} / {selectedImageList.length})</div>
            {selectedImageList.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70">&#8592;</button>
                <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70">&#8594;</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
