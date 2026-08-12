-- Reducción segura y atómica de inventario.
-- Aplicar después de harden_inventory_ledger.sql.
begin;

create or replace function public.reduce_inventory_stock(
  p_producto_id bigint,
  p_variante_id bigint,
  p_pais_id uuid,
  p_sucursal_id uuid,
  p_cantidad numeric,
  p_unidad text,
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
  v_product public.productos%rowtype;
  v_variant public.producto_variantes%rowtype;
  v_factor numeric;
  v_base numeric;
  v_before numeric;
  v_after numeric;
  v_total numeric;
  v_has_variants boolean;
begin
  if p_usuario_rol not in ('admin', 'administracion') then
    raise exception 'Rol sin permiso para reducir stock';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo de la reducción es obligatorio';
  end if;

  select * into v_product
  from public.productos
  where user_id = p_producto_id
    and pais_id = p_pais_id
    and sucursal_id = p_sucursal_id
    and not coalesce(archivado, false)
  for update;
  if not found then raise exception 'Producto activo no encontrado'; end if;

  v_factor := coalesce(v_product.factor_conversion, 0);
  if p_unidad = coalesce(nullif(v_product.unidad_base, ''), 'unidad') then
    v_base := p_cantidad;
  elsif v_factor > 0
    and p_unidad = any(coalesce(v_product.unidades_alternativas, array[]::text[])) then
    v_base := p_cantidad / v_factor;
  else
    raise exception 'Unidad no permitida para el producto';
  end if;
  if v_base <= 0 then raise exception 'Conversión inválida'; end if;

  select exists(
    select 1 from public.producto_variantes
    where producto_id = p_producto_id
      and pais_id = p_pais_id
      and sucursal_id = p_sucursal_id
      and coalesce(activo, true)
  ) into v_has_variants;

  if v_has_variants and p_variante_id is null then
    raise exception 'Seleccione una variante para un producto con colores';
  end if;
  if not v_has_variants and p_variante_id is not null then
    raise exception 'El producto no tiene variantes activas';
  end if;

  if p_variante_id is not null then
    select * into v_variant
    from public.producto_variantes
    where id = p_variante_id
      and producto_id = p_producto_id
      and pais_id = p_pais_id
      and sucursal_id = p_sucursal_id
      and coalesce(activo, true)
    for update;
    if not found then raise exception 'Variante activa no encontrada'; end if;

    v_before := coalesce(v_variant.stock_decimal, v_variant.stock, 0);
    if v_base > v_before then raise exception 'No puedes reducir más que el stock disponible'; end if;
    v_after := v_before - v_base;

    update public.producto_variantes
    set stock_decimal = v_after, stock = floor(v_after)
    where id = p_variante_id;

    select coalesce(sum(coalesce(stock_decimal, stock, 0)), 0)
    into v_total
    from public.producto_variantes
    where producto_id = p_producto_id
      and pais_id = p_pais_id
      and sucursal_id = p_sucursal_id
      and coalesce(activo, true);

    update public.productos set stock = v_total
    where user_id = p_producto_id and pais_id = p_pais_id and sucursal_id = p_sucursal_id;
  else
    v_before := coalesce(v_product.stock, 0);
    if v_base > v_before then raise exception 'No puedes reducir más que el stock disponible'; end if;
    v_after := v_before - v_base;
    v_total := v_after;
    update public.productos set stock = v_after
    where user_id = p_producto_id and pais_id = p_pais_id and sucursal_id = p_sucursal_id;
  end if;

  insert into public.stock_movimientos(
    producto_id, variante_id, tipo, cantidad, unidad, cantidad_base,
    unidad_base, factor_conversion, stock_antes, stock_despues,
    usuario_id, usuario_email, pais_id, sucursal_id, motivo,
    observaciones, correlation_id, transaction_id, metadata
  ) values (
    p_producto_id, p_variante_id, 'ajuste_negativo', p_cantidad, p_unidad, v_base,
    v_product.unidad_base, nullif(v_factor, 0), v_before, v_after,
    p_usuario_id, p_usuario_email, p_pais_id, p_sucursal_id, trim(p_motivo),
    'Reducción controlada de inventario', p_correlation_id, txid_current(),
    jsonb_build_object('usuario_rol', p_usuario_rol, 'operacion', 'reduccion_controlada')
  );

  insert into public.business_audit_events(
    correlation_id, entidad, entidad_id, operacion, usuario_id, usuario_email,
    usuario_rol, pais_id, sucursal_id, motivo, datos_anteriores, datos_nuevos, metadata
  ) values (
    p_correlation_id,
    case when p_variante_id is null then 'producto' else 'variante' end,
    coalesce(p_variante_id, p_producto_id)::text,
    'STOCK_REDUCTION', p_usuario_id, p_usuario_email, p_usuario_rol,
    p_pais_id, p_sucursal_id, trim(p_motivo),
    jsonb_build_object('stock', v_before),
    jsonb_build_object('stock', v_after, 'stock_producto', v_total),
    jsonb_build_object('cantidad', p_cantidad, 'unidad', p_unidad, 'cantidad_base', v_base)
  );

  return jsonb_build_object(
    'totalStock', v_total,
    'nextVariantStock', case when p_variante_id is null then null else v_after end,
    'cantidadBase', v_base,
    'stockAntes', v_before,
    'stockDespues', v_after,
    'correlationId', p_correlation_id
  );
end;
$$;

revoke all on function public.reduce_inventory_stock(bigint,bigint,uuid,uuid,numeric,text,uuid,text,text,text,uuid)
from public, anon, authenticated;

commit;
