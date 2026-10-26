# Revisión de QR Simple para el catálogo

Fecha: 2026-10-23. Alcance: revisión del código local y contrato publicado. No se habilitaron cobros, modificaron tablas ni probaron credenciales contra ATC.

Fuente: https://openhub.redenlace.com.bo/es/products/apis-de-cobro-mediante-qr/cobro-por-qr-simple

## Resultado

La integración es viable con Next.js y Supabase actuales. Falta implementar el ciclo de cobro; registrar un método QR en ventas no demuestra una confirmación bancaria. Esta revisión corresponde a QR SIMPLE en BOB; el documento INTEGRACION_REDENLACE_QR.md revisa otro producto (Koibanx).

## Puntos del código

| Archivo | Situación y cambio necesario |
| --- | --- |
| app/productos/page.js, confirmAndSendWhatsapp | Guarda el pedido, abre WhatsApp y limpia la cesta. Agregar opción de pagar QR después de guardar; conservar acceso al pedido para consultar o reanudar el pago aunque se cierre la ventana. |
| app/api/carritos-pendientes-service-role/route.js | Ya recalcula precios y promociones por país/sucursal y admite clave idempotente. Usar el total del pedido persistido para el cobro, nunca el monto enviado por el navegador. |
| lib/carritoToken.ts | Token anónimo persistido en navegador. Para nuevos endpoints públicos emitir una autorización de pago vinculada al pedido desde el servidor; no permitir consultas o generación con solo un ID incremental ni tratar usuario_id del body como identidad verificada. |
| app/admin/pedidos/page.js | Filtra pedidos con confirmado_pago y estado pendiente. Separar estado bancario de estado de atención para que un pedido pagado siga disponible hasta finalizar su venta. |
| app/api/admin/pedidos/descartar/route.js | Antes de descartar, bloquear o reconciliar intentos pendientes y cobros confirmados. |
| app/api/admin/ventas/crear/route.js | Usa crear_venta_completa_segura. Asociar y consumir el cobro confirmado dentro de la misma transacción de base de datos, comprobando pedido, país, sucursal y monto. |
| app/admin/pagos/qr/page.js | Reporta pagos registrados; ampliar con referencias ATC y conciliación. |

## Flujo propuesto

1. Guardar pedido cotizado en servidor y fijar su detalle e importe para el intento. Habilitar solo para Bolivia/BOB mediante configuración del servidor, no por la selección visual del país.
2. Crear intento local antes de llamar a ATC, con referencia del comercio única y autorización del cliente. Controlar concurrencia: no generar dos QR activos por doble clic o reintentos.
3. Obtener OAuth en backend y generar QR. Guardar referencia ATC, monto, moneda, vencimiento e imagen; mostrar QR, estado y posibilidad de retomar el pedido.
4. Recibir webhook autenticado y consultar ATC para verificar PAGADO, referencia, moneda e importe exacto. Persistir evento y confirmación de forma idempotente. Consultar también desde el backend si el webhook falta; limitar frecuencia y acceso.
5. Mostrar pago confirmado sin ocultar el pedido de atención. No volver a cobrar al convertirlo en venta. Consumir el cobro una sola vez en la operación que registra venta/pago/stock.
6. Definir reserva de stock antes de cobrar o una atención explícita para pagos sin stock. El pedido actual no constituye una reserva; si falla la venta después del pago, mantener el cobro conciliable y pendiente de atención.

Un timeout al generar no demuestra que ATC no haya creado el QR: guardar estado incierto y reconciliar, sin reintento ciego. Cambiar el carrito requiere otro intento; resolver el anterior antes de permitir otro cobro. La anulación de una venta local no equivale a devolver un pago bancario.

## Backend y persistencia propuestos

Hallazgo crítico: scripts/harden_inventory_ledger.sql define crear_venta_completa_segura rechazando pedidos con confirmado_pago=true. Por tanto, marcar ese campo al recibir el webhook impediría convertir el pedido en venta y además lo ocultaría de la lista actual. Usar estado bancario separado en intentos y adaptar conjuntamente la conversión y la lista; reservar el estado de finalización del pedido para la venta efectivizada.

- POST /api/pagos/redenlace: crear o recuperar intento autorizado del pedido.
- GET /api/pagos/redenlace/[id]: consultar estado con autorización vinculada al pedido.
- POST /api/pagos/redenlace/[id]/cancelar: cancelar un QR pendiente; verificar resultado de ATC.
- POST /api/webhooks/redenlace: autenticar cabecera secreta, registrar y reconciliar; responder 200 después de recepción durable, incluso para duplicados válidos. Recuperar fallos transitorios mediante tarea de conciliación.
- Tabla dedicada de intentos: pedido, país, sucursal, autorización, importe exacto (numeric o centavos), moneda, referencia del comercio única, referencia ATC única, estado bancario, expiración, timestamps y venta/pago asociado único. RLS sin escritura pública de estados. Separar pago confirmado de venta finalizada y conservar auditoría sin secretos ni datos bancarios innecesarios.

## Contrato ATC que debe respetarse

OAuth: POST /oauth-client-credentials/access-token?grant_type=client_credentials, Basic y application/x-www-form-urlencoded. Generación: POST /qr/simple/v2/generate. Consulta: GET /qr/simple/v2/verify/{referenciaATC}. Cancelación: POST /qr/simple/v2/cancel/{referenciaATC}. Los ejemplos de operaciones usan cabeceras access_token y client_id; validar en certificación la diferencia con la explicación general de Bearer.

La generación requiere glosa, moneda BOB, monto con hasta dos decimales, numeroReferencia del comercio, vigencia en segundos, idEstablecimiento, nombreEstablecimiento y webhook (url/key/value). Devuelve data.qr como PNG Base64 y data.numeroReferencia de ATC, distinta de la referencia originante. Estados: PENDIENTE, PAGADO, CANCELADO, EXPIRADO y ERROR.

La documentación afirma que el webhook tiene la estructura de la consulta, pero su ejemplo muestra codigoRespuesta=SUCCESS, monto y numeroReferencia en raíz. Confirmar payload real con ATC; usar la notificación para disparar la consulta autoritativa y evitar acreditar solo por interpretar ese ejemplo. Confirmar también reintentos, zona horaria de expiración, rango de vigencia, límites de consulta y recuperación de generación incierta. Cancelar solo admite QR pendiente; no describe una devolución de cobros pagados.

## Configuración y habilitación

Variables privadas propuestas: REDENLACE_BASE_URL, REDENLACE_CLIENT_ID, REDENLACE_BASIC_TOKEN, REDENLACE_WEBHOOK_URL, REDENLACE_WEBHOOK_SECRET, REDENLACE_ESTABLISHMENT_ID y REDENLACE_ESTABLISHMENT_NAME. Para varias sucursales, mapear establecimientos habilitados desde configuración del servidor. Nunca usar NEXT_PUBLIC para secretos.

Certificación publicada: https://atcgwapitest.redenlace.com.bo/sandbox/. Producción: https://api.redenlace.com.bo/. Al formar URLs conservar el prefijo /sandbox/. ATC debe proporcionar credenciales y datos reales del establecimiento por ambiente; los ejemplos no habilitan al comercio. Se necesita webhook HTTPS público y habilitación de producción.

## Validación necesaria al implementar

Probar OAuth/renovación, QR real en certificación, expiración y cancelación; webhook duplicado, inválido, anticipado y perdido; monto/moneda/referencia incorrectos; acceso entre pedidos y sucursales; doble generación y doble consumo concurrentes; timeout con resultado incierto; pedido pagado visible; conversión a venta sin segundo cobro y sin duplicar stock; fallo de venta después de pago; pagos mixtos si se extiende a caja. Verificar migraciones y funciones efectivamente desplegadas en Supabase: esta revisión solo inspeccionó el repositorio.
