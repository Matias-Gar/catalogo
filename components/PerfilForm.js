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
  const [perfilExiste, setPerfilExiste] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    // Usar perfilActual si está disponible
    if (perfilActual) {
      setNombre(perfilActual.nombre || "");
      setNitCi(perfilActual.nit_ci || "");
      setFotoPerfil(perfilActual.foto_perfil || "");
      setPerfilExiste(true);
    } else {
      // Cargar datos actuales del perfil
      supabase
        .from("perfiles")
        .select("nombre, nit_ci, foto_perfil")
        .eq("id", userId)
        .single()
        .then(({ data, error }) => {
          if (data) {
            setNombre(data.nombre || "");
            setNitCi(data.nit_ci || "");
            setFotoPerfil(data.foto_perfil || "");
            setPerfilExiste(true);
          } else {
            setPerfilExiste(false);
          }
        });
    }
  }, [userId, perfilActual]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      setMessage("❌ Por favor selecciona solo archivos de imagen");
      return;
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage("❌ La imagen debe ser menor a 2MB");
      return;
    }

    setUploadingFoto(true);
    setMessage("");

    try {
      // Crear nombre único para el archivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      // Subir archivo a Supabase Storage
      const { data, error } = await supabase.storage
        .from('perfiles')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('perfiles')
        .getPublicUrl(fileName);

      setFotoPerfil(publicUrl);
      setMessage("✅ Foto subida correctamente");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error('Error subiendo foto:', error);
      setMessage("❌ Error al subir la foto: " + error.message);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    try {
      let result;
      
      if (perfilExiste) {
        // Actualizar perfil existente (sin rol)
        result = await supabase
          .from("perfiles")
          .update({
            nombre: nombre.trim(),
            nit_ci: nitCi.trim(),
            foto_perfil: fotoPerfil
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
            foto_perfil: fotoPerfil,
            rol: 'usuario' // Rol por defecto
          });
        setPerfilExiste(true);
      }
      
      if (result.error) {
        console.error('Error de Supabase:', result.error);
        setMessage("❌ Error al guardar: " + result.error.message);
      } else {
        setMessage("✅ Perfil actualizado correctamente");
        if (onSave) onSave();
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error('Error general:', error);
      setMessage("❌ Error inesperado: " + error.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg text-center text-sm ${
          message.includes('❌') 
            ? 'bg-red-50 border border-red-200 text-red-800' 
            : 'bg-green-50 border border-green-200 text-green-800'
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
        
        <div className="relative">
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
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {uploadingFoto ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Subiendo...
              </div>
            ) : (
              fotoPerfil ? "Cambiar Foto" : "Subir Foto"
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Máximo 2MB. Formatos: JPG, PNG, GIF</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </div>
            ) : (
              perfilExiste ? "Actualizar Perfil" : "Crear Perfil"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
