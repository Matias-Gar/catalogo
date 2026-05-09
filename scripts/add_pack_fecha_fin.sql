alter table public.packs
add column if not exists fecha_fin date;

create index if not exists idx_packs_fecha_fin
on public.packs(fecha_fin);
