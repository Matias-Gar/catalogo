export default function ImageManager({
  prodId,
  images,
  editData,
  handleAddImages,
  handleRemoveImage,
  handleReplaceImage,
  handleReorderImages,
}) {
  const onDragStart = (index) =>
    handleReorderImages(prodId, { type: "START", index });

  const onDragOver = (e) => e.preventDefault();

  const onDrop = (index) =>
    handleReorderImages(prodId, { type: "DROP", index });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-4">
        {images?.map((imgObj, idx) => (
          <div
            key={imgObj.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(idx)}
            className="relative border rounded-lg overflow-hidden"
          >
            <img
              src={imgObj.imagen_url}
              alt="Producto"
              className="w-full h-28 object-cover"
            />

            <div className="absolute top-1 right-1 flex gap-1">
              <label className="bg-yellow-400 text-white px-2 py-1 text-xs rounded cursor-pointer">
                Reemplazar
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleReplaceImage(prodId, imgObj, e)}
                />
              </label>

              <button
                className="bg-red-500 text-white px-2 py-1 text-xs rounded"
                onClick={() => handleRemoveImage(prodId, imgObj)}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {editData.newImages?.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {editData.newImages.map((file, index) => (
            <div key={index} className="border rounded-lg overflow-hidden">
              <img
                src={URL.createObjectURL(file)}
                className="w-full h-28 object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <label className="block cursor-pointer border border-dashed border-indigo-500 text-indigo-500 text-center py-3 rounded-lg font-medium">
        + Añadir imágenes
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleAddImages(prodId, e)}
        />
      </label>
    </div>
  );
}
