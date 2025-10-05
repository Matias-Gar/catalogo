-- =====================================================
-- SQL CORREGIDO PARA SUPABASE - PERFILES DE USUARIOS
-- =====================================================

-- 1. Crear tabla de perfiles para usuarios normales
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas si existen (para evitar errores)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 4. Crear políticas de seguridad
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Función para actualizar updated_at (nombre único)
CREATE OR REPLACE FUNCTION public.handle_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para updated_at (nombre único)
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profiles_updated_at();

-- 7. Función para crear perfil automáticamente (nombre único)
CREATE OR REPLACE FUNCTION public.handle_new_user_profiles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, created_at, updated_at)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW(), 
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Si falla, continúa sin error
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger para crear perfil automáticamente (nombre único)
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;
CREATE TRIGGER on_auth_user_created_profiles
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profiles();

-- 9. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS profiles_id_idx ON public.profiles(id);
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles(updated_at);

-- 10. Comentarios para documentación
COMMENT ON TABLE public.profiles IS 'Perfiles de usuarios normales (no admin)';
COMMENT ON COLUMN public.profiles.id IS 'ID del usuario de auth.users';
COMMENT ON COLUMN public.profiles.full_name IS 'Nombre completo';
COMMENT ON COLUMN public.profiles.phone IS 'Teléfono';
COMMENT ON COLUMN public.profiles.bio IS 'Biografía personal';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL del avatar';