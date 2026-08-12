-- Crea el punto de apertura del ledger para stock heredado SIN_LEDGER.
-- No actualiza productos, variantes ni movimientos históricos.
-- Es idempotente: una vez creada la apertura, la vista deja de devolver SIN_LEDGER.
begin;

-- La apertura puede ser cero; las operaciones normales siguen exigiendo cantidad > 0.
alter table public.stock_movimientos
  drop constraint if exists stock_movimientos_cantidad_base_positiva;
alter table public.stock_movimientos
  add constraint stock_movimientos_cantidad_base_positiva
  check (
    cantidad_base is null
    or cantidad_base > 0
    or (tipo = 'apertura_ledger' and cantidad_base = 0)
  ) not valid;

-- Aperturas de productos sin variantes activas.
insert into public.stock_movimientos (
  producto_id, variante_id, tipo, cantidad, unidad, cantidad_base, unidad_base,
  factor_conversion, stock_antes, stock_despues, pais_id, sucursal_id, motivo,
  correlation_id, transaction_id, metadata, resultado, observaciones
)
select
  r.producto_id, null, 'apertura_ledger', r.stock_sistema,
  coalesce(nullif(p.unidad_base, ''), 'unidad'), r.stock_sistema,
  coalesce(nullif(p.unidad_base, ''), 'unidad'), nullif(p.factor_conversion, 0),
  0, r.stock_sistema, p.pais_id, p.sucursal_id,
  'Apertura controlada de saldo heredado sin ledger reconstruible',
  gen_random_uuid(), txid_current(),
  jsonb_build_object(
    'origen', 'bootstrap_inventory_ledger',
    'saldo_heredado', true,
    'historia_previa_reconstruible', false,
    'stock_no_modificado', true
  ),
  'OK', 'Punto de apertura contable; no modifica el stock físico ni el snapshot'
from public.inventory_reconciliation r
join public.productos p on p.user_id = r.producto_id
where r.estado = 'SIN_LEDGER'
  and r.variante_id is null
  and r.stock_sistema >= 0;

-- Aperturas independientes para cada variante activa.
insert into public.stock_movimientos (
  producto_id, variante_id, tipo, cantidad, unidad, cantidad_base, unidad_base,
  factor_conversion, stock_antes, stock_despues, pais_id, sucursal_id, motivo,
  correlation_id, transaction_id, metadata, resultado, observaciones
)
select
  r.producto_id, r.variante_id, 'apertura_ledger', r.stock_sistema,
  coalesce(nullif(p.unidad_base, ''), 'unidad'), r.stock_sistema,
  coalesce(nullif(p.unidad_base, ''), 'unidad'), nullif(p.factor_conversion, 0),
  0, r.stock_sistema, p.pais_id, p.sucursal_id,
  'Apertura controlada de saldo heredado sin ledger reconstruible',
  gen_random_uuid(), txid_current(),
  jsonb_build_object(
    'origen', 'bootstrap_inventory_ledger',
    'saldo_heredado', true,
    'historia_previa_reconstruible', false,
    'stock_no_modificado', true,
    'color', pv.color
  ),
  'OK', 'Punto de apertura contable de variante; no modifica el stock físico ni el snapshot'
from public.inventory_reconciliation r
join public.productos p on p.user_id = r.producto_id
join public.producto_variantes pv on pv.id = r.variante_id and pv.producto_id = r.producto_id
where r.estado = 'SIN_LEDGER'
  and r.variante_id is not null
  and r.stock_sistema >= 0;

commit;

-- Resultado obligatorio después del commit: SIN_LEDGER=0 e INCONSISTENCIA_CRITICA=0.
select estado, count(*)
from public.inventory_reconciliation
group by estado
order by estado;
