// components/AuthForm.js
"use client";
import { useState } from 'react';
import { supabase } from "../lib/SupabaseClient"; // Ajusta esta ruta si es necesario

export default function AuthForm({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let authFunction = isRegistering 
      ? supabase.auth.signUp 
      : supabase.auth.signInWithPassword;

    const { data, error } = await authFunction({ email, password });

    if (error) {
      alert(`Error: ${error.message}`);
    } else if (data.user) {
      // 💡 Llamar a la función de éxito y pasar el ID del usuario.
      onLoginSuccess(data.user.id); 
    }
    
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center p-8 bg-white shadow-xl rounded-xl w-full max-w-md">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">
        {isRegistering ? 'Crear Cuenta' : 'Acceso de Usuario'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4 w-full">
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition duration-200 disabled:bg-gray-400"
        >
          {loading ? 'Cargando...' : (isRegistering ? 'Registrarse' : 'Iniciar Sesión')}
        </button>
      </form>
      
      <button 
        onClick={() => setIsRegistering(!isRegistering)}
        className="mt-6 text-sm text-indigo-600 hover:text-indigo-800 transition duration-200"
      >
        {isRegistering ? 'Ya tengo una cuenta' : '¿Necesitas una cuenta?'}
      </button>
      
      {/* Aviso importante: Asegúrate de que el primer usuario registrado en Supabase 
      tenga manualmente asignado el rol 'admin' en la tabla 'perfiles'. */}
      <p className="mt-4 text-xs text-red-500">
        *El administrador debe registrarse primero.
      </p>
    </div>
  );
}