# Publicación preparada: imágenes y recuperación

Estado: preparada localmente; sin push ni despliegue. Rama aislada `audit/migration-closeout-20261029`, basada en `origin/main` (`3c4b210`). Carpeta `.audit-access/migration-closeout`. Se copiaron 21 archivos seleccionados y se verificó igualdad SHA-256 con los originales de trabajo. Se preservó la carpeta principal con sus cambios.

## Comportamiento propuesto

- Resolver las imágenes públicas de este proyecto, incluidas las URLs antiguas de Cloud y rutas de buckets, contra `https://garblac.duckdns.org`. Aplicar la misma función a catálogo, galerías, miniaturas, logos y perfiles. Conservar URLs firmadas, recursos locales y URLs de otros proyectos.
- Responder HTTP 410 en las rutas antiguas `forgot-password` y `validate-reset-code`, que podían cambiar contraseñas sin verificar suficientemente la identidad. La recuperación mediante enlace de Auth sigue requiriendo configurar y probar el correo del Dell.
- Incluir las pruebas de resolución, rechazo de recuperación antigua y expectativas del visor.

No incluye cambios de datos, inventario, permisos de cesta, RLS, funciones SQL, SMTP, Auth del Dell ni RAID. Los scripts SQL y de instalación de correo no forman parte de esta publicación.

## Verificación local

- `npm run typecheck`: pasó.
- `npm run build`: pasó, incluidas generación de páginas y comprobación TypeScript.
- `node --test --test-isolation=none tests/*.test.mjs`: 110 pruebas, 110 pasaron.
- `npx playwright test tests/browser/product-image-viewer.spec.mjs --project=chromium`: pasó, con respuestas de datos e imágenes simuladas. No verifica la entrega real del Dell ni otros navegadores.
- ESLint sobre `app components lib tests`: **falló: 92 errores y 70 advertencias**. Incluye problemas de hooks, tipos, enlaces y componentes sin definir en código existente. No se declara lint aprobado. El informe anterior usaba un alcance más amplio y sus cifras no son directamente comparables. Resultado detallado local en `.audit-access/closeout-eslint.json`.

## Condiciones de cierre

Publicar este cambio requiere autorización del usuario, según su instrucción original de solicitarla antes de push o despliegue. Después corresponde volver a verificar las URLs publicadas y las imágenes con Cloud bloqueado.

Esta publicación no permite por sí sola recomendar cancelar Cloud: permanecen la incidencia de medio irrecuperable registrada por PERC, la entrega real del correo y la revisión de los permisos/funciones pendientes descritos en el informe principal. El ensayo aislado de recuperación SQL no fue una restauración completa de todos los servicios Supabase.
