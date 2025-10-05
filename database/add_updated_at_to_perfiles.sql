-- =====================================================
-- AGREGAR COLUMNA UPDATED_AT A TABLA PERFILES
-- =====================================================

-- 1. Agregar columna updated_at si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'perfiles' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.perfiles 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
    END IF;
END $$;

-- 2. Crear función para manejar updated_at en perfiles
CREATE OR REPLACE FUNCTION public.handle_perfiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear trigger para updated_at en perfiles
DROP TRIGGER IF EXISTS set_perfiles_updated_at ON public.perfiles;
CREATE TRIGGER set_perfiles_updated_at
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_perfiles_updated_at();

-- 4. Actualizar registros existentes para que tengan updated_at
UPDATE public.perfiles 
SET updated_at = COALESCE(created_at, NOW()) 
WHERE updated_at IS NULL;

-- 5. Comentario
COMMENT ON COLUMN public.perfiles.updated_at IS 'Fecha y hora de última actualización del perfil';