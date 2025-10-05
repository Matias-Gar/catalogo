-- =====================================================
-- MIGRACIÓN PARA AÑADIR CAMPO CI/NIT A PERFILES
-- =====================================================

-- Añadir campo ci_nit a la tabla profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ci_nit TEXT;

-- Comentario para el nuevo campo
COMMENT ON COLUMN public.profiles.ci_nit IS 'Cédula de identidad o NIT del usuario';

-- Crear índice para búsquedas por CI/NIT (opcional)
CREATE INDEX IF NOT EXISTS profiles_ci_nit_idx ON public.profiles(ci_nit);

-- Verificar la estructura actualizada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;