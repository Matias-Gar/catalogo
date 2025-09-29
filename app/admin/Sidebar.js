"use client";
import { useState } from 'react';
import Link from 'next/link';

const menu = [
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
];

export default function Sidebar() {
  const [open, setOpen] = useState({});

  const toggle = (idx) => {
    setOpen((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <aside className="h-screen w-64 bg-gray-900 text-white flex flex-col shadow-lg">
      <div className="p-4 text-2xl font-bold border-b border-gray-800">Panel Admin</div>
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
  );
}
