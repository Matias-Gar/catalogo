"use client";
import { useState, useEffect } from 'react';
import { supabase } from "../lib/SupabaseClient";

export default function PerfilForm({ userId, onSave }) {
  const [nombre, setNombre] = useState("");
  const [nitCi, setNitCi] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!userId) return;
    // Cargar datos actuales del perfil
    supabase
      .from("perfiles")
      .select("nombre, nit_ci")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setNombre(data.nombre || "");
          setNitCi(data.nit_ci || "");
        }
      });
  }, [userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    // Upsert perfil
    const { error } = await supabase.from("perfiles").upsert({
      id: userId,
      nombre,
      nit_ci: nitCi,
    });
    if (error) {
      setMessage("Error al guardar: " + error.message);
    } else {
      setMessage("Datos guardados correctamente.");
      if (onSave) onSave();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md mx-auto bg-white p-6 rounded-xl shadow-xl mt-8">
      <h2 className="text-2xl font-bold mb-2 text-gray-800">Mi Perfil</h2>
      {message && <div className="p-2 rounded text-center text-sm bg-green-100 text-green-700">{message}</div>}
      <input
        type="text"
        placeholder="Nombre completo"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
        required
      />
      <input
        type="text"
        placeholder="NIT o CI"
        value={nitCi}
        onChange={e => setNitCi(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-700 text-white font-semibold py-3 rounded-lg hover:bg-green-800 transition disabled:bg-gray-400"
      >
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
