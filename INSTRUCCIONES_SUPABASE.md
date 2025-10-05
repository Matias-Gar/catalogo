# Instrucciones para Implementar Perfiles de Usuario en tu Supabase

## 📋 Tu Esquema Actual

Tu base de datos ya tiene:
- `public.perfiles` - Para administradores (con campo `rol`)
- Varias otras tablas para tu tienda

## 🎯 Lo que vamos a agregar

- `public.profiles` - Nueva tabla para usuarios normales (completamente separada)

## 📝 Pasos a seguir en Supabase

### 1. Abrir el SQL Editor en Supabase

1. Ve a tu proyecto en [supabase.com](https://supabase.com)
2. Haz clic en "SQL Editor" en el menú lateral
3. Crea una nueva consulta

### 2. Ejecutar la Migración

Copia y pega el siguiente SQL en el editor y ejecuta:

```sql
-- =====================================================
-- MIGRACIÓN PARA PERFILES DE USUARIOS NORMALES
-- =====================================================

-- Crear tabla de perfiles para usuarios normales
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Función para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Índices
CREATE INDEX IF NOT EXISTS profiles_id_idx ON public.profiles(id);
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles(updated_at);
```

### 3. Verificar la Instalación

Después de ejecutar, verifica que:

1. **Tabla creada**: Ve a "Table Editor" y busca `profiles`
2. **RLS habilitado**: En la tabla `profiles`, verifica que RLS esté activado
3. **Políticas creadas**: Revisa que las políticas estén listadas

### 4. Datos de Prueba (Opcional)

Si quieres crear un perfil de prueba para un usuario existente:

```sql
-- Reemplaza 'USER_UUID_AQUI' con un UUID real de auth.users
INSERT INTO public.profiles (id, full_name, phone, bio)
VALUES (
  'USER_UUID_AQUI', 
  'Usuario de Prueba', 
  '+591123456789', 
  'Esta es mi biografía de prueba'
);
```

## 🔄 Diferencias importantes

### Tabla `perfiles` (Existente - Admin)
- Campo: `rol` (admin/cliente)
- Uso: Sistema administrativo
- Ruta: `/admin/perfil`

### Tabla `profiles` (Nueva - Usuarios)
- Campos: `full_name`, `phone`, `bio`, `avatar_url`
- Uso: Usuarios normales
- Ruta: `/perfil`

## ✅ Una vez completado

Los usuarios normales podrán:
- Acceder a `/perfil` desde el botón en el header
- Editar su información personal
- No tendrán acceso a funciones administrativas

Los administradores seguirán usando:
- La tabla `perfiles` existente
- La ruta `/admin/perfil`
- Todas sus funciones administrativas

## 🚨 Importante

- **NO** elimines la tabla `perfiles` existente
- **NO** modifiques el sistema de administración actual
- El nuevo sistema es **completamente independiente**

¡El sistema está diseñado para coexistir sin conflictos!