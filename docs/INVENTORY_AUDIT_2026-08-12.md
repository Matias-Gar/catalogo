# Auditoría de inventario — 2026-08-12

## Veredicto

El sistema **no cumple todavía** el criterio de aprobación. La venta principal usa
`crear_venta_completa` con bloqueo `FOR UPDATE` y transacción PostgreSQL, pero existen
rutas administrativas y heredadas que escriben stock y auditoría en operaciones
separadas. No hay evidencia de idempotencia persistente en ventas ni RLS completa en
los scripts versionados. No se ejecutaron pruebas destructivas ni de carga contra la
base configurada.

## Mapa de mutaciones

Entrada/alta: `api/admin/productos/nuevo` y páginas heredadas -> `productos`,
`producto_variantes` -> `stock_movimientos`/`productos_historial`.

Aumento/ajuste: `api/admin/productos/aumentar-stock` y páginas heredadas -> actualización
directa -> movimiento posterior.

Edición: `api/admin/productos/editar` -> variantes/producto -> movimiento posterior.

Venta: `api/admin/ventas/crear` -> RPC `crear_venta_completa` -> venta, detalle, pago,
stock y movimiento en una transacción. Usa `cantidad_base`, valida la conversión y
bloquea producto/variante.

Cancelación: RPC `eliminar_venta_con_restock` -> reversión y movimiento; conserva venta
según el SQL endurecido.

Transferencia: `api/admin/productos/transferir` -> RPC `transferir_stock_sucursal` ->
salida/entrada y dos movimientos.

Snapshot/lectura: `productos.stock`; para variantes, `producto_variantes.stock_decimal`
es canónico y `stock` es un entero legado derivado.

## Hallazgos

### Críticos

1. Altas, edición y aumentos no son atómicos con el ledger. Un error entre `update` e
   `insert stock_movimientos` deja stock sin trazabilidad; la causa raíz es lógica de
   negocio distribuida en endpoints/páginas y no una única RPC.
2. Las páginas cliente todavía pueden insertar `stock_movimientos` directamente. Sin
   RLS/revocación efectiva, un cliente puede fabricar auditoría; con revocación, esas
   pantallas fallarán hasta migrarlas a endpoints/RPC.
3. No existe idempotency key persistente en `crear_venta_completa`. Doble envío o retry
   puede crear dos ventas válidas y descontar dos veces.

### Altos

1. `services/ventas.service.ts` exponía mutaciones `leer -> calcular -> update` y
   setters directos, sin ledger y vulnerables a lost updates. Fueron retirados al no
   tener consumidores.
2. Los scripts versionados contienen RLS de inventario comentada; no se puede demostrar
   desde el repositorio que `anon/authenticated` carezcan de escritura directa.
3. Crear producto/variantes/imágenes/historial usa múltiples requests, sin rollback
   común.
4. Los intentos fallidos sólo llegan a logs/respuesta HTTP; no hay bitácora persistente
   separada del ledger exitoso.

### Medios

1. Conviven `stock`, `stock_decimal`, `cantidad` y `cantidad_base`; esto aumenta el
   riesgo de usar la representación equivocada.
2. La tolerancia no es uniforme (`0.0001` en SQL y `0.000001` en pruebas).
3. El campo visible `ventas_detalle.cantidad` se redondea por compatibilidad; la
   contabilidad correcta depende exclusivamente de `cantidad_base`.

## Correcciones preparadas

- Se eliminaron del servicio los fallbacks y setters directos sin consumidores.
- `harden_inventory_ledger.sql` agrega metadatos de correlación, tabla separada de
  intentos fallidos, restricciones para nuevas filas, inmutabilidad, revocaciones y
  vista `inventory_reconciliation`. Debe aplicarse primero en staging.
- Las pruebas cubren ahora la matriz de precisión solicitada, 10.000 operaciones,
  límite 10/20 e idempotencia del modelo.
- La venta segura exige `Idempotency-Key`, bloquea el pedido pendiente y confirma
  pedido, venta, stock y ledger en una única transacción.
- La eliminación administrativa es ahora archivo lógico: desaparece de las vistas,
  desactiva variantes y conserva ventas, detalles, movimientos e historial.
- Descartar pedidos es un cambio de estado auditado; los vencidos ya no se borran
  automáticamente desde el navegador.
- El aumento de stock se movió a una RPC que recalcula la conversión, bloquea filas y
  registra snapshot y auditoría en la misma transacción.
- La cancelación versionada dejó de borrar venta, detalles, pagos y caja, y dejó de
  reescribir movimientos originales: conserva evidencia y usa partidas inversas.

## Evidencia ejecutada

- 13/13 pruebas de invariantes aprobadas.
- 10.000 ventas fraccionadas: diferencia del modelo menor que `0.000001`.
- 20 intentos con stock 10: 10 aceptados, 10 rechazados, stock final 0.
- TypeScript y ESLint focalizado: aprobados.

Estas pruebas son del modelo local, no sustituyen pruebas PostgreSQL concurrentes.

## Reconciliación y límites

No se consultó la base remota ni se modificaron datos reales. Por ello no existe aún
un porcentaje verificable de trazabilidad ni una comparación real snapshot/ledger.
Tras aplicar la migración en staging debe consultarse `inventory_reconciliation`,
ejecutar `auditar_integridad_stock.sql` y `auditar_stock_runtime.mjs`, y conservar el
resultado como artefacto.

## Trabajo obligatorio pendiente

1. Migrar alta, edición, aumento y eliminación a una sola RPC `apply_inventory_movement`.
2. Incorporar `idempotency_key` dentro de la misma transacción de venta, con índice
   único y retorno del resultado original.
3. Pasar integración real contra PostgreSQL aislado: 2/5/10/50/100 clientes,
   rollback inducido en cada etapa, fuzz/property-based con seed y 100/1.000/10.000
   operaciones.
4. Auditar políticas y grants efectivos (`pg_policies`, `information_schema`) con roles
   anon, vendedor, almacén y admin.
5. Migrar las páginas heredadas antes de activar las revocaciones del ledger.
6. Fijar una política única: `numeric`, escala documentada y comparación exacta a esa
   escala; no usar tolerancias distintas como regla contable.
