-- Repara/crea la funcion RPC descontar_stock para ventas
-- IMPORTANTE: dejar una sola firma para evitar ambiguedad de PostgREST.

begin;

drop function if exists public.descontar_stock(integer, bigint);

-- Funcion principal: firma esperada por el frontend
create or replace function public.descontar_stock(
  pid bigint,
  cantidad_desc integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if pid is null then
    raise exception 'pid no puede ser null';
  end if;

  if cantidad_desc is null or cantidad_desc <= 0 then
    raise exception 'cantidad_desc debe ser mayor a 0';
  end if;

  update public.productos
  set stock = greatest(0, coalesce(stock, 0) - cantidad_desc)
  where user_id = pid;

  if not found then
    raise exception 'No existe producto con user_id=%', pid;
  end if;
end;
$$;

-- Permisos de ejecucion
revoke all on function public.descontar_stock(bigint, integer) from public;

grant execute on function public.descontar_stock(bigint, integer) to authenticated;

-- Funcion para editar campos de un producto
drop function if exists public.editar_producto(bigint, text, text, numeric, text);

create or replace function public.editar_producto(
  pid bigint,
  nuevo_nombre text default null,
  nueva_descripcion text default null,
  nuevo_precio numeric default null,
  nueva_categoria text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if pid is null then
    raise exception 'pid no puede ser null';
  end if;

  update public.productos
  set
    nombre = coalesce(nuevo_nombre, nombre),
    descripcion = coalesce(nueva_descripcion, descripcion),
    precio = coalesce(nuevo_precio, precio),
    categoria = coalesce(nueva_categoria, categoria),
    updated_at = now()
  where id = pid;

  if not found then
    raise exception 'No existe producto con id=%', pid;
  end if;
end;
$$;

-- Permisos de ejecucion para editar_producto
revoke all on function public.editar_producto(bigint, text, text, numeric, text) from public;

grant execute on function public.editar_producto(bigint, text, text, numeric, text) to authenticated;

-- Funcion para editar campos de un movimiento de caja
drop function if exists public.editar_movimiento_caja(bigint, date, text, text, numeric, text);
drop function if exists public.editar_movimiento_caja(uuid, date, text, text, numeric, text);

create or replace function public.editar_movimiento_caja(
  pmovimiento_id uuid,
  pfecha date default null,
  ptipo text default null,
  pmetodo text default null,
  pmonto numeric default null,
  pdescripcion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if pmovimiento_id is null then
    raise exception 'movement_id no puede ser null';
  end if;

  update public.cash_movements
  set
    date = coalesce(pfecha, date),
    type = coalesce(ptipo, type),
    payment_method = coalesce(pmetodo, payment_method),
    amount = coalesce(pmonto, amount),
    description = coalesce(pdescripcion, description),
    updated_at = now()
  where id = pmovimiento_id;

  if not found then
    raise exception 'No existe movimiento con id=%', pmovimiento_id;
  end if;
end;
$$;

-- Permisos de ejecucion para editar_movimiento_caja
revoke all on function public.editar_movimiento_caja(uuid, date, text, text, numeric, text) from public;

grant execute on function public.editar_movimiento_caja(uuid, date, text, text, numeric, text) to authenticated;

commit;

-- Verificacion opcional
-- select n.nspname as schema_name,
--        p.proname as function_name,
--        pg_get_function_identity_arguments(p.oid) as args
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname in ('descontar_stock', 'editar_producto');
