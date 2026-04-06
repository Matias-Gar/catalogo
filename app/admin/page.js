"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "../../lib/SupabaseClient";
import Link from 'next/link'; // ¡Importación necesaria para el botón!
import { ADMIN_MENU, canAccessAdminPath, filterAdminMenuByRole, isAdminPanelRole } from '../../lib/adminPermissions';

export default function AdminDashboard() {
    const [userRole, setUserRole] = useState(null); 
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
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
                console.error("Error al obtener perfil:", error.message);
                setUserRole('cliente'); 
                router.push('/');
                return;
            }

            if (profile) {
                setUserRole(profile.rol);
            } else {
                setUserRole('cliente'); 
                router.push('/');
                return;
            }
            
            if (!isAdminPanelRole(profile.rol) || !canAccessAdminPath(profile.rol, '/admin')) {
                router.push('/');
            }
        };

        checkAuthAndRole();
    }, [router]);
    
    // Muestra pantalla de carga mientras se verifica el rol
    if (userRole === null) {
        return <div className="min-h-screen flex items-center justify-center text-xl font-medium text-gray-700">Verificando permisos, por favor espera...</div>;
    }

    if (!isAdminPanelRole(userRole) || !canAccessAdminPath(userRole, '/admin')) {
        return <div className="min-h-screen flex items-center justify-center text-xl font-medium text-red-500">Acceso denegado. Redirigiendo...</div>;
    }

    const quickLinks = filterAdminMenuByRole(userRole, ADMIN_MENU)
        .flatMap((item) => Array.isArray(item.children) ? item.children : (item.path ? [item] : []))
        .slice(0, 8);

    return (
        <div className="min-h-screen p-8 bg-gray-100">
            {/* Botón para volver al Catálogo */}
            <div className="mb-8">
                <Link href="/">
                    <button className="flex items-center bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Ver Catálogo de Productos
                    </button>
                </Link>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Panel de Administración 🛠️</h1>
            <p className="mb-8 text-gray-600">Accesos disponibles para el rol: <span className="font-bold">{userRole}</span></p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {quickLinks.map((entry) => (
                    <Link key={entry.path} href={entry.path} className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300">
                        <h2 className="text-2xl font-semibold text-indigo-600">{entry.label}</h2>
                        <p className="mt-2 text-gray-600">Abrir {entry.label.toLowerCase()}.</p>
                    </Link>
                ))}
            </div>
            
            <button onClick={() => supabase.auth.signOut()} className="mt-10 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                Cerrar Sesión
            </button>
        </div>
    );
}
