// app/admin/page.js
"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "../../lib/SupabaseClient";

export default function AdminDashboard() {
    const [userRole, setUserRole] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                // Si no hay usuario, redirigir a login
                router.push('/login');
                return;
            }

            // 1. Verificar el rol en la base de datos
            const { data: profile } = await supabase
                .from('perfiles')
                .select('rol')
                .eq('id', user.id)
                .single();

            if (profile?.rol !== 'admin') {
                // 2. Si NO es admin, redirigir al catálogo o mostrar error
                alert("Acceso denegado: No tienes permisos de administrador.");
                router.push('/');
            } else {
                // 3. ¡Es admin! Mostrar el dashboard
                setUserRole('admin');
            }
        };

        checkAuthAndRole();
    }, [router]);

    if (userRole !== 'admin') {
        return <div className="min-h-screen flex items-center justify-center">Cargando o verificando permisos...</div>;
    }

    // 4. Contenido del Dashboard (Solo visible para admins)
    return (
        <div className="min-h-screen p-8 bg-gray-100">
            <h1 className="text-4xl font-bold text-gray-800 mb-8">Panel de Administración 🛠️</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <a href="/admin/productos" className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300">
                    <h2 className="text-2xl font-semibold text-indigo-600">Gestión de Productos</h2>
                    <p className="mt-2 text-gray-600">Añadir, editar o eliminar productos del catálogo.</p>
                </a>

                <a href="/admin/inventario" className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300">
                    <h2 className="text-2xl font-semibold text-green-600">Control de Inventario</h2>
                    <p className="mt-2 text-gray-600">Actualizar stock y ver niveles de inventario.</p>
                </a>
                
                {/* Puedes seguir añadiendo enlaces aquí (Ventas, Clientes, etc.) */}
            </div>
            
            <button onClick={() => supabase.auth.signOut()} className="mt-10 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                Cerrar Sesión
            </button>
        </div>
    );
}