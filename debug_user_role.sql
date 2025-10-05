-- Query para verificar tu usuario y rol en Supabase
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Ver todos los usuarios autenticados
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Ver todos los perfiles y sus roles
SELECT 
    id,
    nombre,
    rol,
    telefono,
    nit_ci,
    created_at
FROM perfiles
ORDER BY created_at DESC;

-- 3. Join para ver usuario + perfil
SELECT 
    u.email,
    u.id as user_id,
    p.nombre,
    p.rol,
    p.telefono
FROM auth.users u
LEFT JOIN perfiles p ON u.id = p.id
ORDER BY u.created_at DESC;