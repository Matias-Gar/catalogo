"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/SupabaseClient";

export default function PerfilesAdminPage() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [perfiles, setPerfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        
        // Verificar si es admin
        const { data: perfilData } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        setUserProfile(perfilData);
        
        if (perfilData?.rol === 'administracion') {
          cargarPerfiles();
        }
      }
      setLoading(false);
    };
    getUser();
  }, []);

  const cargarPerfiles = async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('nombre');
    
    if (data) setPerfiles(data);
  };

  const cambiarRol = async (perfilId, nuevoRol) => {
    setProcesando(perfilId);
    const { error } = await supabase
      .from('perfiles')
      .update({ rol: nuevoRol })
      .eq('id', perfilId);

    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al cambiar rol: ' + error.message });
    } else {
      setMensaje({ tipo: 'success', texto: 'Rol actualizado correctamente' });
      cargarPerfiles();
    }
    setProcesando(null);
    setTimeout(() => setMensaje(null), 3000);
  };

  const resetearPassword = async (email) => {
    setProcesando(email);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al enviar email: ' + error.message });
    } else {
      setMensaje({ tipo: 'success', texto: `Email de recuperación enviado a ${email}` });
    }
    setProcesando(null);
    setTimeout(() => setMensaje(null), 5000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || userProfile?.rol !== 'administracion') {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center p-8">
          <div className="text-red-600 text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">Solo los administradores pueden acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-full p-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Administración de Perfiles</h1>
            <p className="text-purple-100">Gestiona usuarios, roles y contraseñas</p>
          </div>
        </div>
      </div>

      {/* Mensaje de estado */}
      {mensaje && (
        <div className={`p-4 rounded-lg mb-6 ${
          mensaje.tipo === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {mensaje.tipo === 'success' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {mensaje.texto}
          </div>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-600 rounded-full p-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{perfiles.length}</p>
              <p className="text-gray-600 text-sm">Total Usuarios</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 text-green-600 rounded-full p-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.018-4.018A9 9 0 1112.018 21 9 9 0 0120.018 12z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {perfiles.filter(p => p.rol === 'administracion').length}
              </p>
              <p className="text-gray-600 text-sm">Administradores</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 text-purple-600 rounded-full p-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {perfiles.filter(p => p.rol !== 'administracion').length}
              </p>
              <p className="text-gray-600 text-sm">Usuarios</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de perfiles */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Lista de Perfiles</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-gray-700">Usuario</th>
                <th className="text-left p-4 font-medium text-gray-700">Información</th>
                <th className="text-left p-4 font-medium text-gray-700">Rol</th>
                <th className="text-center p-4 font-medium text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {perfiles.map((perfil) => (
                <tr key={perfil.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-200 rounded-full p-2">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{perfil.nombre || 'Sin nombre'}</p>
                        <p className="text-sm text-gray-500">{perfil.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <p className="text-gray-600">NIT/CI: {perfil.nit_ci || 'No establecido'}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <select
                      value={perfil.rol || 'usuario'}
                      onChange={(e) => cambiarRol(perfil.id, e.target.value)}
                      disabled={procesando === perfil.id}
                      className="border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="usuario">Usuario</option>
                      <option value="administracion">Administración</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => resetearPassword(perfil.id)}
                        disabled={procesando === perfil.id}
                        className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                      >
                        {procesando === perfil.id ? 'Enviando...' : 'Reset Password'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-blue-800 text-sm">
            <p className="font-medium mb-1">Información importante:</p>
            <ul className="space-y-1 text-blue-700">
              <li>• Al resetear contraseña se enviará un email al usuario para que pueda crear una nueva</li>
              <li>• Solo administradores pueden cambiar roles y resetear contraseñas</li>
              <li>• Los cambios de rol son inmediatos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}