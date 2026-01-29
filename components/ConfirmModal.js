export default function ConfirmModal({ visible, onCancel, onConfirm, message }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-11/12 max-w-md text-center">
        <p className="text-lg font-semibold">{message}</p>
        <div className="flex justify-around mt-4">
          <button
            className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            onClick={onConfirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
