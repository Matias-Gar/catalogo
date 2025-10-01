
"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/SupabaseClient";


export default function AdminCategorias() {
  const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [editando, setEditando] = useState(null); // id de la categoría en edición
  const [nombreEdit, setNombreEdit] = useState("");

  // Cargar categorías
  useEffect(() => {
    fetchCategorias();
  }, []);

  async function fetchCategorias() {
    const { data, error } = await supabase.from("categorias").select("*");
    if (!error) setCategorias(data);
  }

  // Insertar nueva categoría
  async function handleAgregar(e) {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;
    const { error } = await supabase.from("categorias").insert({ categori: nuevaCategoria });
    if (!error) {
      setNuevaCategoria("");
      fetchCategorias();
    }
  }

  // Eliminar categoría
  async function handleEliminar(id) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (!error) fetchCategorias();
  }

  // Guardar edición
  async function handleGuardarEdit(id) {
    if (!nombreEdit.trim()) return;
    const { error } = await supabase.from("categorias").update({ categori: nombreEdit }).eq("id", id);
    if (!error) {
      setEditando(null);
      setNombreEdit("");
      fetchCategorias();
    }
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-start py-8 px-2">
      {/* Sección de agregar */}
      <section className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-xl p-6 mb-8 border border-gray-700">
        <h1 className="text-2xl font-bold mb-4 text-gray-100">Agregar Categoría</h1>
        <form onSubmit={handleAgregar} className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 border border-gray-700 bg-gray-900 text-gray-100 rounded px-3 py-2 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/30"
            placeholder="Nueva categoría"
            value={nuevaCategoria}
            onChange={e => setNuevaCategoria(e.target.value)}
          />
          <button type="submit" className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded font-bold shadow">Agregar</button>
        </form>
      </section>

      {/* Sección de listado */}
      <section className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-gray-100">Lista de Categorías</h2>
        <ul className="space-y-2">
          {categorias.map(cat => (
            <li key={cat.id} className="flex items-center gap-2 bg-gray-900 rounded shadow p-2 border border-gray-700">
              {editando === cat.id ? (
                <>
                  <input
                    className="border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 flex-1 focus:border-blue-500 focus:ring focus:ring-blue-500/30"
                    value={nombreEdit}
                    onChange={e => setNombreEdit(e.target.value)}
                  />
                  <button className="bg-blue-700 hover:bg-blue-800 text-white px-2 py-1 rounded shadow" onClick={() => handleGuardarEdit(cat.id)}>Guardar</button>
                  <button className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded shadow" onClick={() => setEditando(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-gray-100">{cat.categori}</span>
                  <button className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded shadow" onClick={() => { setEditando(cat.id); setNombreEdit(cat.categori); }}>Editar</button>
                  <button className="bg-red-700 hover:bg-red-800 text-white px-2 py-1 rounded shadow" onClick={() => handleEliminar(cat.id)}>Eliminar</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}