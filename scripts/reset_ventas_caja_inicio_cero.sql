-- Reset operativo de ventas/caja para empezar de cero.
--
-- Que borra:
-- - ventas
-- - ventas_detalle
-- - ventas_pagos
-- - carritos_pendientes
-- - cash_movements automaticos generados por ventas
-- - cash_closures (cierres calculados con ventas antiguas)
-- - stock_movimientos generados por ventas/anulaciones de ventas
--
-- Que NO borra:
-- - productos
-- - producto_variantes
-- - stock actual
-- - categorias
-- - clientes
-- - packs/promociones
-- - movimientos manuales de caja
-- - movimientos manuales de stock/aumentos/ajustes
--
-- Ejecutar en Supabase SQL editor cuando estes seguro.
-- El script primero guarda copia en schema inventory_reset_backup.

begin;

create schema if not exists inventory_reset_backup;

create table if not exists inventory_reset_backup.reset_runs (
  reset_id text primary key,
  started_at timestamptz not null default now(),
  note text
);

insert into inventory_reset_backup.reset_runs(reset_id, note)
values (
  'reset_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_MS'),
  'Reset operativo ventas/caja inicio cero'
);

create table if not exists inventory_reset_backup.ventas
as select null::text as reset_id, now() as backed_up_at, v.*
from public.ventas v
where false;

create table if not exists inventory_reset_backup.ventas_detalle
as select null::text as reset_id, now() as backed_up_at, vd.*
from public.ventas_detalle vd
where false;

create table if not exists inventory_reset_backup.ventas_pagos
as select null::text as reset_id, now() as backed_up_at, vp.*
from public.ventas_pagos vp
where false;

create table if not exists inventory_reset_backup.carritos_pendientes
as select null::text as reset_id, now() as backed_up_at, cp.*
from public.carritos_pendientes cp
where false;

create table if not exists inventory_reset_backup.cash_movements_auto_ventas
as select null::text as reset_id, now() as backed_up_at, cm.*
from public.cash_movements cm
where false;

create table if not exists inventory_reset_backup.cash_closures
as select null::text as reset_id, now() as backed_up_at, cc.*
from public.cash_closures cc
where false;

create table if not exists inventory_reset_backup.stock_movimientos_ventas
as select null::text as reset_id, now() as backed_up_at, sm.*
from public.stock_movimientos sm
where false;

insert into inventory_reset_backup.ventas
select ctx.reset_id, now(), v.*
from public.ventas v
cross join lateral (
  select reset_id from inventory_reset_backup.reset_runs order by started_at desc limit 1
) ctx;

insert into inventory_reset_backup.ventas_detalle
select ctx.reset_id, now(), vd.*
from public.ventas_detalle vd
cross join lateral (
  select reset_id from inventory_reset_backup.reset_runs order by started_at desc limit 1
) ctx;

insert into inventory_reset_backup.ventas_pagos
select ctx.reset_id, now(), vp.*
from public.ventas_pagos vp
cross join lateral (
  select reset_id from inventory_reset_backup.reset_runs order by started_at desc limit 1
) ctx;

insert into inventory_reset_backup.carritos_pendientes
select ctx.reset_id, now(), cp.*
from public.carritos_pendientes cp
cross join lateral (
  select reset_id from inventory_reset_backup.reset_runs order by started_at desc limit 1
) ctx;

insert into inventory_reset_backup.cash_movements_auto_ventas
select ctx.reset_id, now(), cm.*
from public.cash_movements cm
cross join lateral (
  select reset_id from inventory_reset_backup.reset_runs order by started_at desc limit 1
) ctx
where cm.type = 'income'
  and (
    cm.description ilike '%ingreso por venta #%'
    or cm.description ilike '%ingreso automatico por venta #%'
  );

insert into inventory_reset_backup.cash_closures
select ctx.reset_id, now(), cc.*
from public.cash_closures cc
cross join lateral (
  select reset_id from inventory_reset_backup.reset_runs order by started_at desc limit 1
) ctx;

insert into inventory_reset_backup.stock_movimientos_ventas
select ctx.reset_id, now(), sm.*
from public.stock_movimientos sm
cross join lateral (
  select reset_id from inventory_reset_backup.reset_runs order by started_at desc limit 1
) ctx
where sm.tipo in ('venta', 'anulacion_venta')
   or sm.venta_id is not null
   or sm.observaciones ilike '%venta #%'
   or sm.metadata ? 'venta_eliminada_id';

-- Borrado operativo.
delete from public.cash_movements
where type = 'income'
  and (
    description ilike '%ingreso por venta #%'
    or description ilike '%ingreso automatico por venta #%'
  );

delete from public.cash_closures;

delete from public.stock_movimientos
where tipo in ('venta', 'anulacion_venta')
   or venta_id is not null
   or observaciones ilike '%venta #%'
   or metadata ? 'venta_eliminada_id';

delete from public.ventas_pagos;
delete from public.ventas_detalle;
delete from public.ventas;
delete from public.carritos_pendientes;

-- Reiniciar contadores si las tablas usan identity/serial.
-- Si alguna secuencia no existe, se ignora manualmente quitando esa linea.
do $$
begin
  begin
    perform setval(pg_get_serial_sequence('public.ventas', 'id'), 1, false);
  exception when others then
    null;
  end;

  begin
    perform setval(pg_get_serial_sequence('public.ventas_detalle', 'id'), 1, false);
  exception when others then
    null;
  end;

  begin
    perform setval(pg_get_serial_sequence('public.ventas_pagos', 'id'), 1, false);
  exception when others then
    null;
  end;

  begin
    perform setval(pg_get_serial_sequence('public.carritos_pendientes', 'id'), 1, false);
  exception when others then
    null;
  end;

  begin
    perform setval(pg_get_serial_sequence('public.cash_movements', 'id'), 1, false);
  exception when others then
    null;
  end;

  begin
    perform setval(pg_get_serial_sequence('public.cash_closures', 'id'), 1, false);
  exception when others then
    null;
  end;
end $$;

select
  ctx.reset_id,
  (select count(*) from inventory_reset_backup.ventas b where b.reset_id = ctx.reset_id) as ventas_respaldadas,
  (select count(*) from inventory_reset_backup.ventas_detalle b where b.reset_id = ctx.reset_id) as detalles_respaldados,
  (select count(*) from inventory_reset_backup.ventas_pagos b where b.reset_id = ctx.reset_id) as pagos_respaldados,
  (select count(*) from inventory_reset_backup.cash_movements_auto_ventas b where b.reset_id = ctx.reset_id) as caja_auto_respaldada,
  (select count(*) from inventory_reset_backup.stock_movimientos_ventas b where b.reset_id = ctx.reset_id) as movimientos_stock_venta_respaldados,
  (select count(*) from inventory_reset_backup.carritos_pendientes b where b.reset_id = ctx.reset_id) as pedidos_pendientes_respaldados
from (
  select reset_id from inventory_reset_backup.reset_runs order by started_at desc limit 1
) ctx;

commit;
