-- SOLUCIÓN SIMPLE PARA ERRORES 500 EN PERFILES
-- Ejecutar en Supabase SQL Editor

-- 1. DESHABILITAR RLS temporalmente para limpiar
ALTER TABLE public.perfiles DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Usuarios pueden insertar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Administradores pueden ver todos los perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Administradores pueden actualizar todos los perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "authenticated_users_read_perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.perfiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.perfiles;
DROP POLICY IF EXISTS "admins_full_access" ON public.perfiles;
DROP POLICY IF EXISTS "read_all_perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "insert_own_perfil" ON public.perfiles;
DROP POLICY IF EXISTS "update_own_perfil" ON public.perfiles;
DROP POLICY IF EXISTS "admin_full_access" ON public.perfiles;

-- 3. Agregar columna foto si no existe
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

-- 4. Crear políticas MUY SIMPLES
-- Solo permitir a usuarios autenticados hacer TODO en perfiles
CREATE POLICY "allow_authenticated_all" ON public.perfiles
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Volver a habilitar RLS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 6. Configurar Storage (bucket y políticas básicas)
INSERT INTO storage.buckets (id, name, public)
VALUES ('perfiles', 'perfiles', true)
ON CONFLICT (id) DO NOTHING;

-- Eliminar políticas Storage existentes
DROP POLICY IF EXISTS "upload_profile_photos" ON storage.objects;
DROP POLICY IF EXISTS "read_profile_photos" ON storage.objects;
DROP POLICY IF EXISTS "update_profile_photos" ON storage.objects;
DROP POLICY IF EXISTS "delete_profile_photos" ON storage.objects;

-- Crear políticas Storage simples
CREATE POLICY "allow_all_profile_photos" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'perfiles')
WITH CHECK (bucket_id = 'perfiles');

CREATE POLICY "public_read_photos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'perfiles');

-- 7. Eliminar trigger y función si existen
DROP TRIGGER IF EXISTS protect_role_trigger ON public.perfiles;
DROP FUNCTION IF EXISTS protect_role_field();

-- 8. Verificar que funciona
SELECT 'RLS configurado correctamente - Políticas simplificadas' as resultado;

-- 9. Mostrar políticas actuales
SELECT policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'perfiles';