// components/AuthForm.js
"use client";
import { useState } from 'react';
import { supabase } from "../lib/SupabaseClient";

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 💡 Para registrarte o iniciar sesión
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password }); // o signUp

    if (error) alert(error.message);
    setLoading(false);
  };

  // 💡 Para cerrar sesión
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white shadow-lg rounded-xl">
      <h2 className="text-2xl font-bold mb-4">Acceso de Administrador</h2>
      
      {/* Muestra el formulario de login/registro si no hay sesión */}
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 rounded-lg disabled:bg-gray-400"
        >
          {loading ? 'Cargando...' : 'Iniciar Sesión'}
        </button>
      </form>
      
      {/* Botón de Logout (puedes mostrarlo si el usuario ya está logueado) */}
      <button onClick={handleLogout} className="mt-4 text-sm text-red-500 hover:underline">
        Cerrar Sesión
      </button>
    </div>
  );
}