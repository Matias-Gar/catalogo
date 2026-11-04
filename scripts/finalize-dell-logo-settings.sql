-- Prepared for review; production execution requires explicit authorization.
-- Changes only three logo URLs. No sales, stock, accounts, permissions or other settings change.
BEGIN;
DO $audit$
DECLARE changed integer;
BEGIN
  UPDATE public.app_settings
    SET settings = jsonb_set(settings, '{store_logo_url}', to_jsonb('https://garblac.duckdns.org/storage/v1/object/public/product_images/store/logo-c6a4346c-e139-4250-9855-ac048733293d.jpg'::text), false)
    WHERE key::text = 'global_store_settings' AND settings->>'store_logo_url' = 'https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/product_images/store/logo-c6a4346c-e139-4250-9855-ac048733293d.jpg';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Logo setting changed since audit; rollback required'; END IF;
  UPDATE public.pais_settings
    SET settings = jsonb_set(settings, '{store_logo_url}', to_jsonb('https://garblac.duckdns.org/storage/v1/object/public/product_images/store/logo-53b2b5eb-9a60-4129-a627-6cbfa47c5027.jpg'::text), false)
    WHERE pais_id::text = '31c58f8a-3d08-4869-a94b-78e43010847e' AND settings->>'store_logo_url' = 'https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/product_images/store/logo-53b2b5eb-9a60-4129-a627-6cbfa47c5027.jpg';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Logo setting changed since audit; rollback required'; END IF;
  UPDATE public.pais_settings
    SET settings = jsonb_set(settings, '{store_logo_url}', to_jsonb('https://garblac.duckdns.org/storage/v1/object/public/product_images/store/logo-6c274002-2dca-4616-947a-577fb77b6904.jpeg'::text), false)
    WHERE pais_id::text = '51bb19a9-e12a-40c3-884e-93b13ac9dee9' AND settings->>'store_logo_url' = 'https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/product_images/store/logo-6c274002-2dca-4616-947a-577fb77b6904.jpeg';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Logo setting changed since audit; rollback required'; END IF;
END;
$audit$;
COMMIT;
