"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/SupabaseClient'; // Asegúrate que esta ruta es correcta

export default function Header() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Función para obtener la sesión inicial
    const getInitialSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
    };

    getInitialSession();

    // Suscripción para escuchar los cambios de estado (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Al ocurrir un cambio, actualiza el estado de la sesión
        setSession(session);
      }
    );

    // Limpieza de la suscripción al desmontar el componente
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    // Cierra la sesión en Supabase
    await supabase.auth.signOut();
    // La suscripción (onAuthStateChange) se encargará de actualizar el estado `session` a null.
  };

  return (
    <header className="bg-gray-800 p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center">
      <Link href="/">
        <div className="text-3xl font-extrabold text-white cursor-pointer hover:text-indigo-400 transition duration-200">
          Mi Tienda Online
        </div>
      </Link>
      
      {/* 💡 Lógica Condicional del Botón: Muestra Login o Cerrar Sesión */}
      {session ? (
        // Si hay sesión (logeado), muestra el botón de Cerrar Sesión
        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 rounded-lg text-white font-bold hover:bg-red-700 transition duration-300 shadow-md"
        >
          Cerrar Sesión
        </button>
      ) : (
        // Si NO hay sesión, muestra el botón de Login (sin '/ Admin')
        <Link href="/login">
          <div className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg transition duration-300 shadow-md">
            👤 Iniciar Sesión
          </div>
        </Link>
      )}
    </header>
  );
}