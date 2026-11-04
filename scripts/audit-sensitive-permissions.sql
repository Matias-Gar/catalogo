-- Read-only metadata. Does not return customer data or recovery codes.
BEGIN READ ONLY;
SELECT current_database() AS database, current_user AS inspecting_role;
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('password_resets', 'ventas_pagos', 'stock_movimientos');
SELECT table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name IN ('password_resets', 'ventas_pagos', 'stock_movimientos')
ORDER BY table_name, grantee, privilege_type;
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
AND tablename IN ('password_resets', 'ventas_pagos', 'stock_movimientos')
ORDER BY tablename, policyname;
SELECT p.oid::regprocedure AS function_signature, p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('descontar_stock', 'crear_venta_completa',
  'crear_venta_completa_segura', 'increase_inventory_stock', 'reduce_inventory_stock', 'eliminar_venta_con_restock')
ORDER BY p.proname;
COMMIT;
