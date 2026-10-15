-- Ejecutar una vez en el editor SQL de Supabase.
-- Ubicacion de referencia: no modifica stock ni registra cantidades por caja.
BEGIN;
CREATE TABLE IF NOT EXISTS public.producto_ubicaciones (
  producto_id bigint PRIMARY KEY REFERENCES public.productos(user_id) ON DELETE CASCADE,
  caja text NOT NULL CHECK (length(trim(caja)) BETWEEN 1 AND 80),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
-- Acceso exclusivamente por la API administrativa con comprobacion de sucursal.
ALTER TABLE public.producto_ubicaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.producto_ubicaciones FROM anon, authenticated;
GRANT ALL ON public.producto_ubicaciones TO service_role;
COMMENT ON TABLE public.producto_ubicaciones IS
  'Una ubicacion de referencia por producto. Sus variantes comparten caja. Ampliable a ubicaciones multiples sin alterar stock.';
COMMIT;
