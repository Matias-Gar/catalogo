-- Evita restituir stock más de una vez al anular la misma venta.
-- Aplicar mediante conexión SQL administrativa; no cambia existencias al instalarse.
begin;

create or replace function public.eliminar_venta_con_restock(
  p_venta_id bigint,
  p_admin_id uuid default null,
  p_admin_email text default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role text;
  v_sale record;
  v_restore_source text;
  v_row record;
  v_producto record;
  v_qty_base numeric;
  v_qty_visible numeric;
  v_unidad text;
  v_stock_antes numeric;
  v_stock_despues numeric;
  v_restored_count integer := 0;
begin
  if p_venta_id is null then
    raise exception 'Venta invalida';
  end if;

  select lower(coalesce(rol, '')) into v_admin_role
  from public.perfiles
  where id = p_admin_id;

  if coalesce(v_admin_role, '') <> 'admin' then
    raise exception 'Solo el administrador puede eliminar ventas';
  end if;

  select * into v_sale
  from public.ventas
  where id = p_venta_id
  for update;

  if not found then
    raise exception 'Venta no encontrada (%)', p_venta_id;
  end if;

  -- El bloqueo anterior serializa las anulaciones de esta venta. Reintentar
  -- una anulación completada no puede volver a aumentar el inventario.
  if v_sale.estado = 'anulada' then
    return jsonb_build_object('id', p_venta_id, 'deleted', true,
      'stock_restored_rows', 0, 'already_annulled', true);
  end if;

  if exists (
    select 1
    from public.stock_movimientos sm
    where sm.tipo = 'venta'
      and (
        sm.venta_id = p_venta_id
        or sm.observaciones ilike ('%venta #' || p_venta_id || '%')
      )
  ) then
    v_restore_source := 'stock_movimientos';
  else
    v_restore_source := 'ventas_detalle';
  end if;

  if v_restore_source = 'stock_movimientos' then
    for v_row in
      select
        sm.producto_id,
        sm.variante_id,
        coalesce(sm.cantidad_base, sm.cantidad, 0)::numeric as cantidad_base,
        coalesce(sm.cantidad, sm.cantidad_base, 0)::numeric as cantidad,
        coalesce(nullif(sm.unidad, ''), 'unidad') as unidad,
        sm.id as source_id
      from public.stock_movimientos sm
      where sm.tipo = 'venta'
        and sm.producto_id is not null
        and (
          sm.venta_id = p_venta_id
          or sm.observaciones ilike ('%venta #' || p_venta_id || '%')
        )
      order by sm.id
    loop
      v_qty_base := coalesce(v_row.cantidad_base, 0);
      v_qty_visible := coalesce(v_row.cantidad, v_qty_base);
      v_unidad := coalesce(v_row.unidad, 'unidad');
      if v_qty_base <= 0 then
        continue;
      end if;

      select
        p.user_id,
        p.nombre,
        coalesce(p.stock, 0)::numeric as stock,
        coalesce(p.factor_conversion, 0)::numeric as factor_conversion,
        coalesce(cardinality(p.unidades_alternativas), 0) as alternativas_count
      into v_producto
      from public.productos p
      where p.user_id = v_row.producto_id
      for update;

      if not found then
        raise exception 'Producto no encontrado para restaurar stock (%)', v_row.producto_id;
      end if;

      if v_row.variante_id is not null then
        select coalesce(stock_decimal, stock, 0)::numeric
        into v_stock_antes
        from public.producto_variantes
        where id = v_row.variante_id
        for update;

        if not found then
          raise exception 'Variante no encontrada para restaurar stock (%)', v_row.variante_id;
        end if;

        v_stock_despues := v_stock_antes + v_qty_base;

        update public.producto_variantes
        set stock_decimal = v_stock_despues,
            stock = floor(v_stock_despues)
        where id = v_row.variante_id;

        update public.productos
        set stock = (
          select coalesce(sum(coalesce(pv.stock_decimal, pv.stock, 0)), 0)
          from public.producto_variantes pv
          where pv.producto_id = v_row.producto_id
            and coalesce(pv.activo, true) = true
        )
        where user_id = v_row.producto_id;
      else
        v_stock_antes := v_producto.stock;
        v_stock_despues := v_stock_antes + v_qty_base;

        update public.productos
        set stock = v_stock_despues
        where user_id = v_row.producto_id;
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
        motivo,
        metadata
      )
      values (
        v_row.producto_id,
        v_row.variante_id,
        'anulacion_venta',
        v_qty_visible,
        v_unidad,
        v_qty_base,
        p_admin_id,
        p_admin_email,
        'Stock restaurado por eliminacion de venta ' || p_venta_id,
        v_stock_antes,
        v_stock_despues,
        'venta_eliminada',
        jsonb_build_object(
          'venta_eliminada_id', p_venta_id,
          'source', v_restore_source,
          'source_movimiento_id', v_row.source_id,
          'motivo', p_motivo
        )
      );

      v_restored_count := v_restored_count + 1;
    end loop;
  else
    for v_row in
      select
        vd.producto_id,
        vd.variante_id,
        coalesce(vd.cantidad_base, vd.cantidad, 0)::numeric as cantidad_base,
        coalesce(vd.cantidad, vd.cantidad_base, 0)::numeric as cantidad,
        coalesce(nullif(vd.unidad, ''), 'unidad') as unidad,
        vd.id as source_id
      from public.ventas_detalle vd
      where vd.venta_id = p_venta_id
        and coalesce(vd.tipo, 'producto') = 'producto'
        and vd.producto_id is not null
      order by vd.id
    loop
      v_qty_base := coalesce(v_row.cantidad_base, 0);
      v_qty_visible := coalesce(v_row.cantidad, v_qty_base);
      v_unidad := coalesce(v_row.unidad, 'unidad');
      if v_qty_base <= 0 then
        continue;
      end if;

      select
        p.user_id,
        p.nombre,
        coalesce(p.stock, 0)::numeric as stock,
        coalesce(p.factor_conversion, 0)::numeric as factor_conversion,
        coalesce(cardinality(p.unidades_alternativas), 0) as alternativas_count
      into v_producto
      from public.productos p
      where p.user_id = v_row.producto_id
      for update;

      if not found then
        raise exception 'Producto no encontrado para restaurar stock (%)', v_row.producto_id;
      end if;

      if v_row.variante_id is not null then
        select coalesce(stock_decimal, stock, 0)::numeric
        into v_stock_antes
        from public.producto_variantes
        where id = v_row.variante_id
        for update;

        if not found then
          raise exception 'Variante no encontrada para restaurar stock (%)', v_row.variante_id;
        end if;

        v_stock_despues := v_stock_antes + v_qty_base;

        update public.producto_variantes
        set stock_decimal = v_stock_despues,
            stock = floor(v_stock_despues)
        where id = v_row.variante_id;

        update public.productos
        set stock = (
          select coalesce(sum(coalesce(pv.stock_decimal, pv.stock, 0)), 0)
          from public.producto_variantes pv
          where pv.producto_id = v_row.producto_id
            and coalesce(pv.activo, true) = true
        )
        where user_id = v_row.producto_id;
      else
        v_stock_antes := v_producto.stock;
        v_stock_despues := v_stock_antes + v_qty_base;

        update public.productos
        set stock = v_stock_despues
        where user_id = v_row.producto_id;
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
        motivo,
        metadata
      )
      values (
        v_row.producto_id,
        v_row.variante_id,
        'anulacion_venta',
        v_qty_visible,
        v_unidad,
        v_qty_base,
        p_admin_id,
        p_admin_email,
        'Stock restaurado por eliminacion de venta ' || p_venta_id,
        v_stock_antes,
        v_stock_despues,
        'venta_eliminada',
        jsonb_build_object(
          'venta_eliminada_id', p_venta_id,
          'source', v_restore_source,
          'source_detalle_id', v_row.source_id,
          'motivo', p_motivo
        )
      );

      v_restored_count := v_restored_count + 1;
    end loop;
  end if;

  -- La evidencia original es inmutable. No se borran ni reescriben venta,
  -- detalles, pagos, caja o movimientos; la restitucion anterior constituye
  -- la partida inversa y la venta queda fuera de las vistas operativas por estado.
  update public.ventas
  set estado = 'anulada',
      error_message = concat('Anulada por ', coalesce(p_admin_email, 'administrador'),
        ': ', coalesce(nullif(trim(p_motivo), ''), 'Sin motivo informado'))
  where id = p_venta_id;

  return jsonb_build_object(
    'id', p_venta_id,
    'deleted', true,
    'stock_restored_rows', v_restored_count,
    'source', v_restore_source
  );
end;
$$;

commit;
