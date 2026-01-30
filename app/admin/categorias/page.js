"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/SupabaseClient";
import { showToast } from "../../../components/ui/Toast";

export default function AdminCategorias() {
  const router = useRouter();

  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [editando, setEditando] = useState(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchCategorias();
    fetchProductos();
  }, []);

  async function fetchCategorias() {
    const { data, error } = await supabase.from("categorias").select("*");
    if (error) {
      showToast("Error al cargar categorías", "error");
    } else {
      setCategorias(data || []);
    }
  }

  async function fetchProductos() {
    const { data, error } = await supabase.from("productos").select("*");
    if (error) {
      showToast("Error al cargar productos", "error");
    } else {
      setProductos(data || []);
    }
  }

  async function handleAgregar(e) {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;

    const { error } = await supabase
      .from("categorias")
      .insert({ categori: nuevaCategoria });

    if (error) {
      showToast("Error al agregar la categoría", "error");
    } else {
      setNuevaCategoria("");
      fetchCategorias();
      showToast("Categoría agregada con éxito");
    }
  }

  async function handleEliminar(id) {
    if (!confirm("¿Eliminar esta categoría?")) return;

    const { error } = await supabase.from("categorias").delete().eq("id", id);

    if (error) {
      showToast("Error al eliminar la categoría", "error");
    } else {
      fetchCategorias();
      showToast("Categoría eliminada");
    }
  }

  async function handleGuardarEdit(id) {
    if (!nombreEdit.trim()) return;

    const { error } = await supabase
      .from("categorias")
      .update({ categori: nombreEdit })
      .eq("id", id);

    if (error) {
      showToast("Error al guardar la categoría", "error");
    } else {
      setEditando(null);
      setNombreEdit("");
      fetchCategorias();
      showToast("Categoría actualizada");
    }
  }

  function openCatalogPage() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/admin/productos/catalogo`
        : "/admin/productos/catalogo";

    const win = typeof window !== "undefined" && window.open(url, "_blank");
    if (!win) router.push("/admin/productos/catalogo");
  }

  return (
    <div className="w-full min-h-screen flex">
      {/* SIDEBAR */}
      <aside
        className={`transition-all duration-200 ${
          sidebarOpen ? "w-64" : "w-14"
        } bg-gray-900 text-gray-100 min-h-screen p-3`}
      >
        <button
          className="p-2 mb-4"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰
        </button>

        {sidebarOpen && (
          <div className="text-xs text-gray-400 mb-4">
            Productos: {productos.length}
          </div>
        )}

        <button
          className="bg-yellow-700 hover:bg-yellow-800 p-2 rounded w-full"
          onClick={openCatalogPage}
        >
          {sidebarOpen ? "Generar Catálogo" : "Cat"}
        </button>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-6">
        <section className="max-w-4xl mx-auto bg-gray-800 p-6 rounded-xl">
          <h1 className="text-2xl font-bold mb-4 text-white">
            Agregar Categoría
          </h1>

          <form onSubmit={handleAgregar} className="flex gap-2 mb-6">
            <input
              className="flex-1 bg-gray-900 text-white px-3 py-2 rounded"
              placeholder="Nueva categoría"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
            />
            <button className="bg-green-700 px-4 py-2 rounded">
              Agregar
            </button>
          </form>

          <ul className="space-y-2">
            {categorias.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-2 bg-gray-900 p-2 rounded"
              >
                {editando === cat.id ? (
                  <>
                    <input
                      className="flex-1 bg-gray-800 text-white px-2 py-1 rounded"
                      value={nombreEdit}
                      onChange={(e) => setNombreEdit(e.target.value)}
                    />
                    <button
                      className="bg-blue-700 px-2 py-1 rounded"
                      onClick={() => handleGuardarEdit(cat.id)}
                    >
                      Guardar
                    </button>
                    <button
                      className="bg-gray-600 px-2 py-1 rounded"
                      onClick={() => setEditando(null)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{cat.categori}</span>
                    <button
                      onClick={() => {
                        setEditando(cat.id);
                        setNombreEdit(cat.categori);
                      }}
                    >
                      ✏️
                    </button>
                    <button onClick={() => handleEliminar(cat.id)}>❌</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
