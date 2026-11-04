# Revisión previa al push — 3 de noviembre de 2026

La revisión y las validaciones se realizaron antes de crear el commit y publicar los cambios.

## Errores de imágenes de la captura

Se reprodujeron errores HTTP 500 en 4 de las 58 imágenes de las categorías. Los originales existían y respondían HTTP 200; el servidor de desarrollo registraba `TimeoutError` en el optimizador de Next.js. La descarga externa de ese optimizador tiene un límite fijo de siete segundos. Algunos originales rondan los 2 MB.

La corrección carga los archivos públicos propios mediante `/api/public/catalog-image`, con un plazo de 30 segundos, y permite que Next.js siga generando y almacenando las miniaturas. El origen está fijado por la configuración, no acepta URLs externas ni archivos privados y no sigue redirecciones. Se mantienen el respaldo al original y el visor de imágenes originales.

Las cuatro imágenes problemáticas respondieron HTTP 200 con miniaturas de 5–7 KB después de la corrección, incluidas descargas que tardaron más de siete segundos. La comprobación posterior del catálogo real no detectó errores de JavaScript, respuestas HTTP fallidas ni desbordamiento horizontal. Las imágenes fuera del área visible conservan su carga diferida.

## Otras correcciones de la revisión

- Se agregó la importación ausente de `Image` en `components/UserProfile.js`, que podía causar un error al mostrar fotos de perfil.
- ESLint excluye las carpetas locales de credenciales y copias de seguridad. Antes intentaba recorrer `.audit-access` y abortaba por falta de permisos.
- Los cambios de autenticación que ya estaban pendientes retiran dos endpoints antiguos de recuperación. El formulario actual usa el enlace de recuperación de Auth; el formulario de códigos antiguo no está importado por la interfaz actual. No se enviaron correos ni se modificaron contraseñas reales en estas pruebas.

## Validación

- Compilación de producción y comprobación TypeScript: correctas.
- Pruebas unitarias: 114 correctas, incluidas existencias, precios, promociones, pedidos, recuperación y validación del nuevo origen de imágenes.
- Carrito en producción local: 15 escenarios correctos con APIs simuladas, sin guardar pedidos ni abrir WhatsApp reales.
- Visor, búsqueda y rutas: pruebas de Chromium y WebKit correctas; cada motor recorrió 60 rutas, incluidas variantes por país. Se verificaron apertura y cierre del visor, cambio de imágenes, gestos táctiles, orientación, búsqueda y recuperación del foco. Las APIs de negocio estaban simuladas.
- Revisión específica de ESLint para la corrección de imágenes: sin errores ni advertencias.
- Comparación de ESLint con HEAD: los 97 errores de la primera revisión ya existían, sin errores nuevos por regla. La importación corregida del perfil elimina dos de ellos. La ejecución final tiene 95 errores y 82 advertencias, sin errores nuevos frente a la revisión inicial. ESLint global sigue teniendo problemas anteriores al rediseño y no se considera un control aprobado.

## Archivos nuevos que no deben faltar al publicar

Los archivos modificados importan recursos nuevos que todavía no estaban versionados. Publicar solamente los archivos que Git marca con `M` dejaría imports y recursos ausentes:

- `app/catalog-theme.css`
- `public/brand/catalog-teal-geometry.svg`
- `lib/storageImageUrl.mjs`
- `lib/catalogImageSource.mjs`
- `app/api/public/catalog-image/route.js`
- Las pruebas nuevas `tests/catalog-image-source.test.mjs`, `tests/storage-image-url.test.mjs` y `tests/password-recovery-security.test.mjs`.

El árbol de trabajo también contiene informes y scripts de migración anteriores a este rediseño. Su existencia no implica que todos deban incluirse en el mismo commit. Esta revisión no ejecutó scripts de migración, no modificó bases de datos, no desplegó servicios y no publicó el repositorio.

Las comprobaciones no garantizan ausencia absoluta de fallos. Los tiempos de red y la disponibilidad del almacenamiento siguen siendo dependencias externas; si una descarga falla incluso con el nuevo plazo, se conserva el respaldo al archivo original.
