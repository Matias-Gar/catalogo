// components/Header.js
"use client";
import Link from 'next/link';

export default function Header() {
  // Nota: En un proyecto real, aquí cargarías el estado de la sesión
  // para mostrar "Cerrar Sesión" o "Admin Dashboard" si el usuario está logueado.
  // Por ahora, solo es un enlace simple al login.

  return (
    // bg-gray-800 le da un color oscuro para que resalte.
    <header className="bg-gray-800 p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center">
      <Link href="/">
        <div className="text-3xl font-extrabold text-white cursor-pointer hover:text-indigo-400 transition duration-200">
          Mi Tienda Online
        </div>
      </Link>
      
      <Link href="/login">
        <div className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg transition duration-300 shadow-md">
          👤 Iniciar Sesión / Admin
        </div>
      </Link>
    </header>
  );
}