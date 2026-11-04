-- Prepared only; requires review, isolated validation and production authorization.
-- These functions are called through authenticated server endpoints, or have no
-- browser consumers in the audited repository. Cart table permissions are untouched.
-- The legacy sale-restock browser flow needs its own endpoint before hardening it.
BEGIN;
DO $audit$
DECLARE fn record; matched integer := 0;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure signature, p.proname, md5(p.prosrc) body_md5,
           expected.body_md5 expected_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN (VALUES
      ('descontar_stock', 'c1a912fef5fc3b30f09ab1afa0d18ba2'),
      ('crear_venta_completa', '95ea97fd177da355b9e259f674648dc1'),
      ('crear_venta_completa_segura', '858e77a6d170d84f15be6482ad1c0138'),
      ('increase_inventory_stock', '09f790f6cdaecb7a32b0e84dd1c79d9c'),
      ('reduce_inventory_stock', '14ac6a69112059b72bc4d4e573f4dd3d')
    ) expected(name,body_md5) ON expected.name = p.proname
    WHERE n.nspname = 'public'
  LOOP
    IF fn.body_md5 <> fn.expected_md5 THEN
      RAISE EXCEPTION 'Function % changed since audit; review before applying', fn.proname;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
    matched := matched + 1;
  END LOOP;
  IF matched <> 5 THEN
    RAISE EXCEPTION 'Expected exactly 5 audited functions, found %', matched;
  END IF;
END;
$audit$;
COMMIT;
