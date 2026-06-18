begin;

alter table public.productos
  add column if not exists archivado boolean not null default false;

update public.productos
set archivado = false
where archivado is null;

alter table public.productos
  alter column archivado set default false,
  alter column archivado set not null;

create index if not exists idx_productos_archivado_scope
  on public.productos(pais_id, sucursal_id, vista_producto, archivado, category_id);

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
where coalesce(p.archivado, false) = false
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
