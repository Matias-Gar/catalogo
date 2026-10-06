export function dateRange(from, to) {
  const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to) || from > to) throw new Error('Selecciona un rango de fechas válido.');
  const start = new Date(`${from}T00:00:00-04:00`);
  const end = new Date(`${to}T00:00:00-04:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function movementGroup(row) {
  const type = String(row.tipo || '').toLowerCase();
  if (type === 'apertura_ledger') return 'apertura';
  if (['anulacion_venta', 'devolucion'].includes(type)) return 'devoluciones';
  if (['venta', 'venta_anulada'].includes(type)) return 'ventas';
  if (['salida', 'ajuste_negativo', 'transferencia_salida', 'muestra'].includes(type)) {
    return /muestr/i.test(`${row.motivo || ''} ${row.observaciones || ''} ${type}`) ? 'muestras' : 'salidas';
  }
  if (['ingreso', 'entrada', 'aumento', 'ajuste_positivo', 'transferencia_entrada', 'stock_inicial', 'creacion'].includes(type)) return 'ingresos';
  return 'otros';
}

export function buildReport(products, movements, variants) {
  // Alta with variants writes both per-variant stock_inicial and a parent creacion.
  const initialProducts = new Set(movements.filter(m => m.tipo === 'stock_inicial').map(m => String(m.producto_id)));
  const events = movements.filter(m => (!m.resultado || m.resultado === 'OK') && !(m.tipo === 'creacion' && initialProducts.has(String(m.producto_id))))
    .map(m => ({ ...m, group: movementGroup(m), quantity: Number(m.cantidad_base ?? m.cantidad ?? 0) }));
  const rows = new Map(products.map(p => [String(p.user_id), { ...p, ingresos: 0, ventas: 0, devoluciones: 0, muestras: 0, salidas: 0, apertura: 0, otros: 0, movimientos: 0, actual: Number(p.stock || 0) }]));
  const variantStock = new Map();
  for (const v of variants.filter(v => v.activo !== false)) variantStock.set(String(v.producto_id), (variantStock.get(String(v.producto_id)) || 0) + Number(v.stock_decimal ?? v.stock ?? 0));
  for (const [id, stock] of variantStock) if (rows.has(id)) rows.get(id).actual = stock;
  for (const m of events) {
    const id = String(m.producto_id);
    if (!rows.has(id)) rows.set(id, { user_id: id, nombre: `Producto ${id} (sin ficha)`, ingresos: 0, ventas: 0, devoluciones: 0, muestras: 0, salidas: 0, apertura: 0, otros: 0, movimientos: 0, actual: null });
    const row = rows.get(id);
    row[m.group] += m.quantity;
    row.movimientos += 1;
  }
  return { rows: [...rows.values()], events };
}
