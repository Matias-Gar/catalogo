'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/SupabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState('');
  const [updating, setUpdating] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const router = useRouter();

  // Estados para el formulario
  const [nombre, setNombre] = useState("");
  const [nitCi, setNitCi] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    const getUser = async () => {
      try {
        // 1. Verificar que el usuario esté autenticado
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          console.log('❌ No hay sesión válida, redirigiendo...');
          router.push('/login');
          return;
        }

        const currentUser = session.user;
        setUser(currentUser);

        // 2. SEGURIDAD: Solo permitir acceso a SU PROPIO perfil
        const { data: perfilData, error: perfilError } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (perfilError && perfilError.code !== 'PGRST116') {
          console.error('❌ Error cargando perfil:', perfilError);
        }

        // 3. Establecer datos seguros
        const finalPerfil = perfilData || {
          id: currentUser.id,
          email: currentUser.email,
          nombre: '',
          telefono: '',
          nit_ci: '',
          rol: 'cliente',
          foto_perfil: null,
          bio: ''
        };
        
        setPerfil(finalPerfil);
        
        // Cargar datos en el formulario
        setNombre(finalPerfil.nombre || '');
        setNitCi(finalPerfil.nit_ci || '');
        setTelefono(finalPerfil.telefono || '');
        setFotoPerfil(finalPerfil.foto_perfil || '');
        setBio(finalPerfil.bio || '');
        
        setAuthorized(true);
        
      } catch (error) {
        console.error('❌ Error de autorización:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    
    getUser();
  }, [router]);

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
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
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
    setUpdating(true);
    setMessage("");
    
    try {
      // Verificar si el perfil existe
      const { data: perfilExistente, error: errorCheck } = await supabase
        .from("perfiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      
      const datosActualizar = {
        nombre: nombre.trim(),
        nit_ci: nitCi.trim(),
        telefono: telefono.trim(),
        foto_perfil: fotoPerfil || null,
        bio: bio.trim()
      };
      
      let result;
      if (perfilExistente) {
        // ACTUALIZAR perfil existente
        result = await supabase
          .from("perfiles")
          .update(datosActualizar)
          .eq("id", user.id)
          .select();
      } else {
        // CREAR nuevo perfil
        result = await supabase
          .from("perfiles")
          .insert({
            id: user.id,
            ...datosActualizar,
            rol: 'cliente'
          })
          .select();
      }
      
      if (result.error) {
        setMessage("❌ Error: " + result.error.message);
      } else {
        setMessage("✅ Perfil guardado correctamente");
        // Actualizar el estado del perfil
        setPerfil(prev => ({ ...prev, ...datosActualizar }));
        setEditando(false);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage("❌ Error inesperado: " + error.message);
    }
    
    setUpdating(false);
  };

  // SEGURIDAD: Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  // SEGURIDAD: Bloquear acceso no autorizado
  if (!user || !authorized) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center p-8">
          <div className="text-red-600 text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">No tienes permisos para acceder a esta página.</p>
          <button 
            onClick={() => router.push('/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-full p-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mi Perfil</h1>
            <p className="text-blue-100">
              {editando ? "Editando información personal" : "Información personal"}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-center font-medium ${
          message.includes('❌') 
            ? 'bg-red-50 border border-red-200 text-red-700' 
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border p-6">
        {!editando ? (
          // MODO VISUALIZACIÓN
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Mi Información Personal
              </h2>
              <button
                onClick={() => setEditando(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar Perfil
              </button>
            </div>

            {/* Información actual del perfil */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Foto de perfil */}
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Foto de Perfil</h3>
                {perfil?.foto_perfil ? (
                  <img 
                    src={perfil.foto_perfil} 
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
                <p className="text-sm text-gray-500 mt-2">
                  {perfil?.foto_perfil ? "Foto actual" : "Sin foto de perfil"}
                </p>
              </div>

              {/* Información personal */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                    {perfil?.nombre || "No especificado"}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NIT/CI
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                    {perfil?.nit_ci || "No especificado"}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                    {user?.email || "No especificado"}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    El email se gestiona desde la configuración de cuenta
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                    {perfil?.telefono || "No especificado"}
                  </div>
                </div>
              </div>
            </div>

            {/* Biografía */}
            {perfil?.bio && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biografía
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                  {perfil.bio}
                </div>
              </div>
            )}
          </div>
        ) : (
          // MODO EDICIÓN
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editando Mi Perfil
              </h2>
              <button
                onClick={() => setEditando(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancelar
              </button>
            </div>
            
            {/* Formulario de edición */}
            <div className="space-y-6">
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      placeholder="Ej: 70123456"
                      value={telefono}
                      onChange={e => setTelefono(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      NIT/CI *
                    </label>
                    <input
                      type="text"
                      placeholder="Número de identificación"
                      value={nitCi}
                      onChange={e => setNitCi(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Biografía
                    </label>
                    <textarea
                      placeholder="Cuéntanos algo sobre ti..."
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      rows="4"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>
                </div>
                
                <div className="text-center">
                  <button
                    type="submit"
                    disabled={updating || !nombre.trim() || !nitCi.trim() || !telefono.trim()}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
                  >
                    {updating ? "Guardando..." : "💾 Editar Perfil"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}