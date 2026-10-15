-- Ejecutar en Supabase SQL Editor para conservar los importes bancarios del cierre.
-- Los cierres anteriores quedan con NULL: no se inventan saldos historicos.
BEGIN;
ALTER TABLE public.cash_closures
  ADD COLUMN IF NOT EXISTS opening_qr numeric,
  ADD COLUMN IF NOT EXISTS expected_qr numeric,
  ADD COLUMN IF NOT EXISTS real_qr numeric,
  ADD COLUMN IF NOT EXISTS qr_difference numeric;
COMMENT ON COLUMN public.cash_closures.real_qr IS
  'Saldo bancario contado al cerrar: QR, tarjeta y transferencias.';
COMMIT;
NOTIFY pgrst, 'reload schema';
