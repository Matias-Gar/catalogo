-- ============================================
-- AGREGAR FOTO DE PERFIL Y PROTEGER ROL
-- ============================================
-- Ejecuta este script en Supabase SQL Editor

-- 1. Agregar columna para foto de perfil
ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

-- 2. Crear políticas RLS más específicas (eliminar las anteriores)
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Administradores pueden actualizar todos los perfiles" ON public.perfiles;

-- 3. Política para usuarios: pueden actualizar SOLO nombre, nit_ci y foto_perfil
CREATE POLICY "Usuarios pueden actualizar su perfil (sin rol)" ON public.perfiles
FOR UPDATE USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  -- Verificar que no están tratando de cambiar el rol
  (rol IS NULL OR rol = (SELECT rol FROM public.perfiles WHERE id = auth.uid()))
);

-- 4. Política para administradores: pueden actualizar TODO incluyendo roles
CREATE POLICY "Administradores pueden actualizar todos los perfiles" ON public.perfiles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() AND rol = 'administracion'
  )
);

-- 5. Crear bucket para fotos de perfil en Storage (si no existe)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('perfiles', 'perfiles', true) 
ON CONFLICT (id) DO NOTHING;

-- 6. Política de storage para fotos de perfil
CREATE POLICY IF NOT EXISTS "Usuarios pueden subir su foto de perfil" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'perfiles' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY IF NOT EXISTS "Usuarios pueden ver fotos de perfil" ON storage.objects
FOR SELECT USING (bucket_id = 'perfiles');

CREATE POLICY IF NOT EXISTS "Usuarios pueden actualizar su foto de perfil" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'perfiles' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY IF NOT EXISTS "Usuarios pueden eliminar su foto de perfil" ON storage.objects
FOR DELETE USING (
  bucket_id = 'perfiles' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. Verificar las políticas creadas
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'perfiles';