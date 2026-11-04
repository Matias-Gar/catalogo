-- Pending deployment: SSH to the database host was unavailable during the audit.
-- Before applying, export the schema/ACL for these three tables using pg_dump
-- --schema-only and preserve the current pg_policies/relacl output privately.
-- Run as the database owner. No rows, stock, prices or financial values change.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

-- Current password recovery uses Supabase Auth; legacy endpoints return 410.
REVOKE ALL PRIVILEGES ON TABLE public.password_resets FROM PUBLIC, anon, authenticated;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Preserve existing application-role privileges, including those inherited
-- from PUBLIC, before withdrawing anonymous access. RLS policies stay intact.
DO $$
DECLARE
  tbl text;
  app_role text;
  privilege text;
  retained_privileges text[];
  retained_roles text[];
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ventas_pagos', 'stock_movimientos'] LOOP
    retained_privileges := ARRAY[]::text[];
    retained_roles := ARRAY[]::text[];
    FOREACH app_role IN ARRAY ARRAY['authenticated', 'service_role'] LOOP
      FOREACH privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(app_role, 'public.' || tbl, privilege) THEN
          retained_privileges := array_append(retained_privileges, privilege);
          retained_roles := array_append(retained_roles, app_role);
        END IF;
      END LOOP;
    END LOOP;
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon', tbl);
    FOR idx IN 1..coalesce(array_length(retained_privileges, 1), 0) LOOP
      EXECUTE format('GRANT %s ON TABLE public.%I TO %I', retained_privileges[idx], tbl, retained_roles[idx]);
    END LOOP;
  END LOOP;
END $$;

-- No public catalogue flow invokes these financial/inventory RPCs anonymously.
-- Retain the existing signed-in path until its scope checks are reviewed.
DO $$
DECLARE
  fn record;
  matched integer := 0;
  auth_allowed boolean;
  service_allowed boolean;
BEGIN
  FOR fn IN
    SELECT p.oid, p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'descontar_stock', 'crear_venta_completa', 'crear_venta_completa_segura',
      'increase_inventory_stock', 'reduce_inventory_stock', 'eliminar_venta_con_restock'
    )
  LOOP
    auth_allowed := has_function_privilege('authenticated', fn.oid, 'EXECUTE');
    service_allowed := has_function_privilege('service_role', fn.oid, 'EXECUTE');
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
    IF auth_allowed THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.signature); END IF;
    IF service_allowed THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature); END IF;
    IF has_function_privilege('anon', fn.oid, 'EXECUTE') THEN RAISE EXCEPTION 'Anonymous execution remains for %', fn.signature; END IF;
    matched := matched + 1;
  END LOOP;
  IF matched <> 6 THEN RAISE EXCEPTION 'Expected 6 inspected business functions, found %', matched; END IF;
END $$;
COMMIT;

-- Verify with scripts/audit-database-readonly.mjs: anon must return 401/403
-- or */0 for all three tables. Then test authenticated stock/payment screens.
-- Restore prior ACL/policies from the schema backup if authenticated regressions occur.
