"use client";
import { useState, useEffect } from 'react';
import { supabase } from "../lib/SupabaseClient";

export default function PerfilForm({ userId, perfilActual, onSave }) {
  const [nombre, setNombre] = useState("");
  const [nitCi, setNitCi] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!userId) return;
    
    // Cargar datos del perfil
    const cargarPerfil = async () => {
      try {
        if (perfilActual) {
          setNombre(perfilActual.nombre || "");
          setNitCi(perfilActual.nit_ci || "");
          setFotoPerfil(perfilActual.foto_perfil || "");
        } else {
          const { data, error } = await supabase
            .from("perfiles")
            .select("nombre, nit_ci, foto_perfil")
            .eq("id", userId)
            .single();
          
          if (error) {
            console.log('No se encontró perfil existente, se creará uno nuevo');
          } else if (data) {
            setNombre(data.nombre || "");
            setNitCi(data.nit_ci || "");
            setFotoPerfil(data.foto_perfil || "");
          }
        }
      } catch (error) {
        console.error('Error cargando perfil:', error);
      }
    };
    
    cargarPerfil();
  }, [userId, perfilActual]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage("❌ Solo se permiten archivos de imagen");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("❌ La imagen debe ser menor a 2MB");
      return;
    }

    setUploadingFoto(true);
    setMessage("");

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('perfiles')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('perfiles')
        .getPublicUrl(fileName);

      setFotoPerfil(publicUrl);
      setMessage("✅ Foto subida correctamente");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("❌ Error al subir foto: " + error.message);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    try {
      // Primero verificar si el perfil existe
      const { data: perfilExistente } = await supabase
        .from("perfiles")
        .select("id")
        .eq("id", userId)
        .single();
      
      let result;
      
      if (perfilExistente) {
        // ACTUALIZAR perfil existente
        result = await supabase
          .from("perfiles")
          .update({
            nombre: nombre.trim(),
            nit_ci: nitCi.trim(),
            foto_perfil: fotoPerfil
          })
          .eq("id", userId);
      } else {
        // CREAR nuevo perfil
        result = await supabase
          .from("perfiles")
          .insert({
            id: userId,
            nombre: nombre.trim(),
            nit_ci: nitCi.trim(),
            foto_perfil: fotoPerfil,
            rol: 'usuario'
          });
      }
      
      if (result.error) {
        console.error('Error de Supabase:', result.error);
        setMessage("❌ Error: " + (result.error.message || "Error desconocido"));
      } else {
        setMessage("✅ Perfil guardado correctamente");
        if (onSave) onSave();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error('Error inesperado:', error);
      setMessage("❌ Error inesperado: " + (error.message || "Error desconocido"));
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg text-center font-medium ${
          message.includes('❌') 
            ? 'bg-red-50 border border-red-200 text-red-700' 
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {message}
        </div>
      )}
      
      {/* Foto de perfil */}
      <div className="text-center">
        <div className="mb-4">
          {fotoPerfil ? (
            <img 
              src={fotoPerfil} 
              alt="Foto de perfil" 
              className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-blue-200 shadow-lg"
            />
          ) : (
            <div className="w-32 h-32 rounded-full mx-auto bg-gray-200 flex items-center justify-center border-4 border-gray-300">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
        
        <div className="relative inline-block">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploadingFoto}
          />
          <button
            type="button"
            disabled={uploadingFoto}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {uploadingFoto ? "Subiendo..." : fotoPerfil ? "Cambiar Foto" : "Subir Foto"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Máximo 2MB • JPG, PNG, GIF</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre Completo *
            </label>
            <input
              type="text"
              placeholder="Escribe tu nombre completo"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NIT/CI *
            </label>
            <input
              type="text"
              placeholder="Número de identificación"
              value={nitCi}
              onChange={e => setNitCi(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              required
            />
          </div>
        </div>
        
        <div className="text-center">
          <button
            type="submit"
            disabled={loading || !nombre.trim() || !nitCi.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
          >
            {loading ? "Guardando..." : "💾 Editar Perfil"}
          </button>
        </div>
      </form>
    </div>
  );
}
