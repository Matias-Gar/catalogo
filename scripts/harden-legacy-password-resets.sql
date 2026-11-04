-- Prepared for review. Do not run in production without explicit authorization.
-- The login UI uses Supabase Auth recovery links, not this legacy code table.
-- No changes to carts, stock, sales or their policies.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.password_resets FROM PUBLIC, anon, authenticated;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
COMMIT;
