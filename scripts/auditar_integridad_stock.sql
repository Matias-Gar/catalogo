-- Auditoria de solo lectura. No modifica inventario.
-- Ejecutar en Supabase SQL Editor y comparar las filas resultantes con el conteo fisico.

-- 1. Producto cuyo total no coincide con la suma autoritativa de variantes.
select
  p.pais_id,
  p.sucursal_id,
  p.user_id as producto_id,
  p.nombre,
  p.stock as stock_producto,
  coalesce(sum(coalesce(pv.stock_decimal, pv.stock, 0)) filter (where coalesce(pv.activo, true)), 0) as stock_variantes,
  p.stock - coalesce(sum(coalesce(pv.stock_decimal, pv.stock, 0)) filter (where coalesce(pv.activo, true)), 0) as diferencia
from public.productos p
join public.producto_variantes pv on pv.producto_id = p.user_id
group by p.pais_id, p.sucursal_id, p.user_id, p.nombre, p.stock
having abs(p.stock - coalesce(sum(coalesce(pv.stock_decimal, pv.stock, 0)) filter (where coalesce(pv.activo, true)), 0)) > 0.0001
order by abs(p.stock - coalesce(sum(coalesce(pv.stock_decimal, pv.stock, 0)) filter (where coalesce(pv.activo, true)), 0)) desc;

-- 2. Variantes con entero legado distinto del piso del decimal.
select
  p.pais_id,
  p.sucursal_id,
  p.nombre,
  pv.id as variante_id,
  pv.color,
  pv.stock as stock_entero,
  pv.stock_decimal,
  floor(coalesce(pv.stock_decimal, pv.stock, 0)) as entero_esperado
from public.producto_variantes pv
join public.productos p on p.user_id = pv.producto_id
where pv.stock_decimal is not null
  and pv.stock is distinct from floor(pv.stock_decimal)
order by p.nombre, pv.color;

-- 3. Movimientos de venta cuyo antes/despues no cuadra con la cantidad base.
select
  sm.pais_id,
  sm.sucursal_id,
  sm.producto_id,
  sm.variante_id,
  sm.venta_id,
  sm.cantidad,
  sm.unidad,
  sm.cantidad_base,
  sm.stock_antes,
  sm.stock_despues,
  (sm.stock_antes - sm.cantidad_base) as stock_despues_esperado
from public.stock_movimientos sm
where sm.tipo = 'venta'
  and sm.stock_antes is not null
  and sm.stock_despues is not null
  and abs(sm.stock_despues - (sm.stock_antes - sm.cantidad_base)) > 0.0001
order by sm.created_at desc;

-- 4. Detalles duplicados o sin un unico movimiento de salida asociado.
select
  vd.venta_id,
  vd.id as detalle_id,
  vd.producto_id,
  vd.variante_id,
  vd.cantidad,
  vd.cantidad_base,
  count(sm.*) as movimientos_venta
from public.ventas_detalle vd
left join public.stock_movimientos sm
  on sm.detalle_id = vd.id
 and sm.venta_id = vd.venta_id
 and sm.tipo = 'venta'
group by vd.venta_id, vd.id, vd.producto_id, vd.variante_id, vd.cantidad, vd.cantidad_base
having count(sm.*) <> 1
order by vd.venta_id desc;

-- 5. Sucursales inexistentes o cruzadas de pais en datos operativos.
select 'categorias' as tabla, c.id::text as registro_id, c.pais_id, c.sucursal_id
from public.categorias c
left join public.sucursales s on s.id = c.sucursal_id
where s.id is null or s.pais_id <> c.pais_id
union all
select 'productos', p.user_id::text, p.pais_id, p.sucursal_id
from public.productos p
left join public.sucursales s on s.id = p.sucursal_id
where s.id is null or s.pais_id <> p.pais_id
union all
select 'ventas', v.id::text, v.pais_id, v.sucursal_id
from public.ventas v
left join public.sucursales s on s.id = v.sucursal_id
where s.id is null or s.pais_id <> v.pais_id;
