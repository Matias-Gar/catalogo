# Revisión de integración QR Red Enlace

Fecha: 2026-10-22. Alcance: revisión técnica; no se habilitaron cobros ni se modificó el flujo de ventas.

Fuente: https://openhub.redenlace.com.bo/es/products/apis-de-cobro-mediante-qr/cobro-por-qr-koibanx

## Producto y requisitos

El enlace documenta QR con liquidación en activos virtuales: UT (USDT), UP (USDC) y BK. No asumir que corresponde al producto QR SIMPLE. Confirmar con el comercio qué liquidación necesita antes de implementar.

ATC debe habilitar al integrador y entregar credenciales por ambiente. Sandbox: `https://atcgwapitest.redenlace.com.bo/sandbox`. Producción: `https://api.redenlace.com.bo`. Se necesita una URL HTTPS pública para el webhook.

## Encaje en este proyecto

- `app/admin/ventas/nueva/NuevaVenta.tsx`: selecciona métodos e importes y envía pagos al backend; aquí se incorporaría generar QR, imagen, vencimiento y consulta de estado para el importe de la parte QR, incluidos pagos mixtos.
- `app/api/admin/ventas/crear/route.js`: valida permisos, descuentos y usa `crear_venta_completa_segura` con idempotencia. Debe exigir una transacción confirmada y compatible con la venta para pagos del proveedor. No confiar en un estado enviado desde el navegador.
- `scripts/harden_sales_stock_flow.sql`: registra `ventas_pagos`. La asociación entre transacción confirmada y pago debe consumirse una sola vez en la misma transacción de base de datos que finaliza la venta.
- `hooks/useQrStats.js`: muestra movimientos registrados; actualmente no verifica cobros con un proveedor.
- `app/admin/configuracion/generador-qr/page.js`: genera imágenes QR de contenido libre; no es el servicio de cobro.

## Flujo propuesto

1. Backend autenticado verifica usuario, país, sucursal e importe calculado en servidor. Congelar el pedido/importe o invalidar el intento al cambiar el carrito.
2. Persistir intento de cobro y referencia del comercio única antes de llamar al proveedor. Obtener token OAuth en servidor y generar el QR.
3. Guardar referencia ATC, importe, moneda, activo, conversión y expiración; devolver al navegador únicamente datos de presentación y un identificador local.
4. Recibir webhook autenticado y consultar el estado a ATC antes de acreditar. La consulta usa la referencia ATC, distinta de la del comercio. Comprobar referencia, importe y moneda.
5. Persistir confirmación de forma idempotente. La consulta periódica del backend permite reconciliar si falta el webhook. No marcar pagado por mostrar la imagen, por un temporizador o por una señal del navegador.
6. Vincular el pago confirmado a la venta mediante operación atómica, sin duplicar pago, caja o descuento de stock. Registrar y reconciliar cobros confirmados cuya venta no pudo finalizar, especialmente por falta de stock.

Crear una tabla dedicada de intentos con propietario, país, sucursal, pedido, importe exacto, moneda, referencias únicas, estado, timestamps y venta/pago asociado. Aplicar RLS; las actualizaciones de estado y la confirmación corresponden al backend. Mantener estado del cobro separado del estado de finalización de venta.

Rutas propuestas: POST `/api/admin/pagos/redenlace`, GET `/api/admin/pagos/redenlace/[id]` y POST `/api/webhooks/redenlace`. Reutilizar `requireAdminAccess` y verificar pertenencia de cada intento. El webhook usa su propia autenticación, sin sesión de usuario.

## Contrato publicado y dudas por resolver con ATC

- OAuth: POST `/oauth-client-credentials/access-token?grant_type=client_credentials`, autorización Basic y contenido form-urlencoded. Guardar token y expiración solo en servidor.
- Generación: POST `/qr/koibanx/v2/generar`; consulta: GET `/qr/koibanx/v2/estado/{numeroReferencia}`.
- La cabecera general indica `Authorization: Bearer`, pero los ejemplos específicos usan `access_token`. Confirmar contrato efectivo en sandbox.
- La tabla limita el vencimiento a 30–90 segundos, pero los ejemplos usan 180. Confirmar rango; provisionalmente utilizar 90.
- La glosa aparece separada por comas en la descripción y por barras verticales en ejemplos. Confirmar formato y códigos de sucursal/rubro.
- Generación muestra datos en raíz, mientras otra sección menciona `data.numeroReferencia`. Validar esquema real.
- No se publica un contrato detallado del payload del webhook, política de reintentos, firma, zona horaria de expiración ni garantía de idempotencia al generar. Solicitar estos datos. Ante timeout de generación, no reintentar a ciegas: podría existir un cobro creado.

Estados publicados: PENDING, SUCCESS, CANCELLED, EXPIRED y ERROR. Un error de red no prueba cancelación ni ausencia de cobro; conservar el intento para reconciliación.

## Configuración propuesta

Variables privadas, sin prefijo NEXT_PUBLIC: `REDENLACE_BASE_URL`, `REDENLACE_CLIENT_ID`, `REDENLACE_BASIC_TOKEN`, `REDENLACE_WEBHOOK_URL`, `REDENLACE_WEBHOOK_SECRET`, `REDENLACE_ACTIVO_VIRTUAL`. Definir además códigos comerciales/sucursales con ATC. No reutilizar las credenciales de ejemplo ni registrar secretos o tokens en logs.

## Validación previa a producción

Probar OAuth y renovación, generación y expiración, confirmación real en sandbox, callbacks duplicados o inválidos, discrepancia de monto/moneda, permisos entre sucursales, pagos mixtos, timeout de generación y consumo simultáneo del mismo pago. Simular fallo al finalizar venta después del cobro y verificar reconciliación. Completar certificación y credenciales de producción con ATC.
