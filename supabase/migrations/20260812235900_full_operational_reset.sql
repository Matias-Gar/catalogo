-- Reinicio total de datos operativos de Matias-Gar's Project.
-- Conserva autenticacion, perfiles, paises, sucursales, permisos y configuracion.
-- Cada tabla se respalda dentro de operational_reset_backup antes del TRUNCATE.
begin;

select pg_advisory_xact_lock(hashtext('catalogo_full_operational_reset'));

create schema if not exists operational_reset_backup;
create table if not exists operational_reset_backup.reset_runs (
  reset_id text primary key,
  created_at timestamptz not null default clock_timestamp(),
  project_ref text not null,
  description text not null
);

do $$
declare
  v_reset_id text := 'reset_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_MS');
  v_table text;
  v_backup_name text;
  v_tables text[] := array[
    'ventas_pagos', 'ventas_detalle', 'ventas', 'carritos_pendientes',
    'cash_movements', 'cash_closures',
    'stock_movimientos', 'transferencias_sucursal', 'productos_historial',
    'inventory_operation_requests', 'inventory_operation_attempts',
    'inventory_idempotency', 'inventory_cutover_balances',
    'inventory_rejected_attempts', 'business_audit_events',
    'pack_productos', 'packs', 'promociones',
    'producto_imagenes', 'producto_variantes', 'productos', 'categorias',
    'clientes', 'mensajes_whatsapp'
  ];
  v_existing_tables text[] := array[]::text[];
begin
  insert into operational_reset_backup.reset_runs(reset_id, project_ref, description)
  values(v_reset_id, 'gzvtuenpwndodnetnmzi', 'Reinicio total de datos operativos solicitado por el propietario');

  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null
       and exists (
         select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = v_table and c.relkind in ('r', 'p')
       ) then
      v_backup_name := left(v_reset_id || '__' || v_table, 63);
      execute format(
        'create table operational_reset_backup.%I as select * from public.%I',
        v_backup_name, v_table
      );
      v_existing_tables := array_append(v_existing_tables, format('public.%I', v_table));
    end if;
  end loop;

  if cardinality(v_existing_tables) > 0 then
    execute 'truncate table ' || array_to_string(v_existing_tables, ', ') || ' restart identity cascade';
  end if;
end;
$$;

-- Si cualquier conteo no es cero, abortar y restaurar toda la transaccion.
do $$
declare
  v_table text;
  v_count bigint;
begin
  foreach v_table in array array[
    'ventas', 'ventas_detalle', 'productos', 'producto_variantes',
    'stock_movimientos', 'transferencias_sucursal', 'carritos_pendientes'
  ] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('select count(*) from public.%I', v_table) into v_count;
      if v_count <> 0 then
        raise exception 'El reinicio fallo: public.% conserva % filas', v_table, v_count;
      end if;
    end if;
  end loop;
end;
$$;

commit;
