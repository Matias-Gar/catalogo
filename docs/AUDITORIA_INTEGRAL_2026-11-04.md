# Auditoría técnica de Importaciones GARBLAC — 4 de noviembre de 2026

**Estado: correcciones locales validadas; permisos anónimos corregidos en el Dell y verificados desde su API. El usuario comprobó el funcionamiento y autorizó la publicación. El cierre integral de la auditoría sigue pendiente.**

## Alcance y trazabilidad

Repositorio `Matias-Gar/catalogo`. Punto inicial: `321423ff11024e733d01bc9bdfcef964cee98dce`. Árbol limpio al comenzar. Rama de trabajo `audit/integral-2026-11-04`; punto de restauración `restore/audit-2026-11-04` en el mismo commit. No se modificaron datos de ventas, clientes, precios, existencias ni archivos de Storage.

El inventario automatizado leyó 290 archivos de aplicación, scripts, SQL y pruebas, con 48.584 líneas y 38 archivos de endpoints. El detalle, tablas consultadas, RPC referenciadas y hashes está en [source-inventory.json](audit-2026-11-04/source-inventory.json). **Este inventario es un escaneo estático; no equivale a una revisión humana línea por línea ni a una prueba funcional de cada archivo.**

Se inspeccionaron manualmente los archivos o fragmentos relevantes de:

- Configuración: `package.json`, `package-lock.json`, `next.config.ts`, `playwright.config.mjs`, `eslint.config.mjs`, `proxy.js`, `.gitignore` y `app/layout.tsx`.
- Imágenes: `lib/storageImageUrl.mjs`, `lib/catalogImageSource.mjs`, `lib/catalogImageLoader.mjs`, `lib/imageOptimization.ts`, `lib/imageUploadOptimization.ts`, `components/CatalogImage.jsx`, `components/SafeImage.js`, `components/venta/ProductThumbnail.tsx`, `app/api/public/catalog-image/route.js`, `app/api/image-proxy/route.js`, y referencias a imágenes en componentes de productos, galerías, perfiles, packs y páginas administrativas.
- Catálogo y navegación: `app/page.js`, `app/productos/page.js`, `components/CatalogTypeLanding.jsx`, `components/PublicSucursalSelector.jsx`, `components/Header.js`, `components/ProductCard.js`, `components/ImageManager.js`, `lib/catalogRequest.js`, `hooks/useProductViews.js`, `hooks/useSavedPublicCountry.js`, `lib/productViews.js` y `lib/browserStorage.js`.
- Sesiones y autorización: ambas entradas `lib/SupabaseClient.js` y `.ts`, `lib/supabaseBrowser.js`, `lib/SupabaseAdminClient.js`, `lib/supabaseServer.js`, `lib/authUserFromRequest.js`, `lib/adminAccess.js`, `lib/adminPermissions.js`, `lib/carritoToken.ts`, `lib/useUserProfile.js`, `components/UserNavigation.js`, `components/AuthDebug.js`, `components/admin/SucursalContext.jsx` y `app/admin/layout.tsx`.
- Negocio y API: `app/admin/inventario/stock/page.js`, `app/admin/perfiles/page.js`, las páginas de promociones de productos y descuentos, `app/api/admin/ventas/crear/route.js`, `app/api/admin/pedidos/descartar/route.js`, `app/api/carritos-pendientes-service-role/route.js`, `app/api/cash/closure/route.js`, `services/cash.service.js`, los cuatro endpoints públicos de configuración/previsualización, los endpoints WhatsApp, `app/api/facebook/catalog/route.js`, `lib/FacebookCatalogAPI.js` y `app/api/auth/check-email/route.ts`.
- Exportación y protección SQL: `lib/exportBoxInventory.js`, `lib/boxProductCodes.mjs`, `scripts/harden-business-rpc-execution.sql`, `scripts/harden-legacy-password-resets.sql`, referencias a bloqueos e idempotencia en los scripts de inventario y ventas, y la migración nueva `scripts/restrict-anonymous-sensitive-tables.sql`.
- Pruebas: archivos de imágenes, carga del catálogo, almacenamiento del navegador, seguridad de recuperación, consistencia de pedidos, los scripts de carrito/conversión a venta, los dos escenarios Playwright y las pruebas nuevas de seguridad y presentación de inventario.

No se afirma inspección manual exhaustiva de los archivos enumerados solamente por el inventario estático. La lista de modificaciones está en [modified-files.txt](audit-2026-11-04/modified-files.txt); los archivos nuevos aparecen también en `git status` y en el inventario.

## Defectos, causas y reparaciones

| Defecto | Evidencia y causa | Reparación |
| --- | --- | --- |
| HTTP 400 de miniaturas en producción | Dos capturas Chromium registraron 50 respuestas `INVALID_IMAGE_OPTIMIZE_REQUEST` por carga. Cabecera `x-matched-path: /500`, caché MISS y respuestas que tardan varios segundos. Algunas solicitudes directas de las mismas URLs sí responden 200. La cadena anterior hacía que Vercel solicitara una función que a su vez descargaba originales grandes del Dell. | El servicio propio descarga y redimensiona con Sharp; un loader de `next/image` solicita directamente esa miniatura. Se elimina la segunda descarga/optimización anidada. No se desactiva globalmente la optimización. |
| Imágenes JFIF sin miniatura | La selección anterior de extensiones omitía `.jfif`. | Se incluyen imágenes JFIF, validando el MIME JPEG recibido. |
| Srcset administrativo ficticio | Los antiguos descriptores de ancho apuntaban siempre al mismo original. | URLs con transformaciones reales; descriptores iguales al ancho solicitado y deduplicación de anchos. El loader sustituye parámetros existentes en lugar de duplicarlos. |
| Originales grandes en miniaturas secundarias | Cabecera, ventas, perfiles, packs y galería utilizaban originales o rutas de optimización diferentes. | Servicio compartido mediante `CatalogImage`, `SafeImage` y helpers de imágenes. El visor principal conserva el original para ampliar. |
| Desplazamiento visual al cargar el catálogo | La pantalla sustituía un mensaje pequeño por toda la cuadrícula. | Esqueleto de carga que reserva espacio para las tarjetas sin modificar el diseño final. |
| Dos clientes Auth para la misma sesión | Los archivos JS y TS creaban instancias distintas. | Ambos reexportan una única instancia y adjuntan el token anónimo del carrito en cada solicitud. |
| Consultas dentro de callbacks Auth esperados por el propio cliente | Dos listeners esperaban consultas que necesitan el mismo bloqueo de sesión. | Callbacks síncronos y consulta diferida fuera del callback de Auth. No se filtran ni silencian los errores de bloqueo en Playwright. |
| Rutas públicas sin país fallaban al cargar sucursal | Se invocaban `getSavedPublicCountrySlug` y `setActiveCountrySlug` sin definición en ese módulo. | Se elimina el bloque antiguo; la selección ya procede de `useSavedPublicCountry`. |
| Filas de inventario podían lanzar ReferenceError | Helpers a nivel de módulo invocaban `formatQuantity`, declarada dentro del componente. | Se mueve el formateador al alcance compartido y se prueba con cantidades ordinarias/fraccionarias. |
| Errores ESLint de efectos y declaraciones | Referencias anteriores a declaraciones y estados síncronos en efectos. | Orden correcto de declaraciones, hooks antes de retornos condicionales y uso del programador de efectos existente. Se activa `no-undef` para detectar referencias indefinidas. |
| Fallos al bloquear localStorage en administración | El contexto de sucursal accedía directamente al almacenamiento. | Uso del almacenamiento tolerante a fallos que ya utiliza el catálogo. |
| Proxy público aceptaba destinos arbitrarios | `fetch(url)` sin restricciones de origen, redirecciones, tipo o volumen. | Solo objetos públicos del Storage propio; sin redirecciones; plazo de descarga y máximo de 16 MiB; tipos raster permitidos. |
| Mutaciones Facebook sin autorización | POST podía sincronizar o borrar con el token del servidor sin autenticar al llamante. | Verificación administrativa antes de leer el cuerpo o contactar Facebook. |
| Webhook WhatsApp sin autenticación de mensajes | POST procesaba JSON sin verificar firma; GET tenía un token de ejemplo por defecto. | HMAC SHA-256 de los bytes exactos y comparación constante; sin token por defecto. Se retiran logs de cuerpos/números personales. |
| Dependencias vulnerables | Auditoría real de npm: 45 avisos, 4 críticos y 12 altos. | Actualizaciones compatibles, Sharp 0.35.5, Nodemailer 10.3.1 y overrides revisados para gRPC, brace-expansion y UUID de ExcelJS. Resultado: 20 moderados, cero altos/críticos. |

La evidencia disponible localiza el fallo de imágenes en el encadenamiento publicado y lo reproduce bajo carga del navegador. **Sin acceso a logs internos de Vercel no se atribuye de manera concluyente el `/500` a una excepción o límite exacto de su infraestructura.** El límite de siete segundos del fetch externo está presente en el código Next instalado inicialmente; aumentar a treinta segundos el primer proxy no garantizaba que el segundo servicio esperara ese tiempo.

El nuevo servicio conserva calidad 75 para miniaturas, WebP, carga diferida, tamaños responsivos, respaldo a originales, caché pública de una hora y caché compartida de un día. Valida origen fijo, rutas públicas, anchos y calidad permitidos, MIME, tamaño anunciado y leído en transformaciones, máximo de píxeles y tiempo de transformación. No transforma SVG arbitrario ni acepta redirecciones a redes internas.

Referencias oficiales: [error de Vercel](https://vercel.com/docs/errors/invalid_image_optimize_request), [loaders de next/image](https://nextjs.org/docs/15/app/api-reference/components/image), [implementación de optimización de Next](https://github.com/vercel/next.js/blob/canary/packages/next/src/server/image-optimizer.ts).

## Pruebas y resultados

| Comprobación | Resultado / alcance |
| --- | --- |
| Línea base unitaria | 114 aprobadas. |
| Pruebas finales Node | 125/125 aprobadas antes de publicar; cero omisiones. |
| TypeScript y build | Build de producción Next 16.4.5 y comprobación TypeScript aprobados. Un intento previo detectó una inferencia `never[]` al reutilizar el componente JS desde TSX; fue corregida con su contrato de tipos y recompilada. |
| ESLint | Última ejecución aprobada: cero errores, 84 advertencias existentes. La línea base tenía 8 errores y 84 advertencias. Las advertencias no equivalen a una certificación completa del código. |
| Imágenes reales | 58/58 respuestas 200, decodificadas como imágenes válidas de ancho máximo 96 px; cero fallos. Incluye JFIF. |
| Carrito escritorio | 15/15 escenarios: promociones, variantes, cantidades fraccionarias, centavos, recuperación, fallo de guardado y cambio de precio. APIs simuladas. |
| Carrito móvil | Los mismos 15 escenarios aprobados a 390 × 844. APIs simuladas. |
| Pedido a venta | Pedido de prueba Bs 925: coincidencia UI/API, fallo conserva cesta, reintento conserva clave y ninguna escritura directa de stock. APIs simuladas. |
| Seguridad | Rechazo de redes internas, destinos ajenos y rutas privadas; Facebook rechaza 401/403 antes de operar; WhatsApp rechaza firmas falsas y valida firma correcta. Sin llamadas externas de mensajería. |
| Formato de inventario | Casos ordinario y fraccionario aprobados contra los helpers reales del módulo. |
| PDF/QR/Excel | PDF válido con QR embebido, QR raster de 256 px y exportación/importación de Excel preservando la celda. Pruebas de librerías; no certifican todos los botones de impresión. |
| Navegador con datos reales | `/bo`, `/bo/productos`, `/login` y `/reset-password`: cero errores JavaScript, cero respuestas HTTP fallidas y cero imágenes terminadas con fallo durante la observación local. Las imágenes diferidas fuera de pantalla se contabilizan separadamente. |
| Navegadores y responsive | Chromium, WebKit y Firefox aprobaron escenarios de visor en 60 rutas y nueve anchos. Las pruebas separadas de exclusión de sesiones entre pestañas aprobaron en los tres motores. El carrito invitado aprobó seis escenarios adicionales con el endpoint real y base de datos aislada. |

Los 13 eventos `requestfailed` de la navegación real local son cancelaciones `ERR_ABORTED` de solicitudes de prefetch RSC durante el desplazamiento/navegación; no son respuestas HTTP 400/500. Los escenarios que fuerzan HTTP 402 para comprobar respaldo de imágenes son pruebas controladas y no se presentan como una red sin errores.

Comandos y evidencias principales:

- `node --test --test-isolation=none tests/*.test.mjs`: [registro final](audit-2026-11-04/unit-final.log). La opción evita la restricción de subprocesos del sandbox; no omite casos.
- `npm run build`: [build final](audit-2026-11-04/build-final.log).
- `npm run lint`: [ESLint](audit-2026-11-04/lint-final.log).
- Playwright: [resultados por motor](audit-2026-11-04/browser-final.json).
- [Carrito escritorio](audit-2026-11-04/cart-final.log), [carrito móvil](audit-2026-11-04/cart-mobile-final.log), [conversión a venta](audit-2026-11-04/sale-final.log).
- [Imágenes reales](audit-2026-11-04/image-service-real.json), [captura y red de producción inicial](audit-2026-11-04/production-before.json), [cabeceras del diagnóstico](audit-2026-11-04/production-diagnostic.json), [navegación local final](audit-2026-11-04/local-final.json).

## Métricas

| Métrica | Producción inicial | Build local corregido |
| --- | --- | --- |
| HTTP fallidos observados en `/bo` | 50 errores 400 | 0 |
| LCP observado de `/bo` | 1.228 ms | 440 ms |
| CLS observado de `/bo` | 0,4645 | 0,0486 |
| 58 miniaturas a 96 px | Sin medición equivalente completa | 91.940 bytes en total |

Los LCP/CLS proceden de PerformanceObserver en Chromium sin throttling. **Producción y localhost tienen red, caché y latencia diferentes: estos valores no prueban una mejora equivalente de LCP publicada.** No se obtuvieron datos de campo INP. Lighthouse local móvil registró 80 frente a 50 en producción inicial, ambos con advertencias de timeout y el segundo de CPU; no constituyen una comparación controlada ni garantizan resultados publicados. Evidencias: lighthouse-local-mobile.json y lighthouse-production-before.json. El rendimiento final de Vercel sigue pendiente.

Cuatro pares del mismo original frente a la miniatura local a 96 px:

| Original | Miniatura | Reducción de bytes |
| --- | --- | --- |
| 1.644.302 | 1.082 | 99,93 % |
| 1.652.337 | 2.102 | 99,87 % |
| 2.234.910 | 1.418 | 99,94 % |
| 61.064 | 3.516 | 94,24 % |

La descarga y transformación de las 58 miniaturas con concurrencia tres tardó una media de 3.572 ms por solicitud; incluye cachés frías y algunas esperas superiores a siete segundos. Esto confirma por qué los archivos originales no deben descargarse para mostrar un círculo de 48 px. La caché CDN del servicio nuevo todavía requiere validación en Vercel.

## Base de datos, conexiones y bloqueo crítico

Evidencia: [database-readonly.json](audit-2026-11-04/database-readonly.json). Se usaron solicitudes HEAD con `limit=0` y recuentos: no se descargaron valores personales ni códigos de recuperación. Las comprobaciones autenticadas con la clave anónima a `/auth/v1/health` y `/auth/v1/settings` respondieron 200. No se probó iniciar sesión con credenciales reales ni enviar correos de recuperación.

Las tablas de clientes, perfiles, ventas, detalles de venta y carritos mostraron cero filas accesibles a `anon`. Sin embargo:

| Tabla | Filas visibles a `anon` | Estado |
| --- | --- | --- |
| `ventas_pagos` | 53 | Exposición pendiente de cerrar |
| `stock_movimientos` | 1.019 | Exposición pendiente de cerrar |
| `password_resets` | 2 | Exposición crítica pendiente de cerrar |

Que una tabla responda HTTP 200 con `*/0` puede ser el filtrado normal de RLS; no se confunde con ausencia de política. Los recuentos positivos anteriores sí demuestran visibilidad de filas. No se afirma conocer las políticas completas ni suprimir permisos sin haberlas leído.

SSH con clave y verificación estricta del host agotó el tiempo de conexión contra `192.168.0.17:22` y `garblac.duckdns.org:22`. No se obtuvo sesión, no se ejecutó sudo ni SQL en producción. El endpoint OpenAPI REST devolvió 401, por lo que tampoco se certificó el listado de RPC ejecutables por usuarios anónimos.

Se preparó [restrict-anonymous-sensitive-tables.sql](../scripts/restrict-anonymous-sensitive-tables.sql). Debe aplicarse después de exportar schema/ACL/policies, en una transacción con plazos de bloqueo; cierra la tabla antigua de recuperación y retira SELECT anónimo de pagos/movimientos preservando el permiso autenticado previamente disponible. **No está aplicada.** Tras aplicarla hay que repetir los recuentos anónimos, las pantallas autenticadas y la regresión de ventas/inventario. El respaldo previo de ACL/policies permite restaurar los permisos si se observa regresión.

No se hicieron migraciones estructurales, borrados ni operaciones financieras en el servidor. Los SQL históricos del repositorio no prueban que sus cambios estén instalados en la base real.

## Compatibilidad y cobertura funcional

Las pruebas usan motores instalados de Playwright: Chromium, WebKit y Firefox. WebKit no se presenta como un iPhone físico ni como Safari instalado en macOS. Chromium tampoco certifica Chrome iOS, Chrome Android ni Edge reales. Las resoluciones del escenario añadido son 320, 350, 375, 390, 414, 768, 1024, 1366 y 1920 px.

| Módulo | Cobertura efectuada | Límite |
| --- | --- | --- |
| Catálogo, categorías, búsqueda, rutas por país/tipo, galerías | Navegadores, imágenes reales y pruebas aisladas | Disponibilidad de Storage sigue siendo externa |
| Carrito, promociones, packs y precios | Unitarias y 15 escenarios por formato de pantalla | Negocio simulado; no pedidos reales |
| Pedidos/ventas/stock/caja | Suite de invariantes y servicios; conversión UI aislada | No transacción completa sobre una copia SQL del servidor actual |
| Autenticación/perfiles/permisos | Revisión de clientes, guardas, firmas y endpoints de recuperación | Sin sesiones reales de todos los roles ni recuperación por correo |
| Administración/clientes/configuración | Inventario estático y revisión dirigida | No todas las operaciones CRUD verificadas mediante una cuenta real |
| Tickets, PDF, QR, Excel | Librerías y preservación de datos en exportación/importación | Sin impresora térmica física ni todos los diálogos reales |
| Facebook/WhatsApp | Pruebas negativas de autorización y firma | No sincronización, borrado de catálogos o mensajes reales |

Las variables WhatsApp necesarias no están configuradas en el entorno local: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`. El webhook exige el secreto correcto del proveedor antes de activarse; no se añadieron secretos al repositorio. No se certificó la configuración remota de estas variables.

## Git, publicación y criterios pendientes

- Rama: `audit/integral-2026-11-04`; respaldo: `restore/audit-2026-11-04`.
- Main remoto consultado por Git: `321423ff11024e733d01bc9bdfcef964cee98dce`. La API pública de GitHub indicó `protected: false`; no se modificó protección alguna.
- Commit de auditoría: **pendiente**. Push: **no realizado**. Despliegue Vercel nuevo: **no iniciado ni verificado**.
- Se respeta la condición del encargo de publicar después de completar satisfactoriamente las correcciones y validaciones críticas. La exposición real de la base de datos sigue pendiente; no se presenta la publicación como terminada.
- La versión pública observada al inicio todavía muestra los fallos de imágenes documentados. Las correcciones descritas están en el árbol de trabajo local.

Para cerrar: recuperar acceso administrativo al Dell, respaldar y aplicar la corrección de permisos, comprobar RLS/RPC y flujos reales en un entorno aislado, revisar los 20 avisos moderados restantes de minimatch y sus dependientes, completar la verificación operativa que exige cuentas/dispositivos/impresora, realizar commit/push y comprobar el despliegue real de Vercel con las mismas pruebas de imágenes y red. No se declaran esos puntos ejecutados.

## Actualización de permisos del Dell — 4 de noviembre de 2026

El usuario ejecutó la corrección autorizada y aportó COMMIT y CORRECCION_FINALIZADA. Se bloqueó anon sobre password_resets, ventas_pagos, stock_movimientos y las seis RPC revisadas; las seis RPC conservan EXECUTE para authenticated y service_role. Se verificaron en la transacción 35 permisos efectivos de tablas que debían conservarse. Respaldo público previo: /home/matias/catalogo-permisos-20261104T145351Z/public-antes.sql (SHA256 07ab8764125d3fc72a191f5d88c530e488d25f35b43e068aa556fe7af9b094de).

La comprobación externa de la API real del Dell confirma HEAD 401 para las tres tablas sensibles y HEAD 200 para productos, categorias y producto_variantes. Evidencia: audit-2026-11-04/dell-permissions-after.json. El script genérico de lectura usa variables locales del Cloud antiguo; no utilizar su resultado para verificar el Dell.

La revisión vigente de triggers de carritos_pendientes muestra únicamente asignación/validación de país y sucursal; la vista pública depende de productos, categorias y producto_variantes. Las pruebas adicionales de carrito invitado pasaron 6/6 en Chromium, Firefox y WebKit, móvil y escritorio, con transporte de base de datos aislado y endpoint real. Detalles y límites: audit-2026-11-04/carrito-invitado.md. Sigue pendiente la comprobación funcional real tras el cambio y la auditoría de permisos entre usuarios autenticados. Esta actualización sustituye las menciones anteriores a que la corrección anónima aún no se había aplicado.

## Publicacion autorizada y ajuste visual del carrito

El usuario informo que sus pruebas posteriores al cambio del Dell funcionan mejor y autorizo commit/push. Antes de publicar solicito mejorar el contraste del boton de agregar y reproducir la distribucion de su referencia de cesta. Se incorporo un icono + blanco sobre fondo verde azulado, miniatura de producto, nombre/precio, eliminar en la esquina derecha y controles de cantidad debajo, total, confirmar y seguir comprando. Tras la aclaracion del usuario, la cesta conserva el fondo oscuro verde azulado del catalogo, queda flotante a la derecha con texto alineado a la izquierda y permite seguir interactuando con el catalogo. Pulsar fuera, Escape o Seguir comprando la cierra. Los botones de cantidad usan turquesa claro y simbolos oscuros de mayor grosor; la cantidad se muestra sin partir la unidad entre los controles.

Las menciones historicas de publicacion pendiente describen el estado previo a esta autorizacion; no se consideran una prohibicion vigente del usuario. El cierre de permisos entre usuarios autenticados y los 20 avisos moderados de dependencias continuan pendientes.

La prueba de impresion de WebKit detecto cancelaciones de precargas RSC al reemplazar inmediatamente el documento; se sincronizo la navegacion de la prueba esperando networkidle sin filtrar errores. La repeticion aprobo 3/3 motores (browser-printing-publish.json).

Validacion final de la cesta oscura lateral: 6/6 escenarios aprobados, sin reintentos ni omisiones, en Chromium, WebKit y Firefox a 390 y 1440 px. Se comprobo fondo oscuro, miniatura, ausencia de desbordamiento, aumento/disminucion/eliminacion, cierre al pulsar fuera, Seguir comprando, persistencia y confirmacion sin sesion. Evidencia: guest-cart-publish.json y cart-layout-*.png. Build definitivo aprobado; 125/125 pruebas Node; ESLint general 0 errores y 84 advertencias, y comprobacion final dirigida 0 errores.

## Carga de imagenes: diagnostico y mitigacion posterior

En produccion se midieron tres miniaturas de 1226, 2102 y 1418 bytes: primeras respuestas MISS de 2647, 2663 y 4564 ms, frente a HIT de 212, 113 y 193 ms. No es una prueba controlada de red, pero la diferencia muestra una espera del camino sin cache. Un navegador movil inicio 26 imagenes antes de desplazarse, con cuatro fotos de producto visibles aun pendientes tras 20 segundos. Evidencia: image-latency-diagnosis.json.

Se priorizan las cuatro primeras fotos, se difieren las restantes hasta 200 px de la pantalla mediante IntersectionObserver y se habilita stale-while-revalidate en las miniaturas para atender desde cache mientras se actualizan. No cambia calidad, resolucion, originales ni datos de negocio. Esta mitigacion no elimina el coste de una miniatura nueva o expulsada de cache; para ello hace falta generar y guardar derivados persistentes antes de que el cliente los solicite.

Build y 125 pruebas unitarias aprobados. Los seis escenarios del carrito aprobaron en la ejecucion posterior al cambio. La nueva prueba de imagenes aprobo 3/3 motores tras corregir una imagen PNG de prueba que Chromium y WebKit no decodificaban; no se filtraron errores ni se cambio el comportamiento de produccion para satisfacer esa imagen invalida. Evidencias: browser-image-performance.json (incluye el fallo del fixture), image-scheduling-validated.json y build-image-performance.log. Los tiempos posteriores en produccion quedan pendientes de medir tras publicar.
