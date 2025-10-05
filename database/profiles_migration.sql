-- =====================================================
-- MIGRACIÓN SQL PARA SISTEMA DE PERFILES DE USUARIOS
-- Sistema de perfiles para usuarios normales (separado de admin)
-- =====================================================

-- NOTA: Tu esquema actual tiene:
-- - public.perfiles (para admin con campo 'rol')
-- - Ahora agregamos public.profiles (para usuarios normales)

-- Crear tabla de perfiles para usuarios normales (diferente a 'perfiles' de admin)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Política para que los usuarios solo puedan ver su propio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Política para que los usuarios solo puedan actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Política para que los usuarios solo puedan insertar su propio perfil
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Función para crear perfil automáticamente cuando se registra un usuario
-- IMPORTANTE: Solo crea en 'profiles' (usuarios normales), no en 'perfiles' (admin)
CREATE OR REPLACE FUNCTION public.handle_new_user_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear perfil normal, no perfil de admin
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
    -- Si falla, continúa sin error para no afectar el registro
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger existente si existe (con nombre específico para profiles)
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;

-- Trigger para crear perfil automáticamente al registrar usuario (nombre único)
CREATE TRIGGER on_auth_user_created_profiles
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profiles();

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS profiles_id_idx ON public.profiles(id);
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles(updated_at);

-- Comentarios para documentación
COMMENT ON TABLE public.profiles IS 'Perfiles de usuarios con información personal editable';
COMMENT ON COLUMN public.profiles.id IS 'ID del usuario que coincide con auth.users.id';
COMMENT ON COLUMN public.profiles.full_name IS 'Nombre completo del usuario';
COMMENT ON COLUMN public.profiles.phone IS 'Número de teléfono del usuario';
COMMENT ON COLUMN public.profiles.bio IS 'Biografía o descripción personal del usuario';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL de la imagen de perfil del usuario';
COMMENT ON COLUMN public.profiles.created_at IS 'Fecha de creación del perfil';
COMMENT ON COLUMN public.profiles.updated_at IS 'Fecha de última actualización del perfil';