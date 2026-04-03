import ImageManager from "@/components/ImageManager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ProductCard({
  prod,
  categories,
  editData,
  setEditDataField,
  onAddVariantRow,
  onVariantFieldChange,
  onRemoveVariantRow,
  handleAddImages,
  handleRemoveImage,
  handleReplaceImage,
  handleReorderImages,
  openConfirm,
}) {
  const imagesArr = editData.reordered ?? editData.originalImages ?? [];
  const variantsArr = editData.variantes ?? editData.originalVariants ?? [];
  const totalStockFromVariants = variantsArr.reduce(
    (sum, v) => sum + (parseInt(v?.stock ?? 0) || 0),
    0
  );
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
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Nombre</label>
          <Input
            value={editData.nombre ?? prod.nombre}
            onChange={(e) =>
              setEditDataField(prod.user_id, "nombre", e.target.value)
            }
          />
        </div>

        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Descripción</label>
          <Input
            value={editData.descripcion ?? prod.descripcion}
            onChange={(e) =>
              setEditDataField(prod.user_id, "descripcion", e.target.value)
            }
          />
        </div>

        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Código de barra</label>
          <Input
            value={editData.codigo_barra ?? prod.codigo_barra}
            onChange={(e) =>
              setEditDataField(prod.user_id, "codigo_barra", e.target.value)
            }
          />
        </div>

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

        <div className="flex flex-col">
          <label className="font-semibold text-gray-700">Stock</label>
          <Input
            type="number"
            value={variantsArr.length > 0 ? totalStockFromVariants : (editData.stock ?? prod.stock)}
            onChange={(e) =>
              setEditDataField(prod.user_id, "stock", e.target.value)
            }
            readOnly={variantsArr.length > 0}
          />
          {variantsArr.length > 0 && (
            <span className="text-xs text-gray-500 mt-1">Stock calculado desde colores</span>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Colores disponibles</h3>
          <Button
            type="button"
            onClick={() => onAddVariantRow(prod.user_id)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-sm"
          >
            + Agregar color
          </Button>
        </div>

        {variantsArr.length === 0 ? (
          <div className="text-sm text-gray-500">Sin colores. Agrega al menos uno.</div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-gray-600 mb-2 grid grid-cols-1 md:grid-cols-7 gap-2 px-2">
              <span>Color</span>
              <span>Stock</span>
              <span>Precio</span>
              <span>SKU</span>
              <span>Código</span>
              <span></span>
              <span></span>
            </div>
            {variantsArr.map((variant, idx) => (
              <div key={`${prod.user_id}-variant-${variant.id ?? idx}`} className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center">
                <Input
                  value={variant.color ?? ""}
                  onChange={(e) => onVariantFieldChange(prod.user_id, idx, "color", e.target.value)}
                  placeholder="Color"
                  className="text-sm"
                />
                <Input
                  type="number"
                  min="0"
                  value={variant.stock ?? 0}
                  onChange={(e) => onVariantFieldChange(prod.user_id, idx, "stock", e.target.value)}
                  placeholder="Stock"
                  className="text-sm"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={variant.precio ?? ""}
                  onChange={(e) => onVariantFieldChange(prod.user_id, idx, "precio", e.target.value)}
                  placeholder="Precio"
                  className="text-sm"
                />
                <Input
                  value={variant.sku ?? ""}
                  onChange={(e) => onVariantFieldChange(prod.user_id, idx, "sku", e.target.value)}
                  placeholder="SKU (opt)"
                  className="text-sm"
                />
                <Input
                  value={variant.codigo_barra ?? ""}
                  readOnly
                  placeholder="Código auto"
                  className="text-sm bg-gray-100"
                  title="Código de barras generado automáticamente"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (variant.codigo_barra) {
                      const event = new CustomEvent('printVariantBarcode', {
                        detail: { codigoBarras: variant.codigo_barra, nombre: `${prod.nombre} (${variant.color})` }
                      });
                      window.dispatchEvent(event);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-xs"
                  disabled={!variant.codigo_barra}
                  title="Imprimir código de barras"
                >
                  🖨️
                </Button>
                <Button
                  type="button"
                  onClick={() => onRemoveVariantRow(prod.user_id, idx)}
                  className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 text-xs"
                  disabled={variantsArr.length <= 1}
                >
                  -
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

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
