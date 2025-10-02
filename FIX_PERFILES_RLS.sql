-- ============================================
-- ARREGLAR POLÍTICAS RLS PARA TABLA PERFILES
-- ============================================
-- Ejecuta este script en Supabase SQL Editor

-- 1. Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Usuarios pueden insertar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Administradores pueden ver todos los perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Administradores pueden actualizar todos los perfiles" ON public.perfiles;

-- 2. Crear políticas nuevas y permisivas

-- Política para VER (SELECT) - Usuarios pueden ver su propio perfil
CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.perfiles
FOR SELECT USING (auth.uid() = id);

-- Política para VER (SELECT) - Administradores pueden ver todos
CREATE POLICY "Administradores pueden ver todos los perfiles" ON public.perfiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() AND rol = 'administracion'
  )
);

-- Política para INSERTAR (INSERT) - Usuarios pueden crear su propio perfil
CREATE POLICY "Usuarios pueden insertar su propio perfil" ON public.perfiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Política para ACTUALIZAR (UPDATE) - Usuarios pueden actualizar su propio perfil
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.perfiles
FOR UPDATE USING (auth.uid() = id);

-- Política para ACTUALIZAR (UPDATE) - Administradores pueden actualizar todos
CREATE POLICY "Administradores pueden actualizar todos los perfiles" ON public.perfiles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() AND rol = 'administracion'
  )
);

-- 3. Verificar que RLS esté habilitado
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 4. Verificar las políticas creadas
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'perfiles';