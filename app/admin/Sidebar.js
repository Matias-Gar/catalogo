"use client";
import { useState } from 'react';
import Link from 'next/link';

const menu = [
  {
    label: 'Perfiles',
    children: [
      { label: 'Mi Perfil', path: '/admin/perfil' },
    ],
  },
  {
    label: 'Pedidos',
    children: [
      { label: 'Gestionar Pedidos', path: '/admin/pedidos' },
    ],
  },
  {
    label: 'Gestión de Productos',
    children: [
      { label: 'Añadir Nuevos Artículos', path: '/admin/productos/nuevo' },
      { label: 'Catálogo', path: '/admin/productos/catalogo' },
      { label: 'Editar Catálogo', path: '/admin/productos/editar' },
      { label: 'Eliminar Catálogo', path: '/admin/productos/eliminar' },
    ],
  },
  {
    label: 'Control de Inventario',
    children: [
      { label: 'Stock', path: '/admin/inventario/stock' },
  { label: 'Próximo a compra', path: '/admin/inventario/proximo-a-compra' },
      { label: 'Estadística', path: '/admin/inventario/estadistica' },
    ],
  },
  {
    label: 'Ventas',
    children: [
      { label: 'Venta de Productos', path: '/admin/ventas/nueva' },
  { label: 'Todas las ventas', path: '/admin/ventas/todas' },
      { label: 'Estadística', path: '/admin/ventas/estadistica' },
    ],
  },
  {
    label: 'Pagos',
    children: [
      { label: 'QR', path: '/admin/pagos/qr' },
      { label: 'Transferencias', path: '/admin/pagos/transferencias' },
      { label: 'Tarjeta', path: '/admin/pagos/tarjeta' },
      { label: 'Efectivo', path: '/admin/pagos/efectivo' },
      { label: 'Estadísticas', path: '/admin/pagos/estadistica' },
    ],
  },
  {
    label: 'Categorías',
    children: [
      { label: 'Gestionar Categorías', path: '/admin/categorias' },
    ],
  },
  {
    label: 'Promociones',
    children: [
      { label: 'Productos', path: '/admin/promociones/productos' },
      { label: 'Descuentos', path: '/admin/promociones/descuentos' },
      { label: 'Packs', path: '/admin/promociones/packs' },
    ],
  },
  {
    label: 'WhatsApp Business',
    children: [
      { label: 'Panel de Control', path: '/admin/whatsapp' },
    ],
  },
];

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const [open, setOpen] = useState({});

  const toggle = (idx) => {
    setOpen((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Sidebar classes
  const sidebarBase = "fixed top-0 left-0 h-full w-64 bg-gray-900 text-white flex flex-col shadow-lg z-[99] transition-transform duration-300";
  const sidebarShow = mobileOpen ? "translate-x-0" : "-translate-x-full";

  return (
    <>
      {/* Overlay para cualquier tamaño de pantalla */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-40 z-30 transition-opacity duration-300 ${mobileOpen ? 'block' : 'hidden'}`}
        onClick={() => setMobileOpen(false)}
        aria-label="Cerrar menú"
      />
      {/* Sidebar colapsable en todas las resoluciones */}
      <aside
        className={`${sidebarBase} ${sidebarShow}`}
        style={{ minWidth: '16rem', maxWidth: '100vw' }}
      >
        <div className="p-4 text-2xl font-bold border-b border-gray-800 flex items-center justify-between">
          <span>Panel Admin</span>
          {/* Botón cerrar siempre visible */}
          <button
            className="text-white text-2xl ml-2 focus:outline-none"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            &times;
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-2 p-4">
            {menu.map((item, idx) => (
              <li key={item.label}>
                <button
                  className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-gray-800 focus:outline-none"
                  onClick={() => toggle(idx)}
                >
                  <span>{item.label}</span>
                  <span>{open[idx] ? '▼' : '▶'}</span>
                </button>
                {open[idx] && (
                  <ul className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <Link
                          href={child.path}
                          className="block px-2 py-1 rounded hover:bg-green-700 transition-colors"
                          onClick={() => setMobileOpen(false)}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
