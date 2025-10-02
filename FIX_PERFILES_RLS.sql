-- ============================================
-- ARREGLAR POLÍTICAS RLS PARA TABLA PERFILES
-- ============================================
-- Ejecuta este script en Supabase SQL Editor

-- 1. Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Usuarios pueden insertar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Administradores pueden ver todos los perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Administradores pueden actualizar todos los perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "authenticated_users_read_perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.perfiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.perfiles;
DROP POLICY IF EXISTS "admins_full_access" ON public.perfiles;

-- 2. Agregar columna de foto si no existe
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

-- 3. Crear políticas SIMPLES y PERMISIVAS

-- Permitir a usuarios autenticados leer todos los perfiles
CREATE POLICY "read_all_perfiles" ON public.perfiles
FOR SELECT TO authenticated
USING (true);

-- Permitir a usuarios insertar su propio perfil
CREATE POLICY "insert_own_perfil" ON public.perfiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Permitir a usuarios actualizar su propio perfil (sin cambiar rol)
CREATE POLICY "update_own_perfil" ON public.perfiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Permitir a admins hacer TODO
CREATE POLICY "admin_full_access" ON public.perfiles
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() AND rol IN ('admin', 'administracion')
  )
);

-- 4. Asegurar que RLS esté habilitado
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 5. Configurar Storage para fotos de perfil
INSERT INTO storage.buckets (id, name, public)
VALUES ('perfiles', 'perfiles', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Eliminar políticas de Storage existentes
DROP POLICY IF EXISTS "users_upload_own_photos" ON storage.objects;
DROP POLICY IF EXISTS "public_read_profile_photos" ON storage.objects;
DROP POLICY IF EXISTS "users_manage_own_photos" ON storage.objects;
DROP POLICY IF EXISTS "users_delete_own_photos" ON storage.objects;

-- 7. Crear políticas de Storage
CREATE POLICY "upload_profile_photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'perfiles');

CREATE POLICY "read_profile_photos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'perfiles');

CREATE POLICY "update_profile_photos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'perfiles');

CREATE POLICY "delete_profile_photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'perfiles');

-- 8. Crear función para proteger el campo rol
CREATE OR REPLACE FUNCTION protect_role_field()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo admins pueden cambiar roles
  IF OLD.rol IS DISTINCT FROM NEW.rol THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'administracion')
    ) THEN
      -- Si no es admin, mantener el rol original
      NEW.rol := OLD.rol;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Crear trigger para proteger rol
DROP TRIGGER IF EXISTS protect_role_trigger ON public.perfiles;
CREATE TRIGGER protect_role_trigger
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_role_field();

-- 10. Verificar resultado
SELECT 'Políticas RLS actualizadas correctamente - Ahora puedes editar perfiles' as mensaje;