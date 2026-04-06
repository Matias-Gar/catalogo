-- Agrega columnas necesarias para analisis financiero real por venta.
-- Seguro para ejecutar una sola vez en Supabase.

begin;

alter table public.ventas_detalle
  add column if not exists costo_unitario numeric default 0;

alter table public.ventas_detalle
  add column if not exists color text;

alter table public.ventas_detalle
  add column if not exists variante_id bigint;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'ventas_detalle'
      and constraint_name = 'ventas_detalle_variante_id_fkey'
  ) then
    alter table public.ventas_detalle
      add constraint ventas_detalle_variante_id_fkey
      foreign key (variante_id) references public.producto_variantes(id);
  end if;
end $$;

update public.ventas_detalle vd
set costo_unitario = coalesce(p.precio_compra, 0)
from public.productos p
where vd.producto_id = p.user_id
  and (vd.costo_unitario is null or vd.costo_unitario = 0);

update public.ventas_detalle vd
set color = pv.color,
    variante_id = coalesce(vd.variante_id, pv.id)
from public.producto_variantes pv
where vd.producto_id = pv.producto_id
  and vd.color is null
  and pv.color is not null
  and exists (
    select 1
    from public.ventas v
    where v.id = vd.venta_id
  );

commit;