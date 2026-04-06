-- HOTFIX RLS SOLO PARA VENTAS
-- Ejecutar en Supabase SQL Editor cuando falle INSERT en ventas_detalle

begin;

alter table if exists public.ventas enable row level security;
alter table if exists public.ventas_detalle enable row level security;

-- Limpiar solo politicas de ventas
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('ventas', 'ventas_detalle')
  LOOP
    EXECUTE format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Permisos base para rol authenticated
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.ventas to authenticated;
grant select, insert, update, delete on table public.ventas_detalle to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Politicas ventas
create policy "ventas_auth_select"
on public.ventas
for select
to authenticated
using (true);

create policy "ventas_auth_insert"
on public.ventas
for insert
to authenticated
with check (true);

create policy "ventas_auth_update"
on public.ventas
for update
to authenticated
using (true)
with check (true);

create policy "ventas_auth_delete"
on public.ventas
for delete
to authenticated
using (true);

-- Politicas ventas_detalle
create policy "ventas_detalle_auth_select"
on public.ventas_detalle
for select
to authenticated
using (true);

create policy "ventas_detalle_auth_insert"
on public.ventas_detalle
for insert
to authenticated
with check (true);

create policy "ventas_detalle_auth_update"
on public.ventas_detalle
for update
to authenticated
using (true)
with check (true);

create policy "ventas_detalle_auth_delete"
on public.ventas_detalle
for delete
to authenticated
using (true);

commit;

-- Verificacion
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname='public' and tablename in ('ventas','ventas_detalle')
-- order by tablename, policyname;
