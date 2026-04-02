"use client";
import React from 'react';

interface ClienteFormProps {
  cliente: any;
  onChange: (campo: string, valor: any) => void;
  onBuscar: () => void;
  onGuardar: () => void;
  onBuscarEmailHistorico: () => void;
}

export default function ClienteForm({ cliente, onChange, onBuscar, onGuardar, onBuscarEmailHistorico }: ClienteFormProps) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Datos del Cliente</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* fila carnet con botón */}
        <div className="sm:col-span-3 flex gap-2 items-center">
          <input
            className="flex-1 border border-gray-300 bg-gray-50 text-gray-900 rounded px-3 py-2 placeholder-gray-500 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
            placeholder="Carnet / CI"
            value={cliente.carnet}
            onChange={e => onChange('carnet', e.target.value)}
          />
          <button
            type="button"
            onClick={onBuscar}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold transition"
          >Buscar</button>
        </div>

        {/* nombre, celular, correo en la siguiente fila */}
        <input
          className="border border-gray-300 bg-gray-50 text-gray-900 rounded px-3 py-2 placeholder-gray-500 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
          placeholder="Nombre del cliente"
          value={cliente.nombre}
          onChange={e => onChange('nombre', e.target.value)}
        />

        <input
          className="border border-gray-300 bg-gray-50 text-gray-900 rounded px-3 py-2 placeholder-gray-500 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
          placeholder="Teléfono"
          value={cliente.telefono}
          onChange={e => onChange('telefono', e.target.value)}
          type="tel"
        />

        {/* nit y facturación */}
        <input
          className="border border-gray-300 bg-gray-50 text-gray-900 rounded px-3 py-2 placeholder-gray-500 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
          placeholder="NIT/CI"
          value={cliente.nit}
          onChange={e => onChange('nit', e.target.value)}
        />

        <input
          className="border border-gray-300 bg-gray-50 text-gray-900 rounded px-3 py-2 placeholder-gray-500 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
          placeholder="Correo electrónico"
          value={cliente.email}
          onChange={e => onChange('email', e.target.value)}
          type="email"
        />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={cliente.requiereFactura}
            onChange={e => onChange('requiereFactura', e.target.checked)}
            className="h-4 w-4 text-blue-600"
          />
          ¿Requiere factura?
        </label>

        <div className="sm:col-span-3">
          <button
            type="button"
            onClick={onGuardar}
            disabled={!cliente.carnet || !cliente.nombre || !cliente.email}
            className={`w-full px-4 py-2 rounded font-semibold transition ${cliente.guardado ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
          >
            {cliente.guardado ? 'Guardado' : 'Añadir / actualizar cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
