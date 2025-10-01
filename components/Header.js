"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/SupabaseClient'; // Asegúrate que esta ruta es correcta

export default function Header() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null); // Nuevo estado para el rol

  useEffect(() => {
    // Función para obtener la sesión y el rol
    const fetchSessionAndRole = async (s) => {
      const currentSession = s || (await supabase.auth.getSession()).data.session;
      setSession(currentSession);

      if (currentSession) {
        // Si hay sesión, intentamos obtener el rol
        const { data: profile } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', currentSession.user.id)
          .single();
        
        setUserRole(profile?.rol || 'cliente');
      } else {
        setUserRole(null);
      }
    };

    fetchSessionAndRole(null);

    // Suscripción para escuchar los cambios de estado (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        // Si la sesión cambia, volvemos a obtener el rol
        if (session) {
            fetchSessionAndRole(session);
        } else {
            setUserRole(null);
        }
      }
    );

    return () => subscription.unsubscribe(); // Limpiar el listener
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="bg-gray-800 p-2 sm:p-4 shadow-lg sticky top-0 z-10 flex flex-col sm:flex-row sm:justify-between sm:items-center overflow-x-hidden">
      <Link href="/">
        <div className="text-2xl sm:text-3xl font-extrabold text-white cursor-pointer hover:text-indigo-400 transition duration-200">
          Mi Tienda Online
        </div>
      </Link>
      <div className="flex flex-wrap gap-2 sm:gap-4 items-center mt-2 sm:mt-0">
        {/* Botón de Admin solo si userRole es 'admin' */}
        {userRole === 'admin' && (
          <>
            <Link href="/admin">
              <div className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base transition duration-300 shadow-md">
                Panel Admin
              </div>
            </Link>
            <Link href="/productos">
              <div className="bg-green-500 hover:bg-green-600 text-white font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base transition duration-300 shadow-md">
                🛒 Pedidos
              </div>
            </Link>
          </>
        )}
        {/* Lógica Condicional del Botón de Sesión */}
        {session ? (
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-600 rounded-lg text-white font-bold text-sm sm:text-base hover:bg-red-700 transition duration-300 shadow-md"
          >
            Cerrar Sesión
          </button>
        ) : (
          <>
            <Link href="/productos">
              <div className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base transition duration-300 shadow-md">
                🛒 Pedidos
              </div>
            </Link>
            <Link href="/login">
              <div className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base transition duration-300 shadow-md">
                👤 Iniciar Sesión
              </div>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
