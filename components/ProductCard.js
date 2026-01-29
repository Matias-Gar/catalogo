import ImageManager from "@/components/ImageManager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ProductCard({
  prod,
  categories,
  editData,
  setEditDataField,
  handleAddImages,
  handleRemoveImage,
  handleReplaceImage,
  handleReorderImages,
  openConfirm,
}) {
  const imagesArr = editData.reordered ?? editData.originalImages ?? [];
  const firstImage = imagesArr.length > 0 ? imagesArr[0].imagen_url : "";

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
      {firstImage && (
        <div className="flex justify-center">
          <img
            src={firstImage}
            alt={prod.nombre}
            className="w-36 h-36 object-cover rounded-lg border"
          />
        </div>
      )}

      <ImageManager
        prodId={prod.user_id}
        images={imagesArr}
        editData={editData}
        handleAddImages={handleAddImages}
        handleRemoveImage={handleRemoveImage}
        handleReplaceImage={handleReplaceImage}
        handleReorderImages={handleReorderImages}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Nombre */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Nombre</label>
          <Input
            value={editData.nombre ?? prod.nombre}
            onChange={(e) =>
              setEditDataField(prod.user_id, "nombre", e.target.value)
            }
          />
        </div>

        {/* Descripción */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Descripción</label>
          <Input
            value={editData.descripcion ?? prod.descripcion}
            onChange={(e) =>
              setEditDataField(prod.user_id, "descripcion", e.target.value)
            }
          />
        </div>

        {/* Código de barra */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Código de barra</label>
          <Input
            value={editData.codigo_barra ?? prod.codigo_barra}
            onChange={(e) =>
              setEditDataField(prod.user_id, "codigo_barra", e.target.value)
            }
          />
        </div>

        {/* Categoría */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Categoría</label>
          <select
            value={editData.category_id ?? prod.category_id ?? ""}
            onChange={(e) =>
              setEditDataField(prod.user_id, "category_id", e.target.value)
            }
            className="p-3 border-indigo-500 rounded-lg"
          >
            <option value="">-- Seleccionar Categoría --</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.categori}
              </option>
            ))}
          </select>
        </div>

        {/* Precio */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Precio</label>
          <Input
            type="number"
            value={editData.precio ?? prod.precio}
            onChange={(e) =>
              setEditDataField(prod.user_id, "precio", e.target.value)
            }
          />
        </div>

        {/* Stock */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Stock</label>
          <Input
            type="number"
            value={editData.stock ?? prod.stock}
            onChange={(e) =>
              setEditDataField(prod.user_id, "stock", e.target.value)
            }
          />
        </div>
      </div>

      {/* Botón Guardar */}
      <div className="flex justify-center mt-6">
        <Button
          onClick={() => openConfirm(prod.user_id)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
        >
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
