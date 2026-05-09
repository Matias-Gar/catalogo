-- Enable multi-pais support for Street Wear.
-- Run in Supabase SQL Editor. Idempotent: safe to run more than once.
--
-- Base model:
-- paises -> sucursales -> operational data.
-- Public links stay separated by country slug: /bo, /cl, /bo/productos, /cl/productos.

begin;

create extension if not exists pgcrypto;

create table if not exists public.paises (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  codigo_iso text,
  moneda_codigo text,
  moneda_simbolo text,
  whatsapp text,
  direccion text,
  activa boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usuario_paises (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  pais_id uuid not null references public.paises(id) on delete cascade,
  rol text not null check (rol in ('owner', 'admin', 'administracion', 'vendedor', 'almacen')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (usuario_id, pais_id)
);

create table if not exists public.pais_settings (
  pais_id uuid primary key references public.paises(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.paises (nombre, slug, codigo_iso, moneda_codigo, moneda_simbolo, activa)
values
  ('Bolivia', 'bo', 'BO', 'BOB', 'Bs', true),
  ('Chile', 'cl', 'CL', 'CLP', '$', true)
on conflict (slug) do update
set nombre = excluded.nombre,
    codigo_iso = excluded.codigo_iso,
    moneda_codigo = excluded.moneda_codigo,
    moneda_simbolo = excluded.moneda_simbolo,
    activa = true,
    updated_at = now();

insert into public.pais_settings (pais_id, settings)
select id, '{}'::jsonb
from public.paises
on conflict (pais_id) do nothing;

alter table public.sucursales add column if not exists pais_id uuid;

update public.sucursales s
set pais_id = p.id
from public.paises p
where s.pais_id is null
  and p.slug = case
    when lower(coalesce(s.nombre, '') || ' ' || coalesce(s.slug, '') || ' ' || coalesce(s.direccion, '')) ~ '(chile|santiago|cl)' then 'cl'
    else 'bo'
  end;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sucursales_pais_id_fkey'
      and conrelid = 'public.sucursales'::regclass
  ) then
    alter table public.sucursales
      add constraint sucursales_pais_id_fkey foreign key (pais_id) references public.paises(id);
  end if;
end $$;

alter table public.sucursales alter column pais_id set not null;

alter table public.carritos_pendientes add column if not exists pais_id uuid;
alter table public.cash_closures add column if not exists pais_id uuid;
alter table public.cash_movements add column if not exists pais_id uuid;
alter table public.categorias add column if not exists pais_id uuid;
alter table public.clientes add column if not exists pais_id uuid;
alter table public.pack_productos add column if not exists pais_id uuid;
alter table public.packs add column if not exists pais_id uuid;
alter table public.producto_imagenes add column if not exists pais_id uuid;
alter table public.producto_variantes add column if not exists pais_id uuid;
alter table public.productos add column if not exists pais_id uuid;
alter table public.productos_historial add column if not exists pais_id uuid;
alter table public.promociones add column if not exists pais_id uuid;
alter table public.stock_movimientos add column if not exists pais_id uuid;
alter table public.ventas add column if not exists pais_id uuid;
alter table public.ventas_detalle add column if not exists pais_id uuid;
alter table public.ventas_pagos add column if not exists pais_id uuid;
alter table public.packs add column if not exists fecha_fin date;

update public.carritos_pendientes t set pais_id = s.pais_id from public.sucursales s where t.sucursal_id = s.id and t.pais_id is null;
update public.cash_closures t set pais_id = s.pais_id from public.sucursales s where t.sucursal_id = s.id and t.pais_id is null;
update public.cash_movements t set pais_id = s.pais_id from public.sucursales s where t.sucursal_id = s.id and t.pais_id is null;
update public.categorias t set pais_id = s.pais_id from public.sucursales s where t.sucursal_id = s.id and t.pais_id is null;
update public.clientes t set pais_id = s.pais_id from public.sucursales s where t.sucursal_id = s.id and t.pais_id is null;
update public.packs t set pais_id = s.pais_id from public.sucursales s where t.sucursal_id = s.id and t.pais_id is null;
update public.productos t set pais_id = s.pais_id from public.sucursales s where t.sucursal_id = s.id and t.pais_id is null;
update public.ventas t set pais_id = s.pais_id from public.sucursales s where t.sucursal_id = s.id and t.pais_id is null;

update public.producto_variantes t set pais_id = p.pais_id from public.productos p where t.producto_id = p.user_id and t.pais_id is null;
update public.producto_imagenes t set pais_id = p.pais_id from public.productos p where t.producto_id = p.user_id and t.pais_id is null;
update public.promociones t set pais_id = p.pais_id from public.productos p where t.producto_id = p.user_id and t.pais_id is null;
update public.productos_historial t set pais_id = p.pais_id from public.productos p where t.producto_id = p.user_id and t.pais_id is null;
update public.stock_movimientos t set pais_id = p.pais_id from public.productos p where t.producto_id = p.user_id and t.pais_id is null;
update public.pack_productos t set pais_id = p.pais_id from public.packs p where t.pack_id = p.id and t.pais_id is null;
update public.ventas_detalle t set pais_id = v.pais_id from public.ventas v where t.venta_id = v.id and t.pais_id is null;
update public.ventas_pagos t set pais_id = v.pais_id from public.ventas v where t.venta_id = v.id and t.pais_id is null;

-- Repair rows that point to deleted/old sucursales.
-- They are moved to the first active branch in their own country; if country is missing, Bolivia is used.
with fallback as (
  select distinct on (s.pais_id) s.pais_id, s.id as sucursal_id
  from public.sucursales s
  where s.activa = true
  order by s.pais_id, s.created_at asc
),
default_country as (
  select id as pais_id from public.paises where slug = 'bo' limit 1
),
default_branch as (
  select s.id as sucursal_id, s.pais_id
  from public.sucursales s
  join default_country dc on dc.pais_id = s.pais_id
  where s.activa = true
  order by s.created_at asc
  limit 1
)
update public.productos p
set
  pais_id = coalesce(p.pais_id, (select pais_id from default_branch)),
  sucursal_id = coalesce(
    (select f.sucursal_id from fallback f where f.pais_id = coalesce(p.pais_id, (select pais_id from default_branch))),
    (select sucursal_id from default_branch)
  )
where not exists (select 1 from public.sucursales s where s.id = p.sucursal_id);

with fallback as (
  select distinct on (s.pais_id) s.pais_id, s.id as sucursal_id
  from public.sucursales s
  where s.activa = true
  order by s.pais_id, s.created_at asc
),
default_country as (
  select id as pais_id from public.paises where slug = 'bo' limit 1
),
default_branch as (
  select s.id as sucursal_id, s.pais_id
  from public.sucursales s
  join default_country dc on dc.pais_id = s.pais_id
  where s.activa = true
  order by s.created_at asc
  limit 1
)
update public.categorias t
set
  pais_id = coalesce(t.pais_id, (select pais_id from default_branch)),
  sucursal_id = coalesce(
    (select f.sucursal_id from fallback f where f.pais_id = coalesce(t.pais_id, (select pais_id from default_branch))),
    (select sucursal_id from default_branch)
  )
where not exists (select 1 from public.sucursales s where s.id = t.sucursal_id);

with fallback as (
  select distinct on (s.pais_id) s.pais_id, s.id as sucursal_id
  from public.sucursales s
  where s.activa = true
  order by s.pais_id, s.created_at asc
),
default_country as (
  select id as pais_id from public.paises where slug = 'bo' limit 1
),
default_branch as (
  select s.id as sucursal_id, s.pais_id
  from public.sucursales s
  join default_country dc on dc.pais_id = s.pais_id
  where s.activa = true
  order by s.created_at asc
  limit 1
)
update public.packs t
set
  pais_id = coalesce(t.pais_id, (select pais_id from default_branch)),
  sucursal_id = coalesce(
    (select f.sucursal_id from fallback f where f.pais_id = coalesce(t.pais_id, (select pais_id from default_branch))),
    (select sucursal_id from default_branch)
  )
where not exists (select 1 from public.sucursales s where s.id = t.sucursal_id);

with fallback as (
  select distinct on (s.pais_id) s.pais_id, s.id as sucursal_id
  from public.sucursales s
  where s.activa = true
  order by s.pais_id, s.created_at asc
),
default_country as (
  select id as pais_id from public.paises where slug = 'bo' limit 1
),
default_branch as (
  select s.id as sucursal_id, s.pais_id
  from public.sucursales s
  join default_country dc on dc.pais_id = s.pais_id
  where s.activa = true
  order by s.created_at asc
  limit 1
)
update public.ventas t
set
  pais_id = coalesce(t.pais_id, (select pais_id from default_branch)),
  sucursal_id = coalesce(
    (select f.sucursal_id from fallback f where f.pais_id = coalesce(t.pais_id, (select pais_id from default_branch))),
    (select sucursal_id from default_branch)
  )
where not exists (select 1 from public.sucursales s where s.id = t.sucursal_id);

update public.carritos_pendientes set pais_id = public.sucursales.pais_id from public.sucursales where public.carritos_pendientes.pais_id is null and public.carritos_pendientes.sucursal_id = public.sucursales.id;
update public.cash_closures set pais_id = public.sucursales.pais_id from public.sucursales where public.cash_closures.pais_id is null and public.cash_closures.sucursal_id = public.sucursales.id;
update public.cash_movements set pais_id = public.sucursales.pais_id from public.sucursales where public.cash_movements.pais_id is null and public.cash_movements.sucursal_id = public.sucursales.id;
update public.categorias set pais_id = public.sucursales.pais_id from public.sucursales where public.categorias.pais_id is null and public.categorias.sucursal_id = public.sucursales.id;
update public.clientes set pais_id = public.sucursales.pais_id from public.sucursales where public.clientes.pais_id is null and public.clientes.sucursal_id = public.sucursales.id;
update public.packs set pais_id = public.sucursales.pais_id from public.sucursales where public.packs.pais_id is null and public.packs.sucursal_id = public.sucursales.id;
update public.productos set pais_id = public.sucursales.pais_id from public.sucursales where public.productos.pais_id is null and public.productos.sucursal_id = public.sucursales.id;
update public.ventas set pais_id = public.sucursales.pais_id from public.sucursales where public.ventas.pais_id is null and public.ventas.sucursal_id = public.sucursales.id;

update public.producto_variantes t
set pais_id = p.pais_id, sucursal_id = p.sucursal_id
from public.productos p
where t.producto_id = p.user_id
  and (t.pais_id is distinct from p.pais_id or t.sucursal_id is distinct from p.sucursal_id);

update public.producto_imagenes t
set pais_id = p.pais_id, sucursal_id = p.sucursal_id
from public.productos p
where t.producto_id = p.user_id
  and (t.pais_id is distinct from p.pais_id or t.sucursal_id is distinct from p.sucursal_id);

update public.promociones t
set pais_id = p.pais_id, sucursal_id = p.sucursal_id
from public.productos p
where t.producto_id = p.user_id
  and (t.pais_id is distinct from p.pais_id or t.sucursal_id is distinct from p.sucursal_id);

update public.productos_historial t
set pais_id = p.pais_id, sucursal_id = p.sucursal_id
from public.productos p
where t.producto_id = p.user_id
  and (t.pais_id is distinct from p.pais_id or t.sucursal_id is distinct from p.sucursal_id);

update public.stock_movimientos t
set pais_id = p.pais_id, sucursal_id = p.sucursal_id
from public.productos p
where t.producto_id = p.user_id
  and (t.pais_id is distinct from p.pais_id or t.sucursal_id is distinct from p.sucursal_id);

update public.pack_productos t
set pais_id = p.pais_id, sucursal_id = p.sucursal_id
from public.packs p
where t.pack_id = p.id
  and (t.pais_id is distinct from p.pais_id or t.sucursal_id is distinct from p.sucursal_id);

update public.ventas_detalle t
set pais_id = v.pais_id, sucursal_id = v.sucursal_id
from public.ventas v
where t.venta_id = v.id
  and (t.pais_id is distinct from v.pais_id or t.sucursal_id is distinct from v.sucursal_id);

update public.ventas_pagos t
set pais_id = v.pais_id, sucursal_id = v.sucursal_id
from public.ventas v
where t.venta_id = v.id
  and (t.pais_id is distinct from v.pais_id or t.sucursal_id is distinct from v.sucursal_id);

do $$
declare
  t text;
  constraint_name text;
begin
  foreach t in array array[
    'carritos_pendientes',
    'cash_closures',
    'cash_movements',
    'categorias',
    'clientes',
    'pack_productos',
    'packs',
    'producto_imagenes',
    'producto_variantes',
    'productos',
    'productos_historial',
    'promociones',
    'stock_movimientos',
    'ventas',
    'ventas_detalle',
    'ventas_pagos'
  ]
  loop
    constraint_name := t || '_pais_id_fkey';
    if not exists (
      select 1 from pg_constraint
      where conname = constraint_name
        and conrelid = format('public.%I', t)::regclass
    ) then
      execute format('alter table public.%I add constraint %I foreign key (pais_id) references public.paises(id)', t, constraint_name);
    end if;
  end loop;
end $$;

create index if not exists idx_sucursales_pais on public.sucursales(pais_id, activa);
create index if not exists idx_usuario_paises_usuario on public.usuario_paises(usuario_id, activo);
create index if not exists idx_usuario_paises_pais on public.usuario_paises(pais_id, rol, activo);
create index if not exists idx_carritos_pendientes_pais_sucursal_fecha on public.carritos_pendientes(pais_id, sucursal_id, fecha desc);
create index if not exists idx_categorias_pais_sucursal on public.categorias(pais_id, sucursal_id, categori);
create index if not exists idx_clientes_pais_sucursal on public.clientes(pais_id, sucursal_id, created_at desc);
create index if not exists idx_packs_pais_sucursal on public.packs(pais_id, sucursal_id, activo);
create index if not exists idx_packs_fecha_fin on public.packs(fecha_fin);
create index if not exists idx_pack_productos_pais_sucursal on public.pack_productos(pais_id, sucursal_id, pack_id, producto_id);
create index if not exists idx_producto_imagenes_pais_sucursal on public.producto_imagenes(pais_id, sucursal_id, producto_id);
create index if not exists idx_producto_variantes_pais_sucursal on public.producto_variantes(pais_id, sucursal_id, producto_id, activo);
create index if not exists idx_productos_pais_sucursal on public.productos(pais_id, sucursal_id, vista_producto, category_id);
create index if not exists idx_promociones_pais_sucursal on public.promociones(pais_id, sucursal_id, producto_id, activa);
create index if not exists idx_stock_movimientos_pais_sucursal on public.stock_movimientos(pais_id, sucursal_id, producto_id, created_at desc);
create index if not exists idx_ventas_pais_sucursal_fecha on public.ventas(pais_id, sucursal_id, fecha desc);
create index if not exists idx_ventas_detalle_pais_sucursal on public.ventas_detalle(pais_id, sucursal_id, venta_id, producto_id);
create index if not exists idx_ventas_pagos_pais_sucursal on public.ventas_pagos(pais_id, sucursal_id, venta_id, fecha desc);

insert into public.usuario_paises (usuario_id, pais_id, rol, activo)
select p.id, country.id, 'admin', true
from public.perfiles p
cross join public.paises country
where lower(coalesce(p.rol, '')) = 'admin'
on conflict (usuario_id, pais_id) do update
set rol = excluded.rol,
    activo = true;

insert into public.usuario_paises (usuario_id, pais_id, rol, activo)
select distinct
  us.usuario_id,
  s.pais_id,
  case when us.rol in ('admin', 'administracion', 'vendedor', 'almacen') then us.rol else 'vendedor' end,
  us.activo
from public.usuario_sucursales us
join public.sucursales s on s.id = us.sucursal_id
where s.pais_id is not null
on conflict (usuario_id, pais_id) do update
set rol = excluded.rol,
    activo = excluded.activo;

create or replace function public.default_pais_id()
returns uuid
language sql
security definer
set search_path = public, auth
stable
as $$
  select id from public.paises where slug = 'bo' limit 1
$$;

create or replace function public.set_sucursal_default_pais()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.pais_id is null then
    new.pais_id := public.default_pais_id();
  end if;
  return new;
end;
$$;

create or replace function public.sync_pais_from_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_pais_id uuid;
begin
  if new.sucursal_id is null then
    new.sucursal_id := public.default_sucursal_id();
  end if;

  select s.pais_id into v_pais_id
  from public.sucursales s
  where s.id = new.sucursal_id;

  if v_pais_id is null then
    raise exception 'Sucursal no encontrada para pais (%)', new.sucursal_id;
  end if;

  if new.pais_id is null then
    new.pais_id := v_pais_id;
  elsif new.pais_id <> v_pais_id then
    raise exception 'La sucursal no pertenece al pais seleccionado';
  end if;

  return new;
end;
$$;

create or replace function public.sync_producto_child_pais()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_pais_id uuid;
  v_sucursal_id uuid;
begin
  select p.pais_id, p.sucursal_id into v_pais_id, v_sucursal_id
  from public.productos p
  where p.user_id = new.producto_id;

  if v_pais_id is null then
    raise exception 'Producto no encontrado para pais (%)', new.producto_id;
  end if;

  if new.pais_id is null then new.pais_id := v_pais_id; end if;
  if new.sucursal_id is null then new.sucursal_id := v_sucursal_id; end if;
  if new.pais_id <> v_pais_id or new.sucursal_id <> v_sucursal_id then
    raise exception 'El detalle no coincide con el pais/sucursal del producto';
  end if;

  return new;
end;
$$;

create or replace function public.sync_pack_productos_pais()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_pack_pais_id uuid;
  v_pack_sucursal_id uuid;
  v_producto_pais_id uuid;
  v_producto_sucursal_id uuid;
begin
  select pais_id, sucursal_id into v_pack_pais_id, v_pack_sucursal_id from public.packs where id = new.pack_id;
  select pais_id, sucursal_id into v_producto_pais_id, v_producto_sucursal_id from public.productos where user_id = new.producto_id;

  if v_pack_pais_id is null then raise exception 'Pack no encontrado (%)', new.pack_id; end if;
  if v_producto_pais_id is null then raise exception 'Producto no encontrado para pack (%)', new.producto_id; end if;
  if v_pack_pais_id <> v_producto_pais_id or v_pack_sucursal_id <> v_producto_sucursal_id then
    raise exception 'El producto y el pack deben pertenecer al mismo pais/sucursal';
  end if;

  if new.pais_id is null then new.pais_id := v_pack_pais_id; end if;
  if new.sucursal_id is null then new.sucursal_id := v_pack_sucursal_id; end if;
  if new.pais_id <> v_pack_pais_id or new.sucursal_id <> v_pack_sucursal_id then
    raise exception 'pack_productos no coincide con el pais/sucursal del pack';
  end if;

  return new;
end;
$$;

create or replace function public.sync_venta_child_pais()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_pais_id uuid;
  v_sucursal_id uuid;
begin
  select pais_id, sucursal_id into v_pais_id, v_sucursal_id from public.ventas where id = new.venta_id;
  if v_pais_id is null then raise exception 'Venta no encontrada (%)', new.venta_id; end if;

  if new.pais_id is null then new.pais_id := v_pais_id; end if;
  if new.sucursal_id is null then new.sucursal_id := v_sucursal_id; end if;
  if new.pais_id <> v_pais_id or new.sucursal_id <> v_sucursal_id then
    raise exception 'El detalle/pago no coincide con el pais/sucursal de la venta';
  end if;

  return new;
end;
$$;

create or replace function public.crear_venta_completa(
  p_venta jsonb,
  p_items jsonb,
  p_pagos jsonb default '[]'::jsonb,
  p_usuario_id uuid default null,
  p_usuario_email text default null,
  p_cashbox_id text default 'main'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_venta_id bigint;
  v_item jsonb;
  v_pago jsonb;
  v_producto record;
  v_variante record;
  v_detalle_id bigint;
  v_producto_id bigint;
  v_variante_id bigint;
  v_qty_visible numeric;
  v_qty_visible_db numeric;
  v_qty_base numeric;
  v_unidad text;
  v_unidad_base text;
  v_factor numeric;
  v_has_conversion boolean;
  v_stock_antes numeric;
  v_stock_despues numeric;
  v_precio_unitario numeric;
  v_costo_unitario numeric;
  v_color text;
  v_descripcion text;
  v_metodo text;
  v_monto numeric;
  v_pais_id uuid;
  v_sucursal_id uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene items';
  end if;

  v_pais_id := nullif(p_venta->>'pais_id', '')::uuid;
  v_sucursal_id := nullif(p_venta->>'sucursal_id', '')::uuid;

  if v_sucursal_id is null then
    raise exception 'Selecciona una sucursal para la venta';
  end if;

  select s.pais_id into v_pais_id
  from public.sucursales s
  where s.id = v_sucursal_id
    and (v_pais_id is null or s.pais_id = v_pais_id);

  if v_pais_id is null then
    raise exception 'Sucursal no encontrada para pais (%)', v_sucursal_id;
  end if;

  insert into public.ventas (
    cliente_nombre,
    cliente_telefono,
    cliente_email,
    cliente_nit,
    requiere_factura,
    modo_pago,
    total,
    pago,
    cambio,
    usuario_id,
    usuario_email,
    descuentos,
    costos_extra,
    estado,
    finalized_at,
    cashbox_id,
    pais_id,
    sucursal_id
  )
  values (
    coalesce(p_venta->>'cliente_nombre', ''),
    coalesce(p_venta->>'cliente_telefono', ''),
    coalesce(p_venta->>'cliente_email', ''),
    coalesce(p_venta->>'cliente_nit', ''),
    coalesce((p_venta->>'requiere_factura')::boolean, false),
    coalesce(p_venta->>'modo_pago', ''),
    coalesce((p_venta->>'total')::numeric, 0),
    coalesce((p_venta->>'pago')::numeric, 0),
    coalesce((p_venta->>'cambio')::numeric, 0),
    p_usuario_id,
    p_usuario_email,
    coalesce((p_venta->>'descuentos')::numeric, 0),
    coalesce(p_venta->'costos_extra', '{}'::jsonb),
    'efectivizada',
    now(),
    coalesce(p_cashbox_id, 'main'),
    v_pais_id,
    v_sucursal_id
  )
  returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_producto_id := nullif(v_item->>'producto_id', '')::bigint;
    v_variante_id := nullif(v_item->>'variante_id', '')::bigint;
    v_qty_visible := coalesce((v_item->>'cantidad')::numeric, (v_item->>'cantidad_display')::numeric, 1);
    v_qty_visible_db := greatest(1, round(v_qty_visible));
    v_unidad := coalesce(nullif(v_item->>'unidad', ''), 'unidad');
    v_precio_unitario := coalesce((v_item->>'precio_unitario')::numeric, (v_item->>'precio')::numeric, 0);
    v_costo_unitario := coalesce((v_item->>'costo_unitario')::numeric, 0);
    v_color := nullif(v_item->>'color', '');
    v_descripcion := coalesce(nullif(v_item->>'descripcion', ''), nullif(v_item->>'nombre', ''), 'Producto');

    select
      p.user_id,
      p.nombre,
      coalesce(p.stock, 0)::numeric as stock,
      coalesce(p.precio, 0)::numeric as precio,
      coalesce(p.precio_compra, 0)::numeric as precio_compra,
      coalesce(nullif(p.unidad_base, ''), v_unidad, 'unidad') as unidad_base,
      coalesce(p.factor_conversion, 0)::numeric as factor_conversion,
      coalesce(cardinality(p.unidades_alternativas), 0) as alternativas_count,
      p.pais_id,
      p.sucursal_id
    into v_producto
    from public.productos p
    where p.user_id = v_producto_id
      and p.pais_id = v_pais_id
      and p.sucursal_id = v_sucursal_id;

    if not found then
      raise exception 'Producto no encontrado para pais/sucursal (%)', v_producto_id;
    end if;

    v_unidad_base := coalesce(v_producto.unidad_base, v_unidad, 'unidad');
    v_factor := v_producto.factor_conversion;
    v_has_conversion := v_factor > 0 and v_producto.alternativas_count > 0;
    v_qty_base := coalesce((v_item->>'cantidad_base')::numeric, null);
    if v_qty_base is null then
      v_qty_base := case
        when v_has_conversion and v_unidad <> v_unidad_base then v_qty_visible / v_factor
        else v_qty_visible
      end;
    end if;

    if v_has_conversion then
      v_stock_antes := v_producto.stock;
    elsif v_variante_id is not null then
      select pv.id, pv.color, coalesce(nullif(pv.stock_decimal, 0), pv.stock, 0)::numeric as stock
      into v_variante
      from public.producto_variantes pv
      where pv.id = v_variante_id
        and pv.pais_id = v_pais_id
        and pv.sucursal_id = v_sucursal_id;
      if not found then
        raise exception 'Variante no encontrada (%)', v_variante_id;
      end if;
      v_stock_antes := v_variante.stock;
      v_color := coalesce(v_color, v_variante.color);
    else
      v_stock_antes := v_producto.stock;
    end if;

    if v_qty_base > v_stock_antes + 0.0001 then
      raise exception 'Stock insuficiente para % (stock=% , solicitado=%)',
        coalesce(v_color, v_producto.nombre, 'producto'),
        round(v_stock_antes, 3),
        round(v_qty_base, 3);
    end if;

    insert into public.ventas_detalle (
      venta_id,
      producto_id,
      cantidad,
      cantidad_base,
      unidad,
      precio_unitario,
      costo_unitario,
      variante_id,
      color,
      descripcion,
      tipo,
      created_at,
      usuario_email,
      pais_id,
      sucursal_id
    )
    values (
      v_venta_id,
      v_producto_id,
      v_qty_visible_db,
      v_qty_base,
      v_unidad,
      v_precio_unitario,
      v_costo_unitario,
      v_variante_id,
      v_color,
      v_descripcion,
      'producto',
      now(),
      p_usuario_email,
      v_pais_id,
      v_sucursal_id
    )
    returning id into v_detalle_id;

    v_stock_despues := greatest(0, v_stock_antes - v_qty_base);

    if v_has_conversion then
      update public.productos
      set stock = v_stock_despues
      where user_id = v_producto_id
        and pais_id = v_pais_id
        and sucursal_id = v_sucursal_id;

      if v_variante_id is not null then
        update public.producto_variantes
        set stock_decimal = v_stock_despues,
            stock = floor(v_stock_despues)
        where id = v_variante_id
          and pais_id = v_pais_id
          and sucursal_id = v_sucursal_id;
      end if;
    elsif v_variante_id is not null then
      update public.producto_variantes
      set stock_decimal = v_stock_despues,
          stock = floor(v_stock_despues)
      where id = v_variante_id
        and pais_id = v_pais_id
        and sucursal_id = v_sucursal_id;

      update public.productos
      set stock = (
        select coalesce(sum(coalesce(nullif(pv.stock_decimal, 0), pv.stock, 0)), 0)
        from public.producto_variantes pv
        where pv.producto_id = v_producto_id
          and pv.pais_id = v_pais_id
          and pv.sucursal_id = v_sucursal_id
          and coalesce(pv.activo, true) = true
      )
      where user_id = v_producto_id
        and pais_id = v_pais_id
        and sucursal_id = v_sucursal_id;
    else
      update public.productos
      set stock = v_stock_despues
      where user_id = v_producto_id
        and pais_id = v_pais_id
        and sucursal_id = v_sucursal_id;
    end if;

    insert into public.stock_movimientos (
      producto_id,
      variante_id,
      tipo,
      cantidad,
      unidad,
      cantidad_base,
      usuario_id,
      usuario_email,
      observaciones,
      stock_antes,
      stock_despues,
      venta_id,
      detalle_id,
      motivo,
      metadata,
      pais_id,
      sucursal_id
    )
    values (
      v_producto_id,
      v_variante_id,
      'venta',
      v_qty_visible,
      v_unidad,
      v_qty_base,
      p_usuario_id,
      p_usuario_email,
      'Salida automatica por venta #' || v_venta_id,
      v_stock_antes,
      v_stock_despues,
      v_venta_id,
      v_detalle_id,
      'venta_confirmada',
      jsonb_build_object('color', v_color, 'has_conversion', v_has_conversion),
      v_pais_id,
      v_sucursal_id
    );
  end loop;

  for v_pago in select * from jsonb_array_elements(coalesce(p_pagos, '[]'::jsonb))
  loop
    v_metodo := coalesce(v_pago->>'metodo_pago', v_pago->>'metodo', '');
    v_monto := coalesce((v_pago->>'monto')::numeric, 0);
    if v_metodo <> '' and v_monto > 0 then
      insert into public.ventas_pagos (venta_id, monto, metodo_pago, fecha, usuario_email, pais_id, sucursal_id)
      values (v_venta_id, v_monto, v_metodo, now(), p_usuario_email, v_pais_id, v_sucursal_id);

      insert into public.cash_movements (
        user_id,
        cashbox_id,
        date,
        type,
        payment_method,
        amount,
        description,
        created_at,
        pais_id,
        sucursal_id
      )
      values (
        p_usuario_id,
        coalesce(p_cashbox_id, 'main'),
        current_date,
        'income',
        case
          when lower(v_metodo) in ('efectivo', 'cash') then 'cash'
          when lower(v_metodo) in ('qr') then 'qr'
          when lower(v_metodo) in ('tarjeta', 'card') then 'card'
          when lower(v_metodo) in ('transferencia', 'transfer') then 'transfer'
          else 'other'
        end,
        v_monto,
        'Ingreso automatico por venta #' || v_venta_id,
        now(),
        v_pais_id,
        v_sucursal_id
      );
    end if;
  end loop;

  return jsonb_build_object('id', v_venta_id, 'estado', 'efectivizada');
exception
  when others then
    raise;
end;
$$;

alter function public.default_pais_id() security definer set search_path = public, auth;
alter function public.set_sucursal_default_pais() security definer set search_path = public, auth;
alter function public.sync_pais_from_sucursal() security definer set search_path = public, auth;
alter function public.sync_producto_child_pais() security definer set search_path = public, auth;
alter function public.sync_pack_productos_pais() security definer set search_path = public, auth;
alter function public.sync_venta_child_pais() security definer set search_path = public, auth;
alter function public.crear_venta_completa(jsonb, jsonb, jsonb, uuid, text, text) security definer set search_path = public, auth;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'sync_transferencia_sucursal_pais'
  ) then
    alter function public.sync_transferencia_sucursal_pais() security definer set search_path = public, auth;
  end if;
end $$;

drop trigger if exists trg_sucursales_default_pais on public.sucursales;
create trigger trg_sucursales_default_pais
before insert or update on public.sucursales
for each row execute function public.set_sucursal_default_pais();

drop trigger if exists trg_carritos_pendientes_pais on public.carritos_pendientes;
create trigger trg_carritos_pendientes_pais before insert or update on public.carritos_pendientes for each row execute function public.sync_pais_from_sucursal();
drop trigger if exists trg_cash_closures_pais on public.cash_closures;
create trigger trg_cash_closures_pais before insert or update on public.cash_closures for each row execute function public.sync_pais_from_sucursal();
drop trigger if exists trg_cash_movements_pais on public.cash_movements;
create trigger trg_cash_movements_pais before insert or update on public.cash_movements for each row execute function public.sync_pais_from_sucursal();
drop trigger if exists trg_categorias_pais on public.categorias;
create trigger trg_categorias_pais before insert or update on public.categorias for each row execute function public.sync_pais_from_sucursal();
drop trigger if exists trg_clientes_pais on public.clientes;
create trigger trg_clientes_pais before insert or update on public.clientes for each row execute function public.sync_pais_from_sucursal();
drop trigger if exists trg_packs_pais on public.packs;
create trigger trg_packs_pais before insert or update on public.packs for each row execute function public.sync_pais_from_sucursal();
drop trigger if exists trg_productos_pais on public.productos;
create trigger trg_productos_pais before insert or update on public.productos for each row execute function public.sync_pais_from_sucursal();
drop trigger if exists trg_ventas_pais on public.ventas;
create trigger trg_ventas_pais before insert or update on public.ventas for each row execute function public.sync_pais_from_sucursal();

drop trigger if exists trg_producto_variantes_pais on public.producto_variantes;
create trigger trg_producto_variantes_pais before insert or update on public.producto_variantes for each row execute function public.sync_producto_child_pais();
drop trigger if exists trg_producto_imagenes_pais on public.producto_imagenes;
create trigger trg_producto_imagenes_pais before insert or update on public.producto_imagenes for each row execute function public.sync_producto_child_pais();
drop trigger if exists trg_promociones_pais on public.promociones;
create trigger trg_promociones_pais before insert or update on public.promociones for each row execute function public.sync_producto_child_pais();
drop trigger if exists trg_productos_historial_pais on public.productos_historial;
create trigger trg_productos_historial_pais before insert or update on public.productos_historial for each row execute function public.sync_producto_child_pais();
drop trigger if exists trg_stock_movimientos_pais on public.stock_movimientos;
create trigger trg_stock_movimientos_pais before insert or update on public.stock_movimientos for each row execute function public.sync_producto_child_pais();

drop trigger if exists trg_pack_productos_pais on public.pack_productos;
create trigger trg_pack_productos_pais before insert or update on public.pack_productos for each row execute function public.sync_pack_productos_pais();

drop trigger if exists trg_ventas_detalle_pais on public.ventas_detalle;
create trigger trg_ventas_detalle_pais before insert or update on public.ventas_detalle for each row execute function public.sync_venta_child_pais();
drop trigger if exists trg_ventas_pagos_pais on public.ventas_pagos;
create trigger trg_ventas_pagos_pais before insert or update on public.ventas_pagos for each row execute function public.sync_venta_child_pais();

drop view if exists public.v_productos_catalogo;
create view public.v_productos_catalogo as
select
  p.user_id as producto_id,
  p.nombre,
  p.descripcion,
  p.precio as precio_base,
  p.imagen_url as imagen_base,
  p.category_id,
  coalesce(c.categori, p.categoria) as categoria,
  p.stock as stock_total,
  p.codigo_barra,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pv.id,
        'variante_id', pv.id,
        'color', pv.color,
        'stock', pv.stock,
        'stock_decimal', pv.stock_decimal,
        'precio', pv.precio,
        'imagen_url', pv.imagen_url,
        'sku', pv.sku,
        'activo', pv.activo
      )
      order by pv.id
    ) filter (where pv.id is not null),
    '[]'::jsonb
  ) as variantes,
  p.pais_id,
  p.sucursal_id
from public.productos p
left join public.categorias c
  on c.id = p.category_id
 and c.pais_id = p.pais_id
 and c.sucursal_id = p.sucursal_id
left join public.producto_variantes pv
  on pv.producto_id = p.user_id
 and pv.pais_id = p.pais_id
 and pv.sucursal_id = p.sucursal_id
group by
  p.user_id,
  p.pais_id,
  p.sucursal_id,
  p.nombre,
  p.descripcion,
  p.precio,
  p.imagen_url,
  p.category_id,
  c.categori,
  p.categoria,
  p.stock,
  p.codigo_barra;

commit;
