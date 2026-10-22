# Revisión de pedido, promoción, venta e inventario

Fecha: 22 de octubre de 2026. Alcance: recorrido público de catálogo y pedido, WhatsApp, carga del pedido en ventas, cesta de venta, validación del servidor, RPC de venta y SQL de restitución de stock. No equivale a certificar cada línea de todo el repositorio.

## Causa confirmada con el pedido 8

El pedido guardó correctamente el importe promocional, pero también lo colocó en `precio_original`. La conversión volvió a usar esa referencia ya rebajada y aplicó de nuevo el 25%.

| Producto | Cantidad | Base unitaria | Con una promoción | Total correcto |
| --- | ---: | ---: | ---: | ---: |
| Guardián de la Cripta | 1 | 140,00 | 105,00 | 105,00 |
| Pacto Eterno | 1 | 140,00 | 105,00 | 105,00 |
| Cráneo Encantado | 6 | 150,00 | 112,50 | 675,00 |
| Capibara Banana | 1 | 40,00 | 40,00 | 40,00 |
| Total | | 1.220,00 | | **925,00** |

El segundo descuento produce **703,78** al redondear por unidad. La diferencia es **221,22**. Es una diferencia reproducida en el cálculo, no una afirmación de pérdida cobrada: el pedido 8 consultado sigue pendiente.

## Cambios de implementación

- `saleDiscountPolicy.mjs` determina la promoción, su vigencia y el precio con centavos. Empates de fechas se resuelven por ID de forma estable.
- `orderPricing.mjs` cotiza pedidos en el servidor con productos, variantes, unidades y packs de la sucursal verificada; ignora precios y referencias originales enviados por el navegador.
- La API guarda la cotización y devuelve el detalle guardado. WhatsApp se construye con ese detalle mediante una sola función. Si el total confirmado por el cliente cambió, bloquea el envío antes de guardar y pide revisar.
- Los reintentos con la misma clave devuelven el mismo pedido. Otra sesión, sucursal o cantidad con esa clave provoca conflicto. La creación del pedido no escribe stock.
- La conversión recupera el precio base de producto/variante desde BD; no confía en `precio_original` de pedidos antiguos. Se comprobó también el caso real del producto 204 del pedido 5.
- La cesta de ventas obtiene precios del catálogo y no vuelve a mutar su precio base al cambiar promociones. Su almacenamiento está separado por sucursal.
- `cartPricing.ts` mantiene estable el precio unitario al redondear cantidades convertidas y ajusta el máximo manual fraccionario para coincidir con la validación del servidor.
- El servidor acepta exactamente el precio promocional autorizado; rechaza tanto una segunda rebaja como cobrar sin aplicar la promoción.
- La venta conserva el guardado transaccional único en `crear_venta_completa_segura`. El navegador no escribe por separado existencias, detalles o caja.
- La API de catálogo de WhatsApp dejó de tener una copia de las reglas de promoción; usa el mismo cálculo y falla si no puede verificar promociones.

## Verificación de datos reales, de solo lectura

- Inventario: 362 productos, 411 variantes, 1.014 movimientos, 97 detalles y 0 transferencias. El auditor existente no detectó inconsistencias en sus comprobaciones de ecuaciones de movimientos, cantidades negativas, sincronización y movimientos por detalle.
- Precios: 50 ventas, 97 detalles, 362 productos, 13 promociones y 7 pedidos. Pedidos 5 y 8 con referencias originales incorrectas. No aparecieron ventas por debajo del precio promocional de referencia en el auditor. El cálculo utiliza precios/promociones actuales evaluados a la fecha de venta; no sustituye un historial de cambios ni descarta cobros externos o pérdidas no registradas. Resultado en `pricing-audit.json`.
- No se modificaron pedidos históricos, ventas ni existencias durante estas consultas.

## Pruebas

- 105 pruebas de `tests/*.test.mjs`, todas aprobadas con Node y aislamiento desactivado para este entorno. Incluyen pruebas unitarias, endpoints con dependencias simuladas y modelos de invariantes; no todas ejecutan SQL real.
- 15 recorridos de catálogo en Chromium de escritorio y 15 en tamaño móvil. Se interceptan APIs; la respuesta del pedido se cotiza con el motor real de precios. Incluyen 25%, precio fijo, descuento absoluto, vencimiento, fecha futura, variantes, fracciones, cestas antiguas, recarga, centavos, descuento 100%, fallo de guardado y cambio de precio durante envío.
- Recorrido real de la interfaz de administración del pedido 8 con sesión y APIs simuladas: total visible 925, payload 925, precio unitario de Cráneo 112,50; un fallo conserva la cesta; el reintento usa la misma clave; cero escrituras directas de inventario.
- Compilación de producción (`npm run build`) y TypeScript aprobados. Lint de motor de precios, APIs y pruebas nuevas aprobado. Las pantallas y hooks conservan incidencias de lint anteriores; el lint global no se declara aprobado.

## Inventario: protección de anulación que requiere instalación SQL

El SQL del repositorio de `eliminar_venta_con_restock` carecía de una salida temprana para una venta ya anulada. Se agregó la comprobación después del bloqueo `FOR UPDATE`. Una segunda llamada devuelve cero filas restituidas. El instalador aislado está en `scripts/guard_sale_restock_once.sql`; no ejecuta la migración general de normalización de stock.

Esta protección se revisó en el código SQL, pero **no está instalada ni probada contra la función de producción** desde esta sesión. No hay conexión SQL administrativa configurada (`DATABASE_URL`) ni una herramienta SQL conectada. La integridad actual de los datos no prueba por sí sola el comportamiento de futuros reintentos de esa función.

## Estado de publicación

Los cambios de aplicación son locales. Para proteger el sitio operativo se requiere desplegar esta versión y verificar el pedido 8 allí. La protección adicional de anulación requiere revisar la definición instalada y aplicar su migración por una conexión SQL administrativa. No se debe presentar el trabajo como desplegado ni como una certificación sin errores de producción.
