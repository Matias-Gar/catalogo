-- Inventory ledger guardrails. Apply in staging first, after harden_sales_stock_flow.sql
-- and the country/branch migrations. This migration is intentionally append-only.
begin;

alter table public.stock_movimientos
  add column if not exists correlation_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists transaction_id bigint,
  add column if not exists factor_conversion numeric,
  add column if not exists unidad_base text,
  add column if not exists resultado text default 'OK',
  add column if not exists error_message text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.stock_movimientos'::regclass and conname = 'stock_movimientos_cantidad_base_positiva') then
    alter table public.stock_movimientos add constraint stock_movimientos_cantidad_base_positiva
      check (cantidad_base is null or cantidad_base > 0 or (tipo = 'apertura_ledger' and cantidad_base = 0)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.stock_movimientos'::regclass and conname = 'stock_movimientos_factor_positivo') then
    alter table public.stock_movimientos add constraint stock_movimientos_factor_positivo
      check (factor_conversion is null or factor_conversion > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.stock_movimientos'::regclass and conname = 'stock_movimientos_snapshot_no_negativo') then
    alter table public.stock_movimientos add constraint stock_movimientos_snapshot_no_negativo
      check (stock_antes is null or stock_antes >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.stock_movimientos'::regclass and conname = 'stock_movimientos_stock_despues_no_negativo') then
    alter table public.stock_movimientos add constraint stock_movimientos_stock_despues_no_negativo
      check (stock_despues is null or stock_despues >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.stock_movimientos'::regclass and conname = 'stock_movimientos_resultado_valido') then
    alter table public.stock_movimientos add constraint stock_movimientos_resultado_valido
      check (resultado in ('OK', 'RECHAZADO', 'ERROR')) not valid;
  end if;
end $$;

create unique index if not exists uq_stock_movimiento_detalle_venta
  on public.stock_movimientos(detalle_id)
  where detalle_id is not null and tipo = 'venta';

create index if not exists idx_stock_movimientos_correlation
  on public.stock_movimientos(correlation_id, created_at);

create index if not exists idx_stock_movimientos_idempotency
  on public.stock_movimientos(idempotency_key)
  where idempotency_key is not null;

create table if not exists public.inventory_operation_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default clock_timestamp(),
  correlation_id uuid not null,
  idempotency_key text,
  operacion text not null,
  origen text not null,
  usuario_id uuid,
  usuario_email text,
  producto_id bigint,
  variante_id bigint,
  venta_id bigint,
  cantidad numeric,
  unidad text,
  cantidad_base numeric,
  resultado text not null check (resultado in ('RECHAZADO', 'ERROR')),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.business_audit_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default clock_timestamp(),
  correlation_id uuid not null,
  idempotency_key text,
  entidad text not null,
  entidad_id text not null,
  operacion text not null,
  usuario_id uuid,
  usuario_email text,
  usuario_rol text,
  pais_id uuid,
  sucursal_id uuid,
  motivo text,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_business_audit_entity
  on public.business_audit_events(entidad, entidad_id, created_at desc);
create index if not exists idx_business_audit_correlation
  on public.business_audit_events(correlation_id, created_at);

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

alter table public.carritos_pendientes
  add column if not exists estado text default 'pendiente',
  add column if not exists venta_id bigint,
  add column if not exists procesado_at timestamptz,
  add column if not exists descartado_at timestamptz,
  add column if not exists descartado_por uuid,
  add column if not exists motivo_descarte text,
  add column if not exists request_key text;

create unique index if not exists uq_carrito_venta
  on public.carritos_pendientes(venta_id) where venta_id is not null;
create unique index if not exists uq_carrito_request_key
  on public.carritos_pendientes(request_key) where request_key is not null;

alter table public.productos
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists archive_reason text;

create index if not exists idx_inventory_attempts_correlation
  on public.inventory_operation_attempts(correlation_id, created_at);
create unique index if not exists uq_inventory_attempt_idempotency
  on public.inventory_operation_attempts(idempotency_key)
  where idempotency_key is not null;

create or replace function public.prevent_inventory_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'El libro mayor de inventario es inmutable; registre una reversa';
end;
$$;

drop trigger if exists trg_stock_movimientos_immutable on public.stock_movimientos;
create trigger trg_stock_movimientos_immutable
before update or delete on public.stock_movimientos
for each row execute function public.prevent_inventory_ledger_mutation();

drop trigger if exists trg_inventory_attempts_immutable on public.inventory_operation_attempts;
create trigger trg_inventory_attempts_immutable
before update or delete on public.inventory_operation_attempts
for each row execute function public.prevent_inventory_ledger_mutation();

drop trigger if exists trg_business_audit_immutable on public.business_audit_events;
create trigger trg_business_audit_immutable
before update or delete on public.business_audit_events
for each row execute function public.prevent_inventory_ledger_mutation();

revoke insert, update, delete on public.stock_movimientos from anon, authenticated;
revoke insert, update, delete on public.inventory_operation_attempts from anon, authenticated;
revoke insert, update, delete on public.business_audit_events, public.inventory_operation_requests from anon, authenticated;
grant select on public.stock_movimientos, public.inventory_operation_attempts, public.business_audit_events to authenticated;

create or replace function public.soft_delete_product(
  p_producto_id bigint,
  p_pais_id uuid,
  p_sucursal_id uuid,
  p_usuario_id uuid,
  p_usuario_email text,
  p_usuario_rol text,
  p_motivo text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if coalesce(trim(p_usuario_rol), '') <> 'admin' then
    raise exception 'Solo un administrador puede retirar productos';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo es obligatorio';
  end if;

  select to_jsonb(p) into v_before
  from public.productos p
  where p.user_id = p_producto_id and p.pais_id = p_pais_id and p.sucursal_id = p_sucursal_id
  for update;
  if v_before is null then raise exception 'Producto no encontrado'; end if;

  update public.productos
  set archivado = true, archived_at = clock_timestamp(), archived_by = p_usuario_id,
      archive_reason = trim(p_motivo)
  where user_id = p_producto_id and pais_id = p_pais_id and sucursal_id = p_sucursal_id;
  update public.producto_variantes set activo = false
  where producto_id = p_producto_id and pais_id = p_pais_id and sucursal_id = p_sucursal_id;

  insert into public.business_audit_events (
    correlation_id, entidad, entidad_id, operacion, usuario_id, usuario_email,
    usuario_rol, pais_id, sucursal_id, motivo, datos_anteriores, datos_nuevos
  ) values (
    p_correlation_id, 'producto', p_producto_id::text, 'ARCHIVE', p_usuario_id,
    p_usuario_email, p_usuario_rol, p_pais_id, p_sucursal_id, trim(p_motivo),
    v_before, jsonb_build_object('archivado', true, 'activo_en_catalogo', false)
  );
  return jsonb_build_object('id', p_producto_id, 'archivado', true);
end;
$$;

create or replace function public.increase_inventory_stock(
  p_producto_id bigint, p_variante_id bigint, p_pais_id uuid, p_sucursal_id uuid,
  p_cantidad numeric, p_unidad text, p_usuario_id uuid, p_usuario_email text,
  p_usuario_rol text, p_motivo text, p_correlation_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_product record; v_variant record; v_factor numeric; v_base numeric;
  v_before numeric; v_after numeric; v_total numeric;
begin
  if p_usuario_rol not in ('admin', 'administracion', 'almacen') then raise exception 'Rol sin permiso para aumentar stock'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'Cantidad positiva requerida'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'El motivo es obligatorio'; end if;
  select * into v_product from public.productos where user_id = p_producto_id
    and pais_id = p_pais_id and sucursal_id = p_sucursal_id and not coalesce(archivado, false) for update;
  if not found then raise exception 'Producto activo no encontrado'; end if;
  v_factor := coalesce(v_product.factor_conversion, 0);
  if p_unidad = coalesce(nullif(v_product.unidad_base, ''), 'unidad') then v_base := p_cantidad;
  elsif v_factor > 0 and p_unidad = any(coalesce(v_product.unidades_alternativas, array[]::text[])) then v_base := p_cantidad / v_factor;
  else raise exception 'Unidad no permitida para el producto'; end if;
  if v_base <= 0 then raise exception 'Conversión inválida'; end if;

  if p_variante_id is not null then
    select * into v_variant from public.producto_variantes where id = p_variante_id
      and producto_id = p_producto_id and pais_id = p_pais_id and sucursal_id = p_sucursal_id for update;
    if not found or not coalesce(v_variant.activo, true) then raise exception 'Variante activa no encontrada'; end if;
    v_before := coalesce(v_variant.stock_decimal, v_variant.stock, 0);
    v_after := v_before + v_base;
    update public.producto_variantes set stock_decimal = v_after, stock = floor(v_after) where id = p_variante_id;
    select coalesce(sum(coalesce(stock_decimal, stock, 0)), 0) into v_total
      from public.producto_variantes where producto_id = p_producto_id and coalesce(activo, true);
    update public.productos set stock = v_total where user_id = p_producto_id;
  else
    if exists(select 1 from public.producto_variantes where producto_id = p_producto_id and coalesce(activo, true)) then
      raise exception 'Seleccione una variante para un producto con colores';
    end if;
    v_before := coalesce(v_product.stock, 0); v_after := v_before + v_base; v_total := v_after;
    update public.productos set stock = v_after where user_id = p_producto_id;
  end if;
  insert into public.stock_movimientos(producto_id, variante_id, tipo, cantidad, unidad,
    cantidad_base, unidad_base, factor_conversion, stock_antes, stock_despues, usuario_id,
    usuario_email, pais_id, sucursal_id, motivo, correlation_id, transaction_id, metadata)
  values(p_producto_id, p_variante_id, 'aumento', p_cantidad, p_unidad, v_base,
    v_product.unidad_base, nullif(v_factor, 0), v_before, v_after, p_usuario_id,
    p_usuario_email, p_pais_id, p_sucursal_id, trim(p_motivo), p_correlation_id,
    txid_current(), jsonb_build_object('usuario_rol', p_usuario_rol));
  insert into public.business_audit_events(correlation_id, entidad, entidad_id, operacion,
    usuario_id, usuario_email, usuario_rol, pais_id, sucursal_id, motivo, datos_anteriores, datos_nuevos)
  values(p_correlation_id, case when p_variante_id is null then 'producto' else 'variante' end,
    coalesce(p_variante_id, p_producto_id)::text, 'STOCK_INCREASE', p_usuario_id, p_usuario_email,
    p_usuario_rol, p_pais_id, p_sucursal_id, trim(p_motivo),
    jsonb_build_object('stock', v_before), jsonb_build_object('stock', v_after, 'stock_producto', v_total));
  return jsonb_build_object('totalStock', v_total, 'nextVariantStock', case when p_variante_id is null then null else v_after end,
    'cantidadBase', v_base, 'correlationId', p_correlation_id);
end; $$;

create or replace function public.discard_pending_order(
  p_pedido_id bigint, p_pais_id uuid, p_sucursal_id uuid, p_usuario_id uuid,
  p_usuario_email text, p_usuario_rol text, p_motivo text, p_correlation_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  if p_usuario_rol not in ('admin', 'administracion', 'vendedor') then
    raise exception 'Rol sin permiso para descartar pedidos';
  end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'El motivo es obligatorio'; end if;
  select to_jsonb(cp) into v_before from public.carritos_pendientes cp
  where cp.id = p_pedido_id and cp.pais_id = p_pais_id and cp.sucursal_id = p_sucursal_id for update;
  if v_before is null then raise exception 'Pedido no encontrado'; end if;
  if coalesce(v_before->>'estado', 'pendiente') = 'confirmado' or (v_before->>'confirmado_pago')::boolean then
    raise exception 'Un pedido confirmado no puede descartarse';
  end if;
  update public.carritos_pendientes set estado = 'descartado', descartado_at = clock_timestamp(),
    descartado_por = p_usuario_id, motivo_descarte = trim(p_motivo)
  where id = p_pedido_id;
  insert into public.business_audit_events(correlation_id, entidad, entidad_id, operacion,
    usuario_id, usuario_email, usuario_rol, pais_id, sucursal_id, motivo, datos_anteriores, datos_nuevos)
  values(p_correlation_id, 'pedido', p_pedido_id::text, 'DISCARD', p_usuario_id,
    p_usuario_email, p_usuario_rol, p_pais_id, p_sucursal_id, trim(p_motivo),
    v_before, jsonb_build_object('estado', 'descartado'));
  return jsonb_build_object('id', p_pedido_id, 'estado', 'descartado');
end; $$;

create or replace function public.crear_venta_completa_segura(
  p_venta jsonb, p_items jsonb, p_pagos jsonb, p_usuario_id uuid,
  p_usuario_email text, p_usuario_rol text, p_cashbox_id text,
  p_pending_order_id bigint, p_idempotency_key text, p_correlation_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hash text := md5(coalesce(p_venta::text,'') || coalesce(p_items::text,'') || coalesce(p_pagos::text,'') || coalesce(p_pending_order_id::text,''));
  v_existing record; v_order record; v_result jsonb;
begin
  if coalesce(trim(p_idempotency_key), '') = '' then raise exception 'Idempotency key requerida'; end if;
  if p_usuario_rol not in ('admin', 'administracion', 'vendedor') then raise exception 'Rol sin permiso para vender'; end if;
  insert into public.inventory_operation_requests(idempotency_key, request_hash, operacion, status,
    correlation_id, usuario_id)
  values(trim(p_idempotency_key), v_hash, 'VENTA', 'PROCESSING', p_correlation_id, p_usuario_id)
  on conflict (idempotency_key) do nothing;
  select * into v_existing from public.inventory_operation_requests where idempotency_key = trim(p_idempotency_key) for update;
  if v_existing.request_hash <> v_hash then raise exception 'Idempotency key reutilizada con datos distintos'; end if;
  if v_existing.status = 'COMPLETED' then return v_existing.result; end if;

  if p_pending_order_id is not null then
    select * into v_order from public.carritos_pendientes
    where id = p_pending_order_id and pais_id = (p_venta->>'pais_id')::uuid
      and sucursal_id = (p_venta->>'sucursal_id')::uuid for update;
    if not found then raise exception 'Pedido no encontrado en la sucursal'; end if;
    if coalesce(v_order.estado, 'pendiente') <> 'pendiente' or coalesce(v_order.confirmado_pago, false) then
      raise exception 'El pedido ya fue procesado o descartado';
    end if;
  end if;

  v_result := public.crear_venta_completa(p_venta, p_items, p_pagos, p_usuario_id,
    p_usuario_email, p_cashbox_id);
  if p_pending_order_id is not null then
    update public.carritos_pendientes set confirmado_pago = true, estado = 'confirmado',
      venta_id = (v_result->>'id')::bigint, procesado_at = clock_timestamp()
    where id = p_pending_order_id;
  end if;
  insert into public.business_audit_events(correlation_id, idempotency_key, entidad, entidad_id,
    operacion, usuario_id, usuario_email, usuario_rol, pais_id, sucursal_id, datos_nuevos, metadata)
  values(p_correlation_id, trim(p_idempotency_key), 'venta', v_result->>'id', 'CREATE',
    p_usuario_id, p_usuario_email, p_usuario_rol, (p_venta->>'pais_id')::uuid,
    (p_venta->>'sucursal_id')::uuid, v_result, jsonb_build_object('pending_order_id', p_pending_order_id));
  update public.inventory_operation_requests set status = 'COMPLETED', result = v_result,
    completed_at = clock_timestamp() where idempotency_key = trim(p_idempotency_key);
  return v_result;
end; $$;

revoke all on function public.soft_delete_product(bigint,uuid,uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.increase_inventory_stock(bigint,bigint,uuid,uuid,numeric,text,uuid,text,text,text,uuid) from public, anon, authenticated;
-- La reducción atómica se instala mediante add_safe_inventory_reduction.sql.
revoke all on function public.discard_pending_order(bigint,uuid,uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.crear_venta_completa_segura(jsonb,jsonb,jsonb,uuid,text,text,text,bigint,text,uuid) from public, anon, authenticated;

-- Snapshot comparison based on the movement chain. The first stock_antes is the
-- opening balance; signed movements reconstruct the current balance exactly.
create or replace view public.inventory_reconciliation as
with ordered as (
  select sm.*,
    first_value(sm.stock_antes) over (
      partition by sm.producto_id, coalesce(sm.variante_id, -1)
      order by sm.created_at, sm.id
    ) as opening_stock,
    case
      when sm.tipo in ('venta', 'venta_anulada', 'transferencia_salida', 'ajuste_negativo', 'salida')
        then -sm.cantidad_base
      else sm.cantidad_base
    end as signed_quantity
  from public.stock_movimientos sm
  where sm.stock_antes is not null and sm.stock_despues is not null
), ledger as (
  select producto_id, variante_id, min(opening_stock) as opening_stock,
    sum(signed_quantity) as movement_total, max(created_at) as ultimo_movimiento
  from ordered group by producto_id, variante_id
), snapshots as (
  select p.user_id as producto_id, null::bigint as variante_id, p.stock::numeric as stock_sistema
  from public.productos p
  where not exists (select 1 from public.producto_variantes pv where pv.producto_id = p.user_id and coalesce(pv.activo, true))
  union all
  select pv.producto_id, pv.id, coalesce(pv.stock_decimal, pv.stock, 0)::numeric
  from public.producto_variantes pv where coalesce(pv.activo, true)
)
select s.producto_id, s.variante_id, s.stock_sistema,
  l.opening_stock + l.movement_total as stock_ledger,
  s.stock_sistema - (l.opening_stock + l.movement_total) as diferencia,
  l.ultimo_movimiento,
  case when l.producto_id is null then 'SIN_LEDGER'
       when abs(s.stock_sistema - (l.opening_stock + l.movement_total)) <= 0.000001 then 'OK'
       else 'INCONSISTENCIA_CRITICA' end as estado
from snapshots s
left join ledger l on l.producto_id = s.producto_id
  and l.variante_id is not distinct from s.variante_id;

commit;
