import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, dateRange, movementGroup } from '../lib/inventoryReports.mjs';

test('fechas inclusivas en Bolivia, incluso cambio de mes', () => {
  assert.deepEqual(dateRange('2026-09-30', '2026-10-01'), { start: '2026-09-30T04:00:00.000Z', end: '2026-10-02T04:00:00.000Z' });
  assert.throws(() => dateRange('2026-02-30', '2026-03-01'));
  assert.throws(() => dateRange('2026-10-02', '2026-10-01'));
});

test('alta con variantes no duplica ingresos y stock usa variantes activas decimales', () => {
  const { rows } = buildReport([{ user_id: 1, stock: 99 }], [
    { producto_id: 1, tipo: 'creacion', cantidad_base: 12 },
    { producto_id: 1, tipo: 'stock_inicial', cantidad_base: 5 },
    { producto_id: 1, tipo: 'stock_inicial', cantidad_base: 7 },
    { producto_id: 1, tipo: 'apertura_ledger', cantidad_base: 50 },
    { producto_id: 1, tipo: 'venta', cantidad_base: 2, resultado: 'RECHAZADO' },
  ], [{ producto_id: 1, stock_decimal: 3.5 }, { producto_id: 1, stock: 7 }, { producto_id: 1, stock: 20, activo: false }]);
  assert.equal(rows[0].ingresos, 12);
  assert.equal(rows[0].actual, 10.5);
  assert.equal(rows[0].ventas, 0);
});

test('muestras, devoluciones y ventas quedan separadas', () => {
  assert.equal(movementGroup({ tipo: 'ajuste_negativo', motivo: 'Producto destinado a muestrario' }), 'muestras');
  assert.equal(movementGroup({ tipo: 'anulacion_venta' }), 'devoluciones');
  assert.equal(movementGroup({ tipo: 'venta' }), 'ventas');
  assert.equal(movementGroup({ tipo: 'transferencia_salida' }), 'salidas');
  const { rows } = buildReport([], [{ producto_id: 3, tipo: 'venta', cantidad_base: 0.5 }], []);
  assert.equal(rows[0].ventas, 0.5);
  assert.equal(rows[0].actual, null);
});
