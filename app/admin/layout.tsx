"use client";

import Sidebar from './Sidebar';
import { useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      {/* Botón hamburguesa solo en móvil */}
      {/* Botón hamburguesa siempre visible, pero oculto si el sidebar está abierto en desktop */}
      <button
        className={`fixed top-4 left-4 z-[100] bg-gray-900 text-white p-2 rounded-full shadow-lg focus:outline-none transition-opacity duration-200 ${mobileOpen && 'opacity-0 pointer-events-none'} md:hidden`}
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        style={{ zIndex: 100 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {/* Botón hamburguesa para desktop, solo si sidebar está oculto (por ejemplo, para pantallas pequeñas o si se quiere forzar cerrar) */}
      <button
        className={`hidden md:block fixed top-4 left-4 z-[100] bg-gray-900 text-white p-2 rounded-full shadow-lg focus:outline-none transition-opacity duration-200 ${mobileOpen ? 'opacity-0 pointer-events-none' : ''}`}
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        style={{ zIndex: 100 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <main className="flex-1 bg-gray-100 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
