"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "../../lib/SupabaseClient";

export default function AdminDashboard() {
    // Inicializa el rol en null para indicar que la verificación está en curso
    const [userRole, setUserRole] = useState(null); 
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                // Si no hay usuario, redirigir a login
                router.push('/login');
                // IMPORTANTE: Establecer el rol a 'not_logged' para evitar que se quede cargando
                setUserRole('not_logged'); 
                return;
            }

            // 1. Verificar el rol en la base de datos
            const { data: profile, error } = await supabase
                .from('perfiles')
                .select('rol')
                .eq('id', user.id)
                .single();
            
            if (error) {
                // 💡 MEJORA: Manejar errores de consulta (ej. RLS no permite leer)
                console.error("Error al obtener perfil:", error.message);
                // Si hay un error, lo tratamos como si no fuera admin y lo mandamos al home
                setUserRole('cliente'); 
                router.push('/');
                return;
            }

            // 💡 CORRECCIÓN CRÍTICA: Actualizar el estado del rol
            if (profile) {
                setUserRole(profile.rol);
            } else {
                // Caso donde el perfil no se encontró, redirigir
                setUserRole('cliente'); 
                router.push('/');
                return;
            }
            
            if (profile.rol !== 'admin') {
                console.warn("Acceso denegado: No tienes permisos de administrador.");
                router.push('/');
            }
        };

        checkAuthAndRole();
    }, [router]);
    
    // 💡 CORRECCIÓN: Ahora userRole se inicializa en null y cambia a 'admin' o 'cliente'
    if (userRole === null) {
        return <div className="min-h-screen flex items-center justify-center text-xl font-medium text-gray-700">Verificando permisos, por favor espera...</div>;
    }

    if (userRole !== 'admin') {
        // Redirigido en el useEffect, pero esta condición previene el parpadeo
        return <div className="min-h-screen flex items-center justify-center text-xl font-medium text-red-500">Acceso denegado. Redirigiendo...</div>;
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
