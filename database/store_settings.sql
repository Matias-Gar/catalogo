-- Store settings schema + RLS (Supabase/PostgreSQL)
-- Run this in Supabase SQL editor.

create table if not exists public.app_settings (
  key text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_app_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_app_settings_updated_at();

alter table public.app_settings enable row level security;

drop policy if exists "Public can read app settings" on public.app_settings;
drop policy if exists "Authenticated can insert app settings" on public.app_settings;
drop policy if exists "Authenticated can update app settings" on public.app_settings;
drop policy if exists "Authenticated can delete app settings" on public.app_settings;
drop policy if exists "Admins can insert app settings" on public.app_settings;
drop policy if exists "Admins can update app settings" on public.app_settings;
drop policy if exists "Admins can delete app settings" on public.app_settings;
drop policy if exists "Los administradores pueden insertar configuraciones de la aplicación" on public.app_settings;
drop policy if exists "Los administradores pueden actualizar configuraciones de la aplicación" on public.app_settings;
drop policy if exists "Los administradores pueden eliminar configuraciones de la aplicación" on public.app_settings;

create policy "Public can read app settings"
on public.app_settings
for select
using (true);

create policy "Admins can insert app settings"
on public.app_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles
    where perfiles.id = auth.uid()
      and perfiles.rol = 'admin'
  )
);

create policy "Admins can update app settings"
on public.app_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles
    where perfiles.id = auth.uid()
      and perfiles.rol = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.perfiles
    where perfiles.id = auth.uid()
      and perfiles.rol = 'admin'
  )
);

create policy "Admins can delete app settings"
on public.app_settings
for delete
to authenticated
using (
  exists (
    select 1
    from public.perfiles
    where perfiles.id = auth.uid()
      and perfiles.rol = 'admin'
  )
);
