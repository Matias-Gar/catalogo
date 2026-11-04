# Auditoría de estabilidad de Importaciones GARBLAC

Fecha: 4 de noviembre de 2026. Base revisada: `db6a6ad`, rama `main`.

## Alcance y evidencia

Se revisaron los clientes Supabase, sus consumidores públicos y privados, eventos de sesión, consultas de catálogo, promociones y packs, subida y entrega de imágenes, APIs y controles de acceso, carrito, precios, conversión a venta, inventario e impresión. Se ejecutaron las suites existentes y regresiones nuevas. Esta revisión no certifica cada posible ejecución de todo el repositorio.

No se modificaron tablas, políticas RLS, datos comerciales, contenedores ni configuración del Dell. Las escrituras de los escenarios automatizados utilizan servicios simulados. La verificación publicada es de lectura y no crea ventas ni pedidos reales.

## Fallos y causas demostradas

1. **Catálogo dependiente del bloqueo privado de Auth.** Las lecturas públicas compartían el cliente que recupera y renueva sesiones. Con otra pestaña manteniendo `lock:sb-…-auth-token`, el catálogo publicado no mostraba el producto de prueba dentro de siete segundos. No era necesario autenticarse para esas lecturas.
2. **Rechazos sin capturar en el SDK.** `@supabase/auth-js@2.103.0` inicia la tarea de suscripción inicial sin capturar su promesa y tampoco espera `_emitInitialSession`. La prueba prolongada encontró dos errores de página cuando vencía el bloqueo, incluso después de separar el catálogo. Se corrigió esa tarea y se repitió la prueba en cinco navegadores.
3. **Canales compartidos accidentalmente.** El SDK reutiliza canales con el mismo tópico. Consumidores distintos de packs/promociones podían compartir una suscripción y cancelar la de otro al desmontarse.
4. **Respuestas tardías del catálogo.** Una consulta anterior podía actualizar el estado después de cambiar sucursal/vista. Además, el fallo de carga no ofrecía una recuperación clara.
5. **Límite incompleto en entrega de imágenes.** La ruta sin redimensionado podía devolver un original sin verificar los bytes reales cuando Storage omitía `Content-Length`.
6. **Límite incompleto en subida.** Los fallos de decodificación, canvas o codificación podían devolver silenciosamente un original mayor que el máximo configurado. GIF/SVG también eludían ese control.

## Correcciones y archivos

| Archivos | Corrección |
| --- | --- |
| `lib/publicSupabaseClient.mjs`, `lib/supabasePublic.js` | Cliente público sin módulo Auth, almacenamiento de sesión ni renovación. Usa exclusivamente la clave anónima; conserva RLS y las respuestas 403. |
| `app/page.js`, `app/productos/page.js`, `lib/storeSettings.js` | Lecturas públicas independientes de la sesión. Las operaciones privadas siguen usando su cliente y sus permisos. |
| `app/productos/page.js` | Plazos de consultas, descarte de respuestas obsoletas, mensaje genérico y botón de reintento. Registro de ruta, operación, servicio y duración sin SQL ni credenciales. |
| `lib/packs.js`, `lib/usePromociones.js` | Tópicos únicos por consumidor/sucursal, limpieza del canal propio y protección contra actualizaciones posteriores al desmontaje. |
| `components/Header.js` | Captura de fallos privados y descarte de respuestas obsoletas. Consultas de perfil fuera de la ejecución del callback Auth. |
| `scripts/patch-auth-subscription.mjs`, `package.json`, `package-lock.json` | Corrección reproducible del SDK en `postinstall` y `prebuild`, para sus distribuciones CommonJS/ESM. Captura únicamente la tarea de suscripción de fondo; los errores de operaciones siguen llegando al llamador y se conserva el bloqueo exclusivo. |
| `app/api/public/catalog-image/route.js` | Límite real de 16 MiB también para transferencias sin longitud declarada, originales y versiones redimensionadas. Rechazo antes de emitir un 200 cacheable incompleto. |
| `lib/imageUploadOptimization.ts` | Respeto del máximo configurado ante fallos de optimización y formatos sin recompresión. Se conserva el original pequeño cuando falla la optimización. |
| `playwright.config.mjs` | Pruebas contra una URL publicada y proyectos opcionales para Chrome/Edge instalados. |
| Nuevos tests de cliente público, suscripciones, SDK y subida; ampliación de `tests/catalog-image-source.test.mjs`; `tests/browser/public-auth-isolation.spec.mjs` | Regresiones de las causas anteriores. |

La corrección del SDK está limitada deliberadamente a la versión y al fragmento auditados. Si cambia la dependencia, el build falla para exigir revisión en lugar de aplicar una sustitución incorrecta. No se modificó el SDK de forma manual no reproducible ni se eliminaron bloqueos.

## Imágenes y rendimiento

Se conservaron el redimensionado WebP existente, anchos/calidades permitidos, orientación, límite de píxeles, caché CDN, protección de rutas públicas, carga diferida y visor táctil. La suite comprueba URLs históricas de Storage, galerías, variantes, navegación por país/tipo y comportamiento ante fallo del optimizador de Next.

La prueba de carga progresiva crea 40 productos: carga las imágenes visibles, exige menos de 16 solicitudes iniciales y comprueba que la última imagen solo se solicita al desplazarse. La corrección evita descargas ilimitadas y subidas fuera del máximo; no se atribuye a estos cambios una mejora porcentual de velocidad que no se haya medido.

Medición reproducible del bloqueo: antes, el catálogo publicado incumplía el umbral de siete segundos con el bloqueo retenido; después, debe mostrar el producto y permitir usar la cesta dentro del mismo umbral y permanecer once segundos adicionales sin errores de página. Los datos comerciales de esta prueba están simulados; el JavaScript desplegado es real.

La captura inicial de producción visitó `/bo`, `/bo/productos` y `/login`: HTTP 200 en las tres, sin errores de página ni desbordamiento horizontal. Los tiempos totales de aproximadamente 12–17 segundos incluyen una espera deliberada de 12 segundos y **no representan LCP ni tiempo de carga**. Las imágenes fuera de pantalla permanecen diferidas y no se contabilizan como fallidas por no haberse descargado.

## Verificaciones

- 135 pruebas unitarias/de integración: aprobadas, sin omitidas. Incluyen precios/promociones, descuentos, pedidos, venta, inventario, permisos, recuperación, Storage y las regresiones nuevas.
- TypeScript: aprobado. Compilación de producción: aprobada.
- ESLint: cero errores; 84 advertencias existentes. No se aplicaron cambios generales de estilo ni supresiones.
- 30 regresiones de Auth, catálogo, cesta, reintento, diseño e impresión: aprobadas en Chromium, WebKit, Firefox y Chrome/Edge reales de Windows.
- 12 escenarios adicionales de galería, carga progresiva y checkout anónimo: aprobados en Chromium, WebKit y Firefox. Total final: 42 ejecuciones de navegador aprobadas.
- Relay Gmail: siete pruebas Python aprobadas con servidor SMTP local y remitente simulado; no acreditan entrega de correo real.
- Escenarios adicionales de pedidos: importes de pantalla/API/WhatsApp, promociones, centavos, recarga, conservación de cesta al fallar y revisión de cambios de precio: aprobados con backend simulado.
- Conversión del pedido 8: Bs 925 en UI y API, conserva cesta y clave de reintento al fallar, sin escritura directa de stock: aprobada con backend simulado.
- `npm audit --omit=dev`: cero vulnerabilidades. `npm audit` completo: seis alertas moderadas en la cadena de desarrollo de TypeScript ESLint/minimatch; cero altas y críticas. La actualización acotada sin forzar versiones no ofrece cambio compatible. Quedan pendientes de una actualización coordinada de esas herramientas; no afectan al árbol de producción según este audit.
- Revisión de secretos: los dos valores privados largos identificados en las variables locales no aparecen en `.next/static`. Esto no sustituye una auditoría de todos los secretos históricos.

Comandos principales:

```powershell
node --test --test-isolation=none tests/*.test.mjs
npm run typecheck
npm run lint
npm run build
$env:AUDIT_NATIVE_BROWSERS='1'
npx playwright test tests/browser/public-auth-isolation.spec.mjs tests/browser/auth-lock.spec.mjs tests/browser/responsive-catalog.spec.mjs tests/browser/printing-lifecycle.spec.mjs --workers=2
Remove-Item Env:AUDIT_NATIVE_BROWSERS
npx playwright test tests/browser/product-image-viewer.spec.mjs tests/browser/image-scheduling.spec.mjs tests/browser/guest-cart-permissions.spec.mjs --workers=2
npm audit --omit=dev
npm audit
```

## Límites y pendientes explícitos

- Chromium/WebKit con emulación táctil no equivalen a Android Chrome, iPhone Safari ni iPhone Chrome físicos. No hubo esos dispositivos conectados. Windows Chrome y Edge sí se ejecutaron realmente.
- Se probaron anchos de 320, 350, 375, 390, 414, 768, 1024, 1366 y 1920 píxeles; no se afirma cobertura de todas las combinaciones de orientación y dispositivo.
- La suite simula sesión expirada, Auth indisponible, bloqueo entre pestañas, rechazo de permisos y fallo/reintento de REST. No equivale a una prueba de carga del Dell ni a todas las condiciones de desconexión y redes móviles reales.
- No se realizó una venta, pedido, subida administrativa ni cambio de contraseña real con una cuenta del negocio. No se verificó entrega de correo real. Las pruebas no acreditan por sí solas esas integraciones publicadas.
- Las variables locales siguen apuntando al proyecto Cloud, mientras que la aplicación publicada usa el Dell; se distingue explícitamente entre tests locales con servicios simulados y lecturas publicadas.
- No se repararon ni se certificaron discos/RAID, respaldos físicos o recuperación ante pérdida del Dell en esta auditoría. El riesgo de almacenamiento aceptado previamente sigue fuera del alcance de estos cambios.
- La prueba Python de metadatos Docker utiliza sockets Unix; su ejecución en este Windows no pudo completarse. No se cambió ese componente Linux.
- Las 84 advertencias de ESLint y las seis alertas moderadas de desarrollo quedan visibles; no se declara que todo el repositorio esté libre de advertencias o de deuda técnica.

## Publicación y comprobación final

Pendiente de completar después del push y de la comprobación del despliegue automático. No se considera desplegado por el mero hecho de compilar localmente.
