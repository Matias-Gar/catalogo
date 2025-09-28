// app/login/page.js
"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "../../lib/SupabaseClient";
import AuthForm from "../../components/AuthForm"; 

export default function LoginPage() {
  const [session, setSession] = useState(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const router = useRouter();

  // Función clave para verificar el rol y redirigir
  const checkUserRoleAndRedirect = async (userId) => {
      // Debes tener la tabla 'perfiles' creada en Supabase
      const { data: profile, error } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', userId)
          .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 es "no results found"
          console.error("Error al cargar perfil:", error.message);
      }
      
      if (profile?.rol === 'admin') {
          router.push('/admin'); // Redirigir al panel de administración
      } else {
          router.push('/'); // Redirigir al catálogo (cliente)
      }
  }

  useEffect(() => {
    // 1. Verificar sesión al cargar la página
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          checkUserRoleAndRedirect(session.user.id);
      } else {
          setIsLoadingRole(false);
      }
    });

    // 2. Escuchar cambios de autenticación (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
            checkUserRoleAndRedirect(session.user.id);
        } else {
            setIsLoadingRole(false);
        }
      }
    );

    return () => authListener?.subscription.unsubscribe();
  }, []);

  // Muestra un estado de carga mientras verifica si el usuario ya está logueado
  if (isLoadingRole || session) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
              <p className="text-xl text-gray-700">Verificando sesión...</p>
          </div>
      );
  }

  // Muestra el formulario si no hay sesión
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <AuthForm onLoginSuccess={checkUserRoleAndRedirect} /> 
    </div>
  );
}