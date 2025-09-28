// pages/admin/index.js (o app/admin/page.js)
"use client";
import { useEffect, useState } from 'react';
import { supabase } from "../../lib/SupabaseClient";
import AuthForm from "../../components/AuthForm";

export default function AdminDashboard() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Escucha si el usuario está logueado
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => authListener?.subscription.unsubscribe();
  }, []);

  // 💡 La clave: si no hay sesión, muestra el formulario de login.
  if (!session) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100"><AuthForm /></div>;
  }

  // 💡 Si hay sesión, muestra el contenido de administrador.
  return (
    <div className="min-h-screen p-6 bg-white">
      <h1 className="text-4xl font-bold mb-8">Panel de Administración 👑</h1>
      <p>Aquí pondrás las herramientas para añadir/editar productos e inventario.</p>
      {/* Botón de Logout para el dashboard */}
      <button onClick={() => supabase.auth.signOut()} className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg">
        Cerrar Sesión
      </button>
    </div>
  );
}