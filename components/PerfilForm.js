"use client";
import { useState, useEffect } from 'react';
import { supabase } from "../lib/SupabaseClient";

export default function PerfilForm({ userId, perfilActual, onSave }) {
  const [nombre, setNombre] = useState("");
  const [nitCi, setNitCi] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [perfilExiste, setPerfilExiste] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    // Usar perfilActual si está disponible
    if (perfilActual) {
      setNombre(perfilActual.nombre || "");
      setNitCi(perfilActual.nit_ci || "");
      setPerfilExiste(true);
    } else {
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
            setPerfilExiste(true);
          } else {
            setPerfilExiste(false);
          }
        });
    }
  }, [userId, perfilActual]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    try {
      let result;
      
      if (perfilExiste) {
        // Actualizar perfil existente
        result = await supabase
          .from("perfiles")
          .update({
            nombre: nombre.trim(),
            nit_ci: nitCi.trim(),
          })
          .eq("id", userId);
      } else {
        // Crear nuevo perfil
        result = await supabase
          .from("perfiles")
          .insert({
            id: userId,
            nombre: nombre.trim(),
            nit_ci: nitCi.trim(),
            rol: 'usuario' // Rol por defecto
          });
        setPerfilExiste(true);
      }
      
      if (result.error) {
        console.error('Error de Supabase:', result.error);
        setMessage("Error al guardar: " + result.error.message);
      } else {
        setMessage("✅ Datos guardados correctamente");
        if (onSave) onSave();
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error('Error general:', error);
      setMessage("Error inesperado: " + error.message);
    }
    
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg text-center text-sm ${
          message.includes('Error') 
            ? 'bg-red-50 border border-red-200 text-red-800' 
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          {message}
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre Completo *
          </label>
          <input
            type="text"
            placeholder="Ej: Juan Pérez García"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            NIT/CI *
          </label>
          <input
            type="text"
            placeholder="Ej: 8845863"
            value={nitCi}
            onChange={e => setNitCi(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || !nombre.trim() || !nitCi.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Guardando...
            </div>
          ) : (
            perfilExiste ? "Actualizar Datos" : "Crear Perfil"
          )}
        </button>
      </div>
    </form>
  );
}
