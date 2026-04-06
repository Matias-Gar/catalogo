-- RLS bootstrap para modulo de ventas y flujo de caja
-- Objetivo: evitar errores de "new row violates row-level security policy"
-- Ejecutar en Supabase SQL Editor

begin;

-- 1) Asegurar RLS habilitado en tablas del modulo
alter table if exists public.ventas enable row level security;
alter table if exists public.ventas_detalle enable row level security;
alter table if exists public.clientes enable row level security;
alter table if exists public.carritos_pendientes enable row level security;
alter table if exists public.cash_movements enable row level security;
alter table if exists public.cash_closures enable row level security;

-- 2) Limpiar politicas existentes para evitar conflictos de nombres/condiciones
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'ventas',
        'ventas_detalle',
        'clientes',
        'carritos_pendientes',
        'cash_movements',
        'cash_closures'
      )
  LOOP
    EXECUTE format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- 3) Conceder permisos base a usuarios autenticados
-- (si ya existen, Postgres simplemente mantiene el estado)
grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.ventas to authenticated;
grant select, insert, update, delete on table public.ventas_detalle to authenticated;
grant select, insert, update, delete on table public.clientes to authenticated;
grant select, insert, update, delete on table public.carritos_pendientes to authenticated;
grant select, insert, update, delete on table public.cash_movements to authenticated;
grant select, insert, update, delete on table public.cash_closures to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- 4) Politicas permisivas para usuarios autenticados (modo operativo sin bloqueos)
-- Ventas
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

-- Ventas detalle
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

-- Clientes
create policy "clientes_auth_select"
on public.clientes
for select
to authenticated
using (true);

create policy "clientes_auth_insert"
on public.clientes
for insert
to authenticated
with check (true);

create policy "clientes_auth_update"
on public.clientes
for update
to authenticated
using (true)
with check (true);

create policy "clientes_auth_delete"
on public.clientes
for delete
to authenticated
using (true);

-- Carritos pendientes
create policy "carritos_auth_select"
on public.carritos_pendientes
for select
to authenticated
using (true);

create policy "carritos_auth_insert"
on public.carritos_pendientes
for insert
to authenticated
with check (true);

create policy "carritos_auth_update"
on public.carritos_pendientes
for update
to authenticated
using (true)
with check (true);

create policy "carritos_auth_delete"
on public.carritos_pendientes
for delete
to authenticated
using (true);

-- Movimientos de caja
create policy "cash_mov_auth_select"
on public.cash_movements
for select
to authenticated
using (true);

create policy "cash_mov_auth_insert"
on public.cash_movements
for insert
to authenticated
with check (true);

create policy "cash_mov_auth_update"
on public.cash_movements
for update
to authenticated
using (true)
with check (true);

create policy "cash_mov_auth_delete"
on public.cash_movements
for delete
to authenticated
using (true);

-- Cierres de caja
create policy "cash_close_auth_select"
on public.cash_closures
for select
to authenticated
using (true);

create policy "cash_close_auth_insert"
on public.cash_closures
for insert
to authenticated
with check (true);

create policy "cash_close_auth_update"
on public.cash_closures
for update
to authenticated
using (true)
with check (true);

create policy "cash_close_auth_delete"
on public.cash_closures
for delete
to authenticated
using (true);

commit;

-- Verificacion rapida (opcional)
-- select tablename, policyname, permissive, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('ventas','ventas_detalle','clientes','carritos_pendientes','cash_movements','cash_closures')
-- order by tablename, policyname;
