-- Give only the existing sale transaction more time; do not change its body,
-- authorization, idempotency, stock, payment or accounting logic.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
SELECT json_build_object('function', p.oid::regprocedure::text,
                         'previous_settings', p.proconfig) AS before_change
FROM pg_proc p
WHERE p.oid = 'public.crear_venta_completa_segura(jsonb,jsonb,jsonb,uuid,text,text,text,bigint,text,uuid)'::regprocedure;
ALTER FUNCTION public.crear_venta_completa_segura(jsonb,jsonb,jsonb,uuid,text,text,text,bigint,text,uuid)
    SET statement_timeout = '60s';
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT json_build_object('sale_timeout_applied', true,
                         'function_settings', p.proconfig) AS result
FROM pg_proc p
WHERE p.oid = 'public.crear_venta_completa_segura(jsonb,jsonb,jsonb,uuid,text,text,text,bigint,text,uuid)'::regprocedure;
