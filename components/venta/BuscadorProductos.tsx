"use client";
import React from 'react';
import Image from 'next/image';

interface Producto {
  user_id: string;
  nombre: string;
  precio: number;
  categorias?: { categori?: string };
}

interface Props {
  busqueda: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  searchResults: Producto[];
  searchLoading: boolean;
  imagenes: Record<string, string[]>;
  onAdd: (prod: Producto) => void;
  showSuggestions: boolean;
  setShowSuggestions: (b: boolean) => void;
}

export default function BuscadorProductos({
  busqueda,
  onChange,
  onSubmit,
  searchResults,
  searchLoading,
  imagenes,
  onAdd,
  showSuggestions,
  setShowSuggestions
}: Props) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="flex flex-col sm:flex-row gap-2 mb-4 mt-8">
      <div className="flex-1 relative">
        <input
          className="w-full border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 placeholder-gray-700 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
          placeholder="Escanea o ingresa código de barra / nombre / categoría (Ctrl+B/cmd+B)"
          value={busqueda}
          onChange={e => { onChange(e.target.value); setShowSuggestions(true); }}
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
          onFocus={() => { setShowSuggestions(true); if (!busqueda.trim()) onSubmit(); }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />

        {showSuggestions && (
          <ul className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-200 rounded shadow max-h-72 overflow-auto">
            {searchLoading && <li className="px-3 py-2 text-sm text-gray-500">Buscando...</li>}

            {!searchLoading && searchResults.slice(0,20).map(p => (
              <li key={p.user_id} className="px-3 py-2 hover:bg-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-10 h-10 bg-gray-50 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {imagenes[p.user_id]?.[0] ? (
                      <Image src={imagenes[p.user_id][0]} width={40} height={40} alt="thumb" className="object-cover" />
                    ) : (
                      <div className="text-gray-300 text-xs">No img</div>
                    )}
                  </div>
                  <div className="truncate">
                    <div className="font-medium text-sm truncate">{p.nombre}</div>
                    <div className="text-xs text-gray-400">{p.categorias?.categori || 'Sin categoría'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-gray-700">Bs {Number(p.precio).toFixed(2)}</div>
                  <button type="button" onMouseDown={e => { e.preventDefault(); onAdd(p); setShowSuggestions(false); onChange(''); }} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm">Agregar</button>
                </div>
              </li>
            ))}

            {!searchLoading && searchResults.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No hay coincidencias</li>}
          </ul>
        )}
      </div>
      <button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded font-bold shadow">Agregar</button>
    </form>
  );
}
