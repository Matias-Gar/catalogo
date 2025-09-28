// app/admin/productos/page.js

"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/SupabaseClient'; // Usando el alias correcto
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Barcode from 'react-barcode'; // <-- Importación necesaria

// 1. FUNCIÓN PARA GENERAR EL CÓDIGO DE BARRAS
const generateBarcode = () => {
    // Genera un número de 12 dígitos, lo suficientemente único para un inventario.
    // EAN13 requiere 13 dígitos, pero la librería puede generar el dígito de control.
    const baseNumber = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    return baseNumber;
};


export default function AdminProductosPage() {
    const router = useRouter();
    // ... (otros estados como productos, newProduct, etc.)

    // 2. MODIFICAR LA FUNCIÓN handleSubmit PARA GUARDAR EL CÓDIGO

    const handleSubmit = async (e) => {
        e.preventDefault();
        // ... (código de validación)
            
        try {
            // Lógica de subida de imagen...
            const imageUrl = "URL_DE_LA_IMAGEN"; // Reemplaza con tu lógica real

            // Generar el código de barras ANTES de insertar
            const barcodeNumber = generateBarcode();

            const productData = {
                nombre: newProduct.nombre,
                descripcion: newProduct.descripcion,
                precio: newProduct.precio,
                stock: newProduct.stock, // Columna ya corregida en Supabase
                imagen_url: imageUrl,
                codigo_barra: barcodeNumber, // <-- ¡GUARDAR EL NUEVO CÓDIGO!
            };
            
            const { error } = await supabase.from("productos").insert([productData]);

            if (error) throw error;

            // ... (Lógica de éxito y recarga de productos)

        } catch (error) {
            // ... (manejo de errores)
        }
    };


    // 3. MODIFICAR EL RETURN (RENDERIZADO)
    return (
        <div>
            {/* ... FORMULARIO (con handleSubmit) ... */}

            {/* ... LISTADO DE PRODUCTOS ... */}

            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CÓDIGO BARRA</th> {/* NUEVO ENCABEZADO */}
                        {/* ... otros encabezados */}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {productos.map((producto) => (
                        <tr key={producto.id} className="hover:bg-indigo-50">
                            {/* 4. CELDA PARA EL CÓDIGO DE BARRAS */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {producto.codigo_barra ? (
                                    <Barcode 
                                        value={producto.codigo_barra} 
                                        width={1.5} 
                                        height={30} 
                                        displayValue={false} 
                                        format="EAN13" 
                                    />
                                ) : (
                                    <span className="text-red-500">Sin Código</span>
                                )}
                            </td>
                            {/* ... el resto de las celdas (imagen, nombre, etc.) */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}