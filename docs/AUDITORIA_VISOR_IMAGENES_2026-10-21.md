# Auditoría del visor público de imágenes

Fecha: 21 de octubre de 2026. Proyecto Next.js 16.2.3 / React 19.

## A. Diagnóstico reproducido

Se comparó el sitio publicado mediante Chromium con `hasTouch: true` y viewport 390 × 844. Se comprobó la apertura en `/bo/tipo/moldes`, `/bo/tipo/articulos` y `/bo/tipo/insumos`. En esas muestras no se reprodujo un fallo del evento de apertura.

En `/bo/productos`, la pulsación sí abrió el modal, pero su imagen terminó con `complete: true` y `naturalWidth: 0`. La solicitud a `/_next/image` respondió **HTTP 402**, con este mensaje:

```text
Payment required
OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED
```

La fotografía original correspondiente en Supabase respondió **HTTP 200**, `Content-Type: image/png`, 2.138.600 bytes. El fallo observado es la dependencia del visor de listados del servicio de optimización de Vercel que está rechazando solicitudes; no es evidencia de que iOS o Android omitan `click`.

Fotografía usada para el contraste: `https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/product_images/public/714f947e-8934-4f3e-957d-d07df73e6c3a.png`. La solicitud rechazada al optimizador envolvía esa URL con `?width=2200&quality=99&format=origin` y pedía `w=640&q=75` a `/_next/image`.

Además, la inspección identificó dos defectos independientes:

- El listado construía su galería únicamente desde `producto_imagenes`, omitiendo `imagen_base` cuando era la única foto disponible.
- Las miniaturas del visor de categorías ejecutaban `onPrev(...)`, cuya implementación ignoraba el argumento; no seleccionaban la miniatura pulsada.

## B. Diferencia con Moldes

`/[pais]/tipo/[vista]` y `/tipo/[vista]` reexportan `app/page.js`. Moldes, Artículos y los demás tipos usan exactamente ese componente, sin excepción específica para Moldes. Su visor anterior usaba un `img` con URL directa de Supabase.

Las variantes terminadas en `/productos`, incluidos `/productos` e `/insumos/productos`, reexportan `app/productos/page.js`. Su visor anterior usaba `next/image` con URLs adicionales de transformación y dependía de `/_next/image`, sin recuperación ante el HTTP 402. La diferencia es entre implementaciones compartidas de páginas, no una condición especial de la categoría Moldes.

## C. Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `components/ProductImageViewer.js` | Visor compartido, diálogo, navegación, gestos, foco y desplazamiento. |
| `components/CatalogImage.jsx` | Permite solicitar explícitamente el original conservando el fallback existente de las tarjetas. |
| `lib/productGallery.js` | Construcción común de galerías con foto principal, limpieza de entradas y deduplicación. |
| `app/page.js` | Sustituye visor local, corrige selección de miniaturas y añade botones semánticos de apertura. |
| `app/productos/page.js` | Sustituye visor duplicado, incorpora la foto principal y añade botones de apertura. |
| `app/globals.css` | Estilos del diálogo, imagen proporcional, controles táctiles y viewport dinámico. |
| `tests/catalog-loading.test.mjs` | Regresión de foto original y producto con foto principal única. |
| `tests/browser/product-image-viewer.spec.mjs` | Regresión funcional de rutas y del rechazo HTTP 402. |
| `playwright.config.mjs` | Proyectos Chromium, WebKit y Firefox. |
| `package.json`, `package-lock.json` | Dependencia de desarrollo Playwright y comando `test:viewer`. |
| `.gitignore` | Excluye informes y resultados temporales de Playwright. |

El cambio de `app/admin/ventas/nueva/NuevaVenta.tsx` ya existía al comenzar y no pertenece a esta tarea. No se modificaron precios, descripciones, archivos de fotografías ni registros de productos.

## D. Solución

Los dos catálogos públicos utilizan `ProductImageViewer`. La foto ampliada y sus miniaturas cargan directamente desde el almacenamiento original, sin solicitar el optimizador de Vercel. Las tarjetas conservan su optimización y recuperación existentes.

El visor se monta mediante portal en `document.body` y usa un diálogo modal nativo para estar en la capa superior del navegador. Incluye un respaldo visual para navegadores sin `showModal`. Usa `object-contain`, límites con `vh`/`dvh`, áreas seguras y miniaturas con desplazamiento horizontal. Los controles principales miden al menos 44 × 44 píxeles.

La apertura utiliza un solo `click` sobre un botón, válido para mouse, teclado y activación táctil. Los gestos de desplazamiento entre fotos se procesan por separado; se ignoran movimientos verticales, gestos cortos, cancelaciones y multitáctiles. Se conserva `pinch-zoom` nativo; no se implementa un zoom personalizado.

Hay cierre mediante botón, fondo y Escape, navegación circular, selección directa de miniaturas, flechas de teclado, control de foco y restauración del estilo del cuerpo y la posición de desplazamiento al desmontar. Se establece explícitamente el foco del botón que abre el visor para cubrir el comportamiento de Safari, donde pulsar un botón con mouse no siempre lo enfoca.

Las fotografías de productos dentro de packs abren el mismo visor e incorporan también las otras fotografías disponibles del producto.

No se añadieron condiciones por categoría ni país. Las rutas dinámicas y los filtros usan los componentes compartidos. No se encontraron páginas públicas individuales de producto en el árbol de rutas; los productos se muestran en tarjetas y modales de pedido. Las imágenes de categorías de la portada son enlaces de navegación, no fotografías ampliables de productos. Se inspeccionaron también los editores administrativos y sus previsualizaciones; no forman parte del catálogo público ni se alteraron sus flujos de edición.

## E. Compatibilidad y límites

Las pruebas de navegador utilizan motores instalados en Windows y emulación de entrada táctil. **No equivalen a Safari/Chrome ejecutados en iPhone, ni a Chrome/Samsung Internet/Firefox ejecutados en Android.** La rotación se comprueba cambiando el viewport, no mediante un sensor físico.

Quedan pendientes dispositivos físicos, distintas versiones de iOS/Android, Samsung Internet, teléfonos de distintas prestaciones y el gesto de pellizco real. El respaldo para navegadores sin diálogo modal nativo requiere comprobación específica en versiones antiguas.

Las imágenes originales pueden pesar más que una miniatura optimizada; se cargan ampliadas cuando se abre el visor. La muestra real usada para confirmar el fallo pesa aproximadamente 2,14 MB. No se cambiaron los archivos almacenados.

## F. Rutas y pruebas

Se detectaron los tipos publicados consultando `/api/public/tipos-producto`: `articulos`, `insumos`, `productos`, `moldes`, `equipos-de-produccion`, `papeleria`, `insumos-para-velas`. La regresión incorpora esos siete tipos y `categoria-futura` para comprobar el comportamiento dinámico sin excepciones.

Por cada prefijo vacío, `/bo` y `/cl`, la suite recorre `/productos`, `/productos?categoria=1`, `/insumos`, `/insumos/productos` y `/tipo/{tipo}` con y sin `/productos`: **60 variantes por motor**. Los datos de estas pruebas son controlados mediante interceptación de API; no son un inventario exhaustivo de todos los productos reales. El optimizador se fuerza a responder HTTP 402 y el almacenamiento entrega fotografías de prueba.

Se comprueban apertura táctil, carga efectiva (`naturalWidth > 0`), URL original, cierre, navegación circular, miniaturas, producto con foto única, liberación del bloqueo de desplazamiento y ausencia de excepciones de página. También se comprueban búsqueda, gesto horizontal sintético, viewport horizontal 844 × 390, interacción con mouse a 1440 × 900, teclado y restauración de foco y desplazamiento.

**Incidencia de consola detectada:** Firefox emite `Acquiring an exclusive Navigator LockManager lock "lock:sb-gzvtuenpwndodnetnmzi-auth-token" immediately failed`. Se reprodujo también en `/bo/tipo/moldes` del sitio publicado antes del despliegue de estos cambios; es una incidencia previa de la sesión de Supabase. Las comprobaciones del visor se completaron pese a ella. La suite registra las coincidencias exactas como anotaciones `known-auth-issue` y sigue fallando ante cualquier otra excepción. No se cambiaron el cliente de autenticación ni los bloqueos de sesión para ocultar el problema.

Comandos:

```sh
npm run typecheck
npm run build
node --test --test-isolation=none tests/catalog-loading.test.mjs
npx playwright install chromium firefox webkit
npm run test:viewer
npm run lint
```

La compilación requiere acceso a Google Fonts por la configuración existente. El primer intento de Node con aislamiento de procesos fue rechazado por el sandbox (`spawn EPERM`); ejecutar con `--test-isolation=none` permitió completar las pruebas. Las pruebas de navegador requieren autorización para crear procesos del servidor y los navegadores en este entorno.

El lint global reportó 100 errores y 88 advertencias antes de limpiar dos imports que quedaron sin uso al eliminar el visor antiguo. La comparación con `HEAD` confirmó errores previos en las dos páginas modificadas. Los archivos nuevos de visor, galería y Playwright pasan su lint específico. No se amplió esta tarea para corregir errores ajenos del repositorio.

## G. Estado

La corrección está implementada localmente. No se ha desplegado a Vercel; el sitio publicado conserva el problema hasta publicar esta versión. El servicio de optimización publicado sigue respondiendo HTTP 402 para la solicitud observada. El visor nuevo evita esa dependencia; no modifica la facturación o la configuración de la cuenta de Vercel.

Resultados finales:

| Comprobación | Resultado |
| --- | --- |
| TypeScript | Correcto; comprobación independiente y durante la compilación. |
| Compilación de producción final | Correcta; 78 páginas generadas. |
| Pruebas Node de carga y galería | 7 aprobadas. |
| Chromium con entrada táctil emulada | Aprobado: 60 variantes, incluidos búsqueda, orientación y packs. |
| Firefox con entrada táctil emulada | Aprobado: 60 variantes; se registra la incidencia previa de autenticación descrita arriba. |
| WebKit con entrada táctil emulada | Aprobado: 60 variantes en ejecución aislada. |
| Lint de visor, galería y archivos Playwright | Correcto. |
| Lint de `CatalogImage.jsx` aplicando la configuración JS mediante `lintText` | Correcto, sin errores ni advertencias. |
| Lint global | No pasa por los errores previos descritos. |
| Dispositivos físicos iOS/Android | Pendiente. |
| Despliegue a Vercel | Pendiente; los cambios quedan en el proyecto local. |

En total se completaron **180 verificaciones de variantes de ruta** entre los tres motores. En la ejecución simultánea, Chromium y Firefox aprobaron y WebKit agotó una espera de cinco segundos durante la carga de productos. La repetición aislada de WebKit aprobó las 60 variantes completas. La configuración final usa un trabajador y esperas de aserción de 15 segundos para reducir la sensibilidad a la carga del entorno.
