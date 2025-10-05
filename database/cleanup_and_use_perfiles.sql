-- =====================================================
-- LIMPIAR TABLA PROFILES NUEVA Y USAR PERFILES EXISTENTE
-- =====================================================

-- 1. Eliminar triggers relacionados con profiles
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;

-- 2. Eliminar funciones relacionadas con profiles
DROP FUNCTION IF EXISTS public.handle_new_user_profiles();
DROP FUNCTION IF EXISTS public.handle_profiles_updated_at();

-- 3. Eliminar políticas RLS de profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 4. Eliminar la tabla profiles completa
DROP TABLE IF EXISTS public.profiles;

-- 5. Verificar que se eliminó
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'profiles';

-- =====================================================
-- CONFIGURAR TABLA PERFILES EXISTENTE PARA USUARIOS NORMALES
-- =====================================================

-- 6. Verificar estructura de tabla perfiles existente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'perfiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Añadir campo ci_nit si no existe (ya que mencionaste que lo querías)
ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS ci_nit TEXT;

-- 8. Añadir campo bio si no existe
ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS bio TEXT;

-- 9. Verificar que RLS esté habilitado en perfiles
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 10. Crear política para que usuarios solo vean su propio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON public.perfiles;
CREATE POLICY "Users can view own profile" ON public.perfiles
  FOR SELECT USING (auth.uid() = id);

-- 11. Crear política para que usuarios solo actualicen su propio perfil  
DROP POLICY IF EXISTS "Users can update own profile" ON public.perfiles;
CREATE POLICY "Users can update own profile" ON public.perfiles
  FOR UPDATE USING (auth.uid() = id);

-- 12. Crear política para insertar propio perfil
DROP POLICY IF EXISTS "Users can insert own profile" ON public.perfiles;
CREATE POLICY "Users can insert own profile" ON public.perfiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 13. Comentarios para documentación
COMMENT ON COLUMN public.perfiles.ci_nit IS 'Cédula de identidad o NIT del usuario';
COMMENT ON COLUMN public.perfiles.bio IS 'Biografía personal del usuario';

-- 14. Verificar estructura final
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'perfiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;