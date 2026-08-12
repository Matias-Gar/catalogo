-- Transferencias entre sucursales: persistencia, idempotencia y ledger correlacionado.
-- Portable: no contiene IDs ni reparaciones de stock de ninguna tienda.
-- Ejecutar despues de enable_transferencia_sucursal.sql y harden_inventory_ledger.sql.
begin;

alter table public.transferencias_sucursal
  add column if not exists correlation_id uuid,
  add column if not exists idempotency_key text;

create unique index if not exists uq_transferencias_sucursal_idempotency
  on public.transferencias_sucursal(idempotency_key)
  where idempotency_key is not null;

create table if not exists public.inventory_operation_requests (
  idempotency_key text primary key,
  request_hash text not null,
  operacion text not null,
  status text not null check (status in ('PROCESSING', 'COMPLETED')),
  result jsonb,
  correlation_id uuid not null,
  usuario_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);

create or replace function public.require_transfer_variant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.variante_origen_id is null and exists (
    select 1
    from public.producto_variantes pv
    where pv.producto_id = new.producto_origen_id
      and pv.sucursal_id = new.sucursal_origen_id
      and coalesce(pv.activo, true)
  ) then
    raise exception 'Debe seleccionar una variante/color para transferir este producto';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_transfer_variant on public.transferencias_sucursal;
create trigger trg_require_transfer_variant
before insert on public.transferencias_sucursal
for each row execute function public.require_transfer_variant();

-- Fachada idempotente. La RPC de diez argumentos conserva la implementacion
-- atomica de origen/destino; esta version agrega identidad y el par auditable.
create or replace function public.transferir_stock_sucursal(
  p_producto_origen_id bigint,
  p_variante_origen_id bigint,
  p_sucursal_origen_id uuid,
  p_sucursal_destino_id uuid,
  p_cantidad numeric,
  p_unidad text,
  p_cantidad_base numeric,
  p_usuario_id uuid,
  p_usuario_email text,
  p_observaciones text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_hash text;
  v_request public.inventory_operation_requests%rowtype;
  v_correlation_id uuid := gen_random_uuid();
  v_transferencia_id uuid;
  v_transferencia public.transferencias_sucursal%rowtype;
  v_salida public.stock_movimientos%rowtype;
  v_entrada public.stock_movimientos%rowtype;
begin
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'Idempotency-Key obligatoria';
  end if;
  if p_sucursal_origen_id = p_sucursal_destino_id then
    raise exception 'La sucursal destino debe ser distinta al origen';
  end if;
  if p_variante_origen_id is null and exists (
    select 1 from public.producto_variantes pv
    where pv.producto_id = p_producto_origen_id
      and pv.sucursal_id = p_sucursal_origen_id
      and coalesce(pv.activo, true)
  ) then
    raise exception 'Debe seleccionar una variante/color para transferir este producto';
  end if;

  v_request_hash := md5(jsonb_build_object(
    'producto', p_producto_origen_id,
    'variante', p_variante_origen_id,
    'origen', p_sucursal_origen_id,
    'destino', p_sucursal_destino_id,
    'cantidad', p_cantidad,
    'unidad', p_unidad,
    'observaciones', p_observaciones
  )::text);

  insert into public.inventory_operation_requests(
    idempotency_key, request_hash, operacion, status, correlation_id, usuario_id
  ) values (
    trim(p_idempotency_key), v_request_hash, 'TRANSFERENCIA', 'PROCESSING', v_correlation_id, p_usuario_id
  ) on conflict (idempotency_key) do nothing;

  select * into v_request
  from public.inventory_operation_requests
  where idempotency_key = trim(p_idempotency_key)
  for update;

  if v_request.operacion <> 'TRANSFERENCIA' or v_request.request_hash <> v_request_hash then
    raise exception 'Idempotency-Key reutilizada con datos diferentes';
  end if;
  if v_request.status = 'COMPLETED' and v_request.result ? 'transferencia_id' then
    return (v_request.result->>'transferencia_id')::uuid;
  end if;
  v_correlation_id := v_request.correlation_id;

  v_transferencia_id := public.transferir_stock_sucursal(
    p_producto_origen_id, p_variante_origen_id,
    p_sucursal_origen_id, p_sucursal_destino_id,
    p_cantidad, p_unidad, p_cantidad_base,
    p_usuario_id, p_usuario_email, p_observaciones
  );

  select * into strict v_transferencia
  from public.transferencias_sucursal
  where id = v_transferencia_id;

  update public.transferencias_sucursal
  set correlation_id = v_correlation_id,
      idempotency_key = trim(p_idempotency_key)
  where id = v_transferencia_id;

  select * into strict v_salida
  from public.stock_movimientos
  where metadata->>'transferencia_id' = v_transferencia_id::text
    and tipo = 'transferencia_salida'
  order by created_at desc, id desc limit 1;

  select * into strict v_entrada
  from public.stock_movimientos
  where metadata->>'transferencia_id' = v_transferencia_id::text
    and tipo = 'transferencia_entrada'
  order by created_at desc, id desc limit 1;

  insert into public.stock_movimientos(
    producto_id, variante_id, tipo, cantidad, unidad, cantidad_base,
    sucursal_id, usuario_id, usuario_email, observaciones,
    stock_antes, stock_despues, motivo, correlation_id,
    idempotency_key, transaction_id, resultado, metadata
  ) values
  (
    v_salida.producto_id, v_salida.variante_id, 'transferencia_salida_auditada',
    v_salida.cantidad, v_salida.unidad, v_salida.cantidad_base,
    v_salida.sucursal_id, p_usuario_id, p_usuario_email,
    'Salida auditada de transferencia', v_salida.stock_antes, v_salida.stock_despues,
    coalesce(p_observaciones, 'Transferencia entre sucursales'), v_correlation_id,
    trim(p_idempotency_key) || ':out', txid_current(), 'OK',
    v_salida.metadata || jsonb_build_object('transferencia_id', v_transferencia_id)
  ),
  (
    v_entrada.producto_id, v_entrada.variante_id, 'transferencia_entrada_auditada',
    v_entrada.cantidad, v_entrada.unidad, v_entrada.cantidad_base,
    v_entrada.sucursal_id, p_usuario_id, p_usuario_email,
    'Entrada auditada de transferencia', v_entrada.stock_antes, v_entrada.stock_despues,
    coalesce(p_observaciones, 'Transferencia entre sucursales'), v_correlation_id,
    trim(p_idempotency_key) || ':in', txid_current(), 'OK',
    v_entrada.metadata || jsonb_build_object('transferencia_id', v_transferencia_id)
  );

  update public.inventory_operation_requests
  set status = 'COMPLETED',
      result = jsonb_build_object('transferencia_id', v_transferencia_id),
      completed_at = clock_timestamp()
  where idempotency_key = trim(p_idempotency_key);

  return v_transferencia_id;
end;
$$;

revoke execute on function public.transferir_stock_sucursal(
  bigint, bigint, uuid, uuid, numeric, text, numeric, uuid, text, text, text
) from authenticated, anon;
grant execute on function public.transferir_stock_sucursal(
  bigint, bigint, uuid, uuid, numeric, text, numeric, uuid, text, text, text
) to service_role;

commit;
