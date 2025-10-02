-- Agregar campo teléfono a la tabla perfiles
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna teléfono
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);

-- 2. Agregar comentario para documentar
COMMENT ON COLUMN public.perfiles.telefono IS 'Número de teléfono del usuario';

-- 3. Verificar que la columna se creó correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'perfiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Mensaje de confirmación
SELECT 'Campo teléfono agregado correctamente a la tabla perfiles' as resultado;