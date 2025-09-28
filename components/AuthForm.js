// components/AuthForm.js
"use client";
import { useState } from 'react';
import { supabase } from "../lib/SupabaseClient"; // Ajusta esta ruta si es necesario

export default function AuthForm({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState(''); // Para mostrar mensajes de éxito/error

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    let authFunction = isRegistering 
      ? supabase.auth.signUp 
      : supabase.auth.signInWithPassword;

    const { data, error } = await authFunction({ email, password });

    if (error) {
      // 💡 CORRECCIÓN 1: Se reemplaza alert() por console.error y un mensaje en la UI
      console.error(`Error de autenticación: ${error.message}`);
      setMessage(`Error: ${error.message}`);

    } else if (data.session) {
      // 💡 CORRECCIÓN 2: Lógica de éxito para el inicio de sesión
      // Llamar a la función de éxito y pasar el ID del usuario.
      onLoginSuccess(data.session.user.id); 

    } else if (isRegistering && data.user) {
      // Mensaje si fue un registro exitoso, pero necesita confirmación
      setMessage("¡Registro exitoso! Por favor, revisa tu correo para confirmar la cuenta.");
      
    } else {
        // Manejo de otros casos raros
        setMessage("Operación completada. Revisa tu estado de sesión.");
    }
    
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center p-8 bg-white shadow-xl rounded-xl w-full max-w-md">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">
        {isRegistering ? 'Crear Cuenta' : 'Acceso de Usuario'}
      </h2>
      
      {/* Muestra el mensaje de error o éxito */}
      {message && (
        <div className={`p-3 mb-4 rounded-lg w-full text-center ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}
      
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
        onClick={() => {
            setIsRegistering(!isRegistering);
            setMessage(''); // Limpiar el mensaje al cambiar el modo
        }}
        className="mt-6 text-sm text-indigo-600 hover:text-indigo-800 transition duration-200"
      >
        {isRegistering ? 'Ya tengo una cuenta' : '¿Necesitas una cuenta?'}
      </button>
      
      <p className="mt-4 text-xs text-red-500">
        *El administrador debe registrarse primero.
      </p>
    </div>
  );
}