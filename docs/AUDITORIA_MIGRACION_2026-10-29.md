# Auditoría de migración de catálogo — 29 de octubre de 2026

Estado: **parcial, migración no aprobada**. No cancelar Cloud con esta evidencia.

## iDRAC localizado por consulta de solo lectura

El usuario ejecutó el lector IPMI mediante `/dev/ipmi0`, y el BMC devolvió **`192.168.0.120`** como dirección IPv4 configurada del canal LAN 1. La respuesta indica `production_changed: false` y `configuration_changed: false`. No se cambiaron red ni credenciales. Una prueba HTTP/HTTPS previa desde el PC agotó cuatro segundos; todavía no hay acceso web de gestión confirmado. Queda por comprobar conectividad/cableado antes de consultar el estado completo de almacenamiento.

## Incidencia confirmada de medio irrecuperable y respaldo de emergencia

**La controladora PERC informó repetidamente errores de medio irrecuperables en `PD 01(e0x20/s1)`, sector `110cf3a`.** El informe root del 29 de octubre a las 23:25 UTC contiene 50 avisos del kernel de esa clase. Evidencia: `migration-dell-storage-health-confirmed-2026-10-29.json`. La causa ya no se limita a una sospecha basada en PSI o timeouts: existe un error de almacenamiento registrado. No se ha determinado todavía el estado completo del RAID ni se da por demostrada una avería exclusiva de un único disco.

Se volvieron a verificar los cinco SQL independientes guardados en Windows; tamaño y SHA-256 coinciden. Además se evacuaron mediante GET de solo lectura los registros actuales de las 40 tablas/vistas expuestas y metadatos de seis usuarios de Auth, con paginación hasta una página vacía. El respaldo adicional terminó sin errores, con todos sus archivos releídos y cotejados con el manifiesto, en `backups/emergency-api-2026-10-29T23-31-52Z`. Incluye 363 productos y 54 ventas. No es un snapshot transaccional ni un respaldo SQL completo. No incorpora hashes de contraseñas ni sustituye el dump ya restaurado. El usuario confirmó que no hubo nuevas operaciones de negocio desde el SQL de las 17:26 de Bolivia.

El equipo es un **Dell Storage NX430**. No se encontraron herramientas iDRAC/IPMI instaladas; `/dev/ipmi0` existe. La dirección de fábrica documentada de iDRAC no respondió a HTTP/HTTPS en una comprobación acotada sin login. Se preparó una consulta IPMI de solo lectura de la IP para que el usuario la ejecute con sudo, sin instalar software ni reiniciar el servidor. El lanzador de activación en RAM quedó suspendido mediante marcador para evitar una recreación accidental de Auth mientras se revisa el almacenamiento. No se modificaron servicios ni parámetros de discos.

El resumen operativo y las ubicaciones de las copias figuran en [ESTADO_CRITICO_DELL_2026-10-29.md](ESTADO_CRITICO_DELL_2026-10-29.md). Es necesario comprobar RAID/discos antes de decidir una intervención; no se indicaron extracción, reconstrucción ni inicialización a partir solamente del identificador del log. Se mantiene la recomendación de **no cancelar Cloud** y de no activar correo hasta aclarar esta incidencia. Las páginas informativas autorizadas siguen publicadas; el adaptador Gmail, los logos y los demás cambios de producción siguen pendientes.

## Bloqueo actual: E/S del sistema operativo, sin activación de correo

El segundo intento root confirmó `docker_api_version: 1.52` y `docker_cli_read_verified: true`, por lo que el ajuste de negociación pasó la comprobación real. Después agotó 12 segundos en `docker compose version`, manteniendo `production_changed`, `smtp_applied`, `logos_applied` y `mail_sent` en falso. Evidencia: `migration-gmail-activation-attempt-2-2026-10-29.json`.

La ejecución directa de `/usr/libexec/docker/cli-plugins/docker-compose version --short` también agotó ocho segundos. En una inspección de procesos de prueba propios, tanto ese ejecutable como `/bin/true` estaban en estado **D (disk sleep)**, esperando en **`folio_wait_bit_common`**. No se detuvieron procesos de aplicaciones: solo se finalizaron los grupos de procesos de las pruebas creadas para ese diagnóstico.

La memoria disponible era aproximadamente 5 GB de 8 GB y la presión de memoria en el intervalo era próxima a cero. En una muestra de dos segundos del almacenamiento raíz `dm-0 → sda3 → sda`, se completó una lectura con duración contabilizada de unos 2006–2007 ms y el dispositivo virtual `sda`, modelo **DELL PERC H730 Adp**, estuvo ocupado aproximadamente el 99 % del intervalo. Se observaron tres E/S pendientes. No son tres discos: son las capas del mismo almacenamiento raíz. Evidencia: `migration-dell-storage-health-2026-10-29.json`.

Estos datos prueban esperas de lectura del sistema, pero no identifican todavía si hay un problema físico, de controladora, del sistema de archivos o de otra capa de E/S. No se atribuye el problema a falta de RAM ni se declara un disco averiado. No se ha corregido el bloqueo aumentando indefinidamente los límites o evitando comprobaciones previas a cambios de producción.

Se preparó `scripts/audit-dell-storage-health.py`, copiado como `/dev/shm/catalogo-diagnostico-disco.py`. Lee presión, estadísticas del dispositivo raíz y mensajes del kernel; con root intenta además una consulta SMART de salud, atributos e identidad al ID físico 0 de la controladora PERC del volumen raíz, con límite de diez segundos. No inicia auto-tests, no cambia parámetros de discos, no repara, no reinicia y no altera contenedores. Esa consulta aislada no equivale a revisar todo el RAID. Se solicitó al usuario la ejecución con sudo porque el acceso de auditoría no puede leer el kernel ni abrir el controlador.

Se mantiene detenida la activación de Gmail hasta aclarar el bloqueo de E/S. La autorización OAuth y las pruebas del adaptador ya pasaron; el correo todavía no se ha entregado realmente ni se ha configurado SMTP en producción. La disponibilidad del Dell constituye un pendiente adicional antes de recomendar cancelar Cloud, aunque el contenido migrado y sus respaldos hayan pasado las comparaciones descritas.

## Diagnóstico Docker y revisión ajustada

El diagnóstico root confirmó que `GET /version` agota seis segundos, mientras `GET /containers/supabase-auth/json` responde HTTP 200 inmediatamente. Auth está en ejecución y pertenece a Compose `supabase`, servicio `auth`, carpeta `/srv/garblac/backend`, red `supabase_default`, gateway `172.18.0.1`. Evidencia: `migration-docker-diagnosis-2026-10-29.json`. Esto no demuestra que todas las operaciones de Docker estén sanas ni que la espera elevada de disco haya desaparecido.

Se ajustó la revisión del instalador: consulta metadatos de solo lectura directamente por el socket local con límite de seis segundos, obtiene la versión API del encabezado anunciado por el daemon y configura `DOCKER_API_VERSION` únicamente para sus propios comandos Docker. No adivina una versión, no cambia variables del sistema y fija explícitamente el socket local. Antes de mostrar el plan, prueba una lectura de estado con el cliente Docker y la disponibilidad de Compose; si fallan, sale sin activar el servicio. Los errores de comandos ahora identifican el paso y su límite de tiempo. La opción de negociación está documentada por Docker: https://docs.docker.com/reference/cli/docker/

Seis pruebas adicionales pasaron contra un socket Unix simulado en RAM: consulta Auth sin `/version`, rechazo de encabezado API ausente o versión inválida, timeout acotado, rechazo de rutas ajenas y entorno de cliente limitado al socket local sin alterar el entorno original. Se comprobó también la sintaxis de los tres módulos. El nuevo manifiesto revisado es `5bed5a9ffd2b734ed1d981671b3cd5749c332113e26474002f0589c81de2d046`; reemplaza al anterior. No se reinició Docker ni ningún servicio, y el siguiente intento sigue requiriendo la confirmación interactiva de producción.

## Activación detenida sin cambios por timeout en la revisión previa

El usuario ejecutó el lanzador root. El intento comenzó a las 23:06:23 UTC y terminó aproximadamente 30 segundos después con `TimeoutExpired`, antes de mostrar el plan de autorización. El resultado confirma `production_changed: false`, `smtp_applied: false`, `logos_applied: false` y `mail_sent: false`. Evidencia: `migration-gmail-activation-attempt-2026-10-29.json`. No hubo instalación del servicio, cambio de SMTP, recreación de Auth ni actualización de logos en este intento.

La primera llamada externa de la revisión es `docker inspect supabase-auth`, con límite de 30 segundos; el tiempo observado coincide con ese límite. El informe inicial no identifica la llamada que agotó el tiempo, por lo que se preparó `/dev/shm/catalogo-diagnostico-docker.py`: consultas GET al socket Docker de seis segundos, únicamente versión del daemon y metadatos seleccionados del contenedor Auth de Catálogo. No imprime variables de entorno ni secretos y no modifica Docker. El acceso de matias al socket está restringido; se solicitó al usuario ejecutarlo con sudo.

La lectura no privilegiada de `/proc/pressure/io` mostró `some avg10=70.02` y `full avg10=58.07`, compatibles con una espera elevada de E/S. Este dato no identifica la causa ni prueba una avería física. No se reinició Docker, el Dell ni ningún servicio compartido, y no se repararon discos. La autorización OAuth renovada sí había pasado la comprobación real desde el Dell antes de este intento.

## OAuth en producción y autorización renovada

El usuario mostró en Google Auth Platform el estado **En producción** y volvió a autorizar su cuenta mediante `-Renew`. La autorización nueva se obtuvo el 29 de octubre de 2026 a las 23:02:50 UTC. Su alcance es exclusivamente `gmail.send`. Se verificó realmente su renovación en Windows y, tras copiarla a la carpeta privada en RAM, también desde el Dell. Google no informó un campo `refresh_token_expires_in` en la respuesta guardada; esto no garantiza que el permiso sea irrevocable o eterno. Se conservaron las autorizaciones anteriores con acceso restringido y no se mostraron sus valores.

El instalador revisado y su manifiesto SHA-256 `41e58b53fcfa2db4c0f4905877342bd7376e9409073b133691144dae35eaf180` quedaron en la carpeta de preparación de RAM. `scripts/activate-catalogo-gmail.py`, copiado como `/dev/shm/catalogo-activar-gmail.py`, comprueba el manifiesto y el instalador antes de ejecutarlo. El comando propuesto al usuario es `sudo python3 /dev/shm/catalogo-activar-gmail.py`. Su revisión root es de solo lectura hasta la confirmación interactiva exacta `APLICAR CATALOGO GMAIL`, que autoriza el servicio Gmail, la configuración SMTP de Auth y las tres URLs de logos descritas en el plan. **Todavía no se ejecutó ni autorizó esa activación.** No se envió ningún correo en estas pruebas. La autorización previa para publicar las dos páginas estáticas no se extendió a este cambio.

## Publicación autorizada de las páginas OAuth

El usuario autorizó expresamente hacer push y desplegar las dos páginas con «hazlo». Se actualizó la referencia de GitHub y se confirmó que `main` seguía en `58c6a1f`. En el worktree aislado se creó el commit **`3c4b21030cacecf96ac2c9709fc86d7d752e8a62`**, que añade únicamente `public/correo-catalogo.html` y `public/privacidad-correo.html` (84 líneas). Se hizo push normal, sin force, a `origin/main`. No se incluyeron las demás modificaciones locales, respaldos, credenciales ni tokens. La copia de trabajo principal y sus cambios se conservaron.

Vercel desplegó las páginas mediante la integración de GitHub. Se verificaron ambas URLs de producción con HTTP 200 y SHA-256 del contenido normalizado por saltos de línea igual a los archivos autorizados. También se comprobaron en Chromium las URLs canónicas sin parámetros, el enlace funcional de privacidad, la declaración `gmail.send` y la disponibilidad del formulario de `/login` con HTTP 200. No se inició sesión ni se solicitó ningún correo. Evidencias: `migration-gmail-pages-published-2026-10-29.json` y `migration-gmail-pages-browser-2026-10-29.json`.

URLs para la ficha de marca de Google:

- Página principal: https://catalogo-sigma-one.vercel.app/correo-catalogo.html
- Política de privacidad: https://catalogo-sigma-one.vercel.app/privacidad-correo.html
- Nombre: Catálogo Dell; asistencia y contacto: garblac01@gmail.com.

Sigue pendiente guardar esos datos en Google, confirmar el cambio de OAuth a En producción, renovar la autorización y activar el adaptador con aprobación explícita. La autorización para publicar estas dos páginas no se interpretó como aprobación para cambiar SMTP, recrear Auth ni aplicar el SQL de logos.

## Bloqueo de publicación OAuth: ficha de marca y páginas públicas

El usuario mostró el aviso de Google que exige nombre de aplicación, correo de asistencia, página principal y política de privacidad válidos para pasar a producción externa. La búsqueda del repositorio no encontró una política de privacidad existente. Se prepararon `public/correo-catalogo.html` y `public/privacidad-correo.html`, específicas para el adaptador Gmail: finalidad, permiso de solo envío, tratamiento de mensajes y credenciales, proveedores, revocación y contacto.

Ambas páginas se comprobaron localmente en Chromium a 375 y 1280 píxeles: HTTP 200, enlace de privacidad funcional y sin desbordamiento horizontal. Evidencia: `migration-gmail-public-pages-2026-10-29.json`. No están publicadas ni se afirma que Google ya acepte las URLs. Se creó el worktree aislado `.audit-access/oauth-public-pages` en la rama `audit/oauth-public-pages-20261029`, basado en `origin/main` conocido (`58c6a1f`), con únicamente esas dos páginas nuevas. No se hizo commit, push ni despliegue. La publicación requiere autorización del usuario, tal como pidió en sus restricciones iniciales; las demás correcciones locales de la auditoría no forman parte de esa propuesta.

## Cierre de Storage y adaptador Gmail preparado

- Se reintentaron correctamente las 22 lecturas pendientes a través del túnel SSH de solo lectura. El resultado final inventaría 1261 rutas: **1260 archivos compartidos Cloud/Dell, todos iguales por SHA-256 y MIME, cero errores** y un archivo nuevo exclusivo de Dell. Evidencia actualizada: `migration-storage-final-2026-10-29.json`. Las menciones de descargas pendientes más abajo describen estados anteriores.
- Los tres buckets tienen respectivamente Cloud/Dell: `imagenes` 10/10, `perfiles` 3/3 y `product_images` 1247/1248. Las copias binarias independientes están bajo `backups/verification-2026-10-29T21-17-14-362Z`, excluidas de Git y fuera del Dell.
- La relectura final del respaldo local verificó **2521 archivos y 2474017590 bytes**, sin diferencias de tamaño ni SHA-256 contra el manifiesto. Son dos copias de cada objeto compartido más el objeto nuevo de Dell. Se cerró el túnel de lectura al terminar. Evidencia: `migration-storage-backup-verification-2026-10-29.json`.
- SSH volvió a responder. Se confirmó Python 3.12.3 y el Compose de Catálogo en `/srv/garblac/backend/docker-compose.yml`, que obtiene las seis variables SMTP desde su entorno.
- `scripts/gmail_oauth_relay.py` conserva el MIME generado por Supabase Auth y lo envía con Gmail API usando solo el permiso `gmail.send`. Escucha únicamente en el gateway de la red Docker de este proyecto, con contraseña SMTP aleatoria propia y restricción de origen. SMTP interno no lleva TLS; se limita a esa red privada y requiere autenticación. Las llamadas a Google siempre usan HTTPS. No se abrió ningún puerto en el router ni se cambió DuckDNS.
- Siete pruebas SMTP reales contra un proveedor simulado pasaron en RAM del Dell: rechazo sin autenticación, contraseña incorrecta, origen fuera de la red, remitente distinto, destinatario inconsistente y Cc adicional; conservación del enlace de recuperación en una entrega autorizada. Ninguna prueba envió correos reales. Se verificó además la renovación OAuth real desde el Dell, también sin enviar mensajes.
- Las tres dependencias Python se descargaron de PyPI con versiones fijas y se comprobaron sus SHA-256 antes de extraerlas en RAM. No se instalaron paquetes globales ni se modificó el entorno Python existente.
- `scripts/install-catalogo-gmail.py` y su manifiesto están preparados en `/dev/shm/catalogo-gmail-prep-20261029-2227`. Requiere root para inspeccionar exclusivamente el Compose de Catálogo. Rechaza instalaciones existentes y cambios inesperados de configuración. Antes de escribir producción muestra su plan y exige la frase exacta `APLICAR CATALOGO GMAIL`. Solo entonces crea el servicio específico del adaptador, cambia seis campos SMTP, recrea únicamente `supabase-auth` y aplica el SQL de los tres logos. Conserva el entorno anterior en RAM y contempla rollback. Este instalador todavía no se ejecutó ni autorizó sobre producción.
- **Pendiente:** cambiar OAuth de Pruebas a En producción, volver a autorizar para evitar el vencimiento de siete días del token de prueba, terminar las comprobaciones root y obtener autorización para la activación; después verificar recepción real del correo y ausencia de dependencias Cloud en la aplicación publicada. No se ha dado por completada la entrega del correo ni por permanente el permiso OAuth actual. Ver `migration-gmail-relay-preflight-2026-10-29.json`.

## Actualización de correo: autorización OAuth concedida

- El usuario creó un cliente OAuth de escritorio para Gmail y autorizó únicamente `https://www.googleapis.com/auth/gmail.send`. Se guardaron cliente y tokens bajo `.audit-access/gmail-oauth/`, con permisos de Windows restringidos al usuario y exclusión de Git. No se imprimieron secretos.
- Se verificó realmente la renovación del token con Google: `docs/migration-gmail-oauth-verification-2026-10-29.json` informa `refresh_verified: true`. Esta comprobación no envió mensajes. No demuestra todavía entrega ni integración con Supabase Auth.
- Gmail SMTP mediante contraseña de aplicación quedó descartado por la restricción de la cuenta. El antiguo script `finalize-dell-mail-and-logos.py` exige ese método y **no es el instalador para OAuth**; no debe ejecutarse para este nuevo plan. El adaptador Gmail API → envío de Auth todavía no se ha instalado ni activado.
- La autorización se obtuvo con OAuth en modo Pruebas: Google limita a siete días estos refresh tokens. Para un envío permanente queda pendiente ajustar el estado de publicación de OAuth, volver a autorizar la cuenta y verificar renovación y entrega. No se ha afirmado que el token actual sea permanente. Fuente: https://developers.google.com/identity/protocols/oauth2#expiration
- El Dell responde al puerto TCP 22, pero dos conexiones OpenSSH con límites de espera terminaron sin una sesión remota operativa. Se solicitó comprobar la terminal local antes de continuar con lecturas de arquitectura y preparar la instalación. No se reinició ni modificó ningún servicio.
- La copia binaria de Storage terminó con 1261 objetos inventariados: 1238 pares descargados con SHA-256 y MIME coincidentes y 22 objetos con errores de lectura pendientes. Un objeto adicional existe únicamente en Dell. No confundir los errores de descarga con archivos perdidos: aún deben reintentarse y verificarse. El manifiesto está en `docs/migration-storage-final-2026-10-29.json`; esta evidencia no permite aprobar todavía Storage completo.
- Se volvieron a leer del disco Windows los 2499 archivos binarios efectivamente guardados (2363016255 bytes): todos coinciden con el tamaño y SHA-256 de su manifiesto. `migration-storage-backup-verification-2026-10-29.json` confirma la integridad de esas copias, no la finalización de las 22 descargas pendientes.

## Cierre solicitado posteriormente: avances y cambios concretos preparados

El usuario pidió terminar los pendientes necesarios para cancelar Cloud. No se aplicaron cambios de producción en esta fase; se preparan únicamente SMTP de Auth y tres URLs de logos, sujetos a autorización explícita.

- **Restauración original aprobada:** se restauraron realmente los SQL originales de Cloud, con el esquema completo Auth/Storage exportado de Dell, en PostgreSQL embebido PGlite aislado en el equipo Windows. 68 tablas legibles; 362 productos, 53 ventas, seis usuarios, tres buckets y 1260 objetos registrados.
- **Restauración actual de Dell aprobada:** un nuevo `pg_dump` consistente de `public/auth/storage`, generado en RAM sin escribir en la base de producción, también se restauró en una instancia local aislada. Incluye 363 productos, 54 ventas, seis usuarios y 1261 objetos registrados. Las 119 restricciones de negocio informadas en Dell coinciden con las restauradas tras normalizar la presentación del esquema. Se comprobaron rechazos reales de clave duplicada, PK nula y FK a producto inexistente.
- La prueba utiliza PostgreSQL WASM mediante PGlite, no contenedores ni servicios Auth/Storage. No equivale a ensayar la recuperación completa del sistema operativo, propietarios y ACL, ni los servicios GoTrue/Storage. Sí comprueba datos de la aplicación, SQL y restricciones en una base PostgreSQL aislada. Evidencias: `migration-local-restore-2026-10-29.json`, `migration-dell-local-restore-2026-10-29.json`, `migration-restoration-verdict-2026-10-29.json`.
- **Respaldo independiente de base:** cinco archivos SQL y manifiesto SHA-256 quedaron en `C:\Users\saita\catalogo\backups\database-verification-2026-10-29T21-26-12-273Z`, fuera del Dell y excluidos de Git. Incluyen el estado actual del Dell y el snapshot original. No se imprimieron contraseñas ni hashes de contraseña.
- **Auth:** el usuario confirmó inicio de sesión desde ventana privada. Se compararon los valores de hash almacenados en ambos respaldos: seis coincidentes, ninguno diferente. No se compararon contraseñas en texto claro. El usuario confirmó que el correo de recuperación no llega; sigue pendiente configurar SMTP y repetir esa prueba.
- **Storage:** se guardan copias binarias independientes Cloud/Dell en el equipo Windows, con SHA-256 y MIME por objeto y progreso persistido. Cinco objetos que daban HTTP 504 por la ruta pública se descargaron por la API interna y coincidieron con Cloud. Se usa un túnel SSH restringido a localhost para completar las lecturas sin el proxy público. La verificación total aún está en curso; no se afirma aprobación final de todos los archivos hasta revisar su manifiesto y volver a leer la copia guardada.
- **Logos:** se localizaron tres dependencias Cloud en `app_settings.settings.store_logo_url` y dos filas de `pais_settings`. Sus tres archivos ya coinciden por SHA-256 y MIME en Dell. `scripts/finalize-dell-logo-settings.sql` cambia solo esos campos, preserva los demás ajustes y revierte toda la transacción si un valor cambió desde la auditoría. Se ejecutó con éxito en la base aislada: tres logos y únicamente sus timestamps automáticos de actualización. No se necesita push ni despliegue para este cambio de configuración.
- **Correo:** el usuario eligió `garblac01@gmail.com`. DuckDNS proporciona la dirección del servidor; no se ha dado por existente ningún buzón SMTP de ese servicio. La cuenta Resend configurada no tiene dominios verificados. Se preparó `configure-audit-smtp.ps1` para guardar localmente una contraseña de aplicación de Google en un archivo restringido al usuario y excluido de Git. No se ha recibido ni mostrado esa contraseña. Su prueba SMTP autentica sin enviar mensajes.
- `finalize-dell-mail-and-logos.py` presenta un plan e impone confirmación interactiva `APLICAR CATALOGO` antes de modificar producción. Solo configura los seis campos SMTP del proyecto, recrea `supabase-auth` sin dependencias ni descarga de imágenes, comprueba salud y aplica el SQL de logos. Conserva la configuración anterior en RAM y contempla rollback. Identifica el proyecto por etiquetas de Compose y rechaza rutas de otros proyectos. Avisa del antecedente real de timeouts de Docker; no se ha ejecutado sobre producción.

Pendientes actuales para recomendar cancelar: cerrar la copia/verificación completa de Storage; obtener y validar privadamente SMTP; autorización y aplicación de los cambios mínimos revisados; comprobar el sitio publicado sin solicitudes a Cloud y que llegue el correo real de recuperación. Las mejoras de seguridad y lint preexistentes siguen documentadas por separado.

## Verificación final enfocada en cancelar Cloud

En esa fase previa el usuario pidió exclusivamente verificar la migración. Posteriormente solicitó cerrar los pendientes para cancelar Cloud; ver el avance actualizado al inicio de este informe.

El 29/10/2026 a las 21:13 UTC (17:13 Bolivia), se abrió el frontend publicado en Chromium limpio, bloqueando las solicitudes directas al proyecto Cloud antiguo. `/bo/productos` mostró 62 controles de producto y respondió 200; se observaron consultas de categorías, productos, variantes, imágenes, promociones y configuración al Dell, todas con HTTP 200. Login y recuperación también respondieron 200; no se inició sesión ni se cambió ninguna contraseña.

**Dependencia Cloud confirmada en producción:** el navegador intentó cargar el logo desde `gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/product_images/store/…jpeg` en catálogo, login y recuperación. Esas solicitudes fueron bloqueadas solo en el navegador de prueba. La publicación todavía no es completamente independiente de Cloud. Las correcciones locales preparadas previamente no están desplegadas.

Evidencia: `migration-live-cloud-blocked-2026-10-29.json`. La prueba no demuestra independencia de solicitudes que un servidor/optimizador pueda realizar por su cuenta ni valida todas las imágenes: no se presenta como verificación completa de Storage.

La salida de `dmesg` aportada por el usuario no muestra errores explícitos de lectura/escritura. La lectura del respaldo permanece en la misma posición tras más de 34 minutos, en estado `D`. El archivo está en el volumen raíz `dm-0` sobre `sda3/sda`, controladora Dell PERC H730; no en `sdb`. El volumen no está suspendido. Una muestra de iostat registró lecturas con espera media de 1,55–1,99 s y escaso caudal; el disco todavía completa operaciones. Esto demuestra espera/latencia, no una avería física confirmada. No se iniciaron reparaciones ni se reiniciaron servicios.

Conclusión para cancelar: **todavía no aprobado**. Los datos principales coinciden, pero existe la dependencia publicada del logo y siguen sin certificarse contenido completo de Storage, acceso/recuperación con una cuenta real y restaurabilidad de respaldos. Los problemas de permisos preexistentes se reportan por separado y no se confunden con pérdida de datos de migración.

## Avance verificado mediante SSH y comparación directa

- Acceso por clave exclusiva de catálogo confirmado. Producción no modificada.
- Proyecto Dell: `/srv/garblac/app`, backend `/srv/garblac/backend`, respaldos `/srv/garblac/backups`. PostgreSQL identificado: `supabase-db`, imagen `supabase/postgres:17.6.1.136`. No se intervienen contenedores de Mil Moldes ni Nextcloud.
- Frontend observado: `https://catalogo-sigma-one.vercel.app`; portada, productos, login y recuperación devuelven HTTP 200. API/Storage público: `https://garblac.duckdns.org`. Ese origen devuelve 404 para páginas del frontend: se comprobó por separado, sin confundir sus funciones.
- La copia de aplicación en Dell configura `http://192.168.0.17:8000`, que rechaza conexión desde el propio servidor. La API loopback usada por el migrador sí funciona. No se debe reutilizar automáticamente ese `.env.local` para un frontend público.
- Ventana de comparación detallada: 29/10/2026, 20:36:43–20:37:20 UTC (16:36:43–16:37:20 Bolivia). Lecturas REST paginadas hasta página vacía, ordenadas por clave cuando OpenAPI la informa; sin snapshot transaccional.
- Las mismas 40 tablas/vistas están expuestas en ambos orígenes. No se detectaron filas de Cloud ausentes en las relaciones con claves informadas. Las vistas sin clave se comparan como conjuntos de filas, por lo que un agregado actualizado puede aparecer como una fila retirada y otra nueva; no se considera pérdida de datos base.
- Las columnas requeridas de OpenAPI coinciden. Las diferencias de tipos observadas son alias de representación (`bigint`/`int64`, `integer`/`int32`), no prueba de conversión incorrecta. La nulabilidad SQL, restricciones, permisos y funciones todavía requieren el informe privilegiado.
- Productos: 362 Cloud / 363 Dell. Variantes: 411 / 412. Ventas: 53 / 54. Detalles: 101 / 102. Pagos: 53 / 54. Clientes: 0 / 0.
- Los detalles y pagos originales coinciden en sus columnas. La venta adicional #54 es del 28/10/2026, Bs 80, producto 315/variante 362; su movimiento #1022 justifica stock 57 → 56. No corresponde a ninguna de las cafeteras.
- El producto 363, `Prueba`, su variante 412, alta y movimientos del 28/10/2026 solo aparecen en Dell. También hay tres pedidos adicionales y un pedido descartado. Se separan como operaciones posteriores; no se sobrescriben con Cloud.
- Sin huérfanos en las comprobaciones ejecutadas de detalles/ventas/productos/variantes/pagos ni stocks negativos o sumas de variantes activas discrepantes. Esto no equivale a validar todas las reglas contables.
- La vista de conciliación ya presenta 233 filas `SIN_LEDGER` en Cloud; Dell tiene 234. No confundir ausencia histórica de trazabilidad con pérdida de filas durante la copia.
- Las dos cafeteras coinciden en producto, variantes, detalles, movimientos y ventas seleccionados de ambos servidores. La venta #50 requiere contrastarse con la entrega/comprobante real; no hay evidencia de que la migración haya intercambiado sus IDs.
- Los seis usuarios de Auth coinciden por ID y columnas disponibles, excepto `last_sign_in_at` y `updated_at` de una cuenta. No se compararon contraseñas. Dell habilita teléfono y autoconfirmación telefónica donde Cloud no lo hace: revisar antes de aprobar Auth.
- Cambios de imágenes persistidos: 778 imágenes de producto, 67 imágenes principales y una foto de perfil cambian de host Cloud a `garblac.duckdns.org`, conservando el mismo path.
- El commit **solo local en Dell** `1bf0d32` contiene una corrección de miniaturas que apunta al proyecto/dominio de Mil Moldes. Se preserva ese commit en el servidor; la corrección local preparada usa exclusivamente el origen de catálogo.

Evidencias reproducibles: `migration-comparison-2026-10-29.json`, `migration-public-2026-10-29.json`, `migration-cloud-anonymous-2026-10-29.json` y scripts `audit-*-readonly.py`. No contienen contraseñas ni filas de clientes/usuarios.

## Hallazgos de permisos preexistentes

Las consultas anónimas de conteo confirman acceso a `password_resets` (2 filas), `ventas_pagos` (53 Cloud / 54 Dell) y `stock_movimientos` (1019 / 1022), en ambos sistemas. No se descargaron códigos mediante la sesión anónima. Debe corregirse el acceso a códigos y revisar las políticas de pagos/ledger.

Se preparó `scripts/harden-legacy-password-resets.sql`, sin ejecutar: revoca acceso a la tabla antigua para `PUBLIC`, `anon` y `authenticated` y activa RLS. No elimina filas ni toca permisos de cesta. La recuperación actual usa enlaces Auth; las rutas antiguas quedan deshabilitadas en los cambios de aplicación. El endurecimiento de otras tablas requiere evaluar las políticas reales y sus consumidores.

La inspección privilegiada sí pudo registrar el esquema antes de detenerse por la colisión del contenedor de prueba (`migration-dell-schema-2026-10-29.json`):

- RLS está desactivado en `password_resets`, `producto_variantes`, `productos_historial`, `stock_movimientos` y `ventas_pagos`.
- La cesta conserva INSERT para `anon/authenticated` y SELECT/UPDATE/DELETE por `carrito-token`. También hay políticas autenticadas permisivas globales: deben revisarse sin romper las operaciones legítimas de la cesta. No se cambiaron esas políticas.
- Funciones de negocio `SECURITY DEFINER` tienen EXECUTE concedido incluso a `PUBLIC/anon`. El snapshot SQL Cloud muestra funciones de stock que validan un rol recibido por parámetro, no la identidad real del solicitante. No se invocaron para probar mutaciones sobre producción.
- Se preparó `harden-business-rpc-execution.sql`, sin ejecutar, para cinco funciones utilizadas por endpoints de servidor o sin consumidores de navegador en este repo. Conserva EXECUTE de `service_role`, verifica que los cuerpos coincidan por MD5 con los auditados y no cambia permisos de cesta. La anulación de venta desde navegador requiere migrar su consumidor a un endpoint autorizado antes de endurecer su función; sigue pendiente.
- Auth tiene `SITE_URL` de Vercel y redirecciones para Vercel y LAN. SMTP apunta a `supabase-mail:2500` con configuración de ejemplo; ese contenedor no apareció en el inventario suministrado. Entrega de correo no demostrada. No se enviaron correos ni se cambiaron contraseñas.

## Correcciones y validación actualizadas

- Resolver compartido `lib/storageImageUrl.mjs`: convierte URLs públicas antiguas de este proyecto, URLs LAN del Dell y rutas de bucket al origen público de garblac. Conserva rutas codificadas y consultas; no reescribe otros proyectos, enlaces privados firmados ni previsualizaciones `blob`/`data`.
- Integrado en catálogo, galerías, visor, miniaturas de venta, editor de imágenes, logos, perfiles, packs y aumento de stock. `imageOptimization.ts` ya no inventa parámetros de redimensionado sobre endpoints de objetos; Next Image hace la optimización real.
- Origen opcional de imágenes: `NEXT_PUBLIC_STORAGE_URL`, una URL pública HTTP(S), sin credenciales. Por defecto: `https://garblac.duckdns.org`. No copiar las claves o `.env.local` del origen Cloud al repo de Escritorio.
- TypeScript actualizado: aprobado. Suite local completa: **110/110 aprobadas**.
- Compilación de los cambios: aprobada con acceso de red. Un intento previo falló al descargar Geist de Google Fonts en el entorno restringido; no se cambió la tipografía para ocultar el fallo.
- Lint de la primera selección de archivos nuevos/modificados: sin errores, con advertencia de que `.jsx` queda fuera de la configuración actual. El lint global sigue pendiente con el fallo previamente registrado; no se ha limpiado todo el repositorio ni se afirma cobertura ESLint completa de JSX.
- Una imagen pública del Dell y la misma imagen vía optimizador de Vercel responden HTTP 200, MIME `image/jpeg`. Esta comprobación es anterior al despliegue de los cambios preparados.
- Prueba de navegador Chromium: aprobada (47,9 s), catálogos/rutas de país, visor táctil, navegación, cierre, orientación y retorno de foco. La expectativa antigua del visor fue actualizada para exigir el origen Dell de la imagen recibida desde Cloud. WebKit y Firefox no se ejecutaron en esta ronda.

## Respaldos y acceso privilegiado pendiente

Hay respaldos automáticos separados de base y Storage, además del dump original de Cloud, bajo `/srv/garblac/backups`. Su presencia no demuestra restaurabilidad ni independencia física del servidor.

**Incidencia de lectura de Storage:** enumeración recursiva/paginada completa: `imagenes` 10/10, `perfiles` 3/3, `product_images` 1247/1248 (Cloud/Dell), sin paths Cloud ausentes. Buckets públicos y límites/MIME permitidos coinciden. La fase de descarga/hash alcanzó la lectura del tar de respaldo, pero el script original aún no había persistido su manifiesto detallado antes de abrir el archivo. No se afirma igualdad SHA-256/MIME final sin ese manifiesto.

El proceso quedó en estado Linux `D`, espera `folio_wait_bit_common`, con posición de lectura 965.437.440 de 1.219.717.798 bytes del respaldo de imágenes. No es una restauración verificada ni una lectura íntegra aprobada. Esta espera no demuestra por sí sola avería física: falta diagnóstico del sistema. Se evitó iniciar nuevas comprobaciones pesadas y se indicó no repetir la restauración mientras se aclara el bloqueo. No se reinició, reparó ni desmontó ningún disco/servicio. Evidencia: `migration-storage-status-2026-10-29.json`.

El script de Storage preparado ahora imprime un checkpoint completo de hashes antes de leer el archivo de respaldo, para conservar evidencias aunque esa lectura se bloquee. No se ha repetido la descarga completa durante la incidencia.

Está preparado y copiado al Dell `backups/auditoria-20261029/audit-dell-isolated-restore.py`. Su ejecución solicitada con sudo consulta producción en modo de solo lectura y crea únicamente `catalogo-audit-restore-20261029`, sin red ni puertos, con los respaldos montados en solo lectura. Restaura el respaldo de Dell y el snapshot Cloud en bases separadas; verifica lectura completa de tablas, conteos, hashes de conjuntos y restricciones si la restauración termina. Registra fallos sin imprimir SQL con datos Auth. No se considera realizada hasta recibir y revisar `restore-report.json`.

La primera ejecución notificada se detuvo porque el contenedor de auditoría ya existía: `restores` vacío. Se preservó. Se preparó y comprobó sintácticamente una versión `audit-dell-isolated-restore-v2.py` que usa nombres únicos por fecha/PID para contenedor e informe; queda pendiente su resultado. No se afirma que el respaldo de base haya sido restaurado.

Resultado posterior de v2 comunicado por el usuario: informe `restore-report-20261029-205858-3557556.json`, `docker run` agotó 300 segundos y `restores` quedó vacío. La restauración sigue **no realizada**. El timeout ocurrió antes de marcar el contenedor como creado: no se puede garantizar que no haya quedado un contenedor parcial; debe inspeccionarse únicamente ese nombre cuando Docker responda. No se repite la creación ni se borra ningún contenedor. La causa del timeout no está confirmada; sigue pendiente la salida de `sudo dmesg -T --level=err,warn | tail -n 60`.

La prueba usa `--no-owner --no-privileges`: valida recuperación de datos/esquema, pero no acredita recuperación fiel de propietarios y ACL. Las políticas y grants de producción se registran por separado. El contenedor queda detenido para revisión; no se borra automáticamente.

No se solicitó acceso sudo general, no se ejecutaron migraciones en producción, no hubo push ni despliegue.

## Repositorio y entorno

- Repositorio: https://github.com/Matias-Gar/catalogo, rama `main`.
- Original: `C:\Users\saita\catalogo`. Sin cambios locales al iniciar.
- Sincronizado por avance directo de `426404a` a `58c6a1f`; sin push.
- Copia limpia de ese último commit en `C:\Users\saita\Desktop\catalogo-auditoria-2026-10-29`.
- Las correcciones se prepararon y probaron en la carpeta original y se copiaron también al repositorio del Escritorio después de comprobar que estaba limpio. Se copiaron únicamente cambios de código, scripts, pruebas e informes; no claves, `.env`, respaldos ni dependencias. Ambas carpetas conservan cambios sin commit/push.
- Next.js App Router, Supabase Auth/PostgREST/Storage, operaciones por país/sucursal y variantes.
- Ambos archivos locales de entorno apuntan a `gzvtuenpwndodnetnmzi.supabase.co`.
- El commit remoto incorpora `garblac.duckdns.org` para imágenes; esto no prueba cuál es el entorno desplegado.
- Dell indicado por el usuario: `matias@192.168.0.17`. Acceso por clave confirmado posteriormente; ver avance al inicio.

## Evidencia directa de Cloud: cafeteras

Consultas de lectura autenticadas con la configuración local. Productos buscados por nombre; variantes, detalles, movimientos e historial consultados por IDs 306/308, ordenados por `id` y paginados de 500 en 500 hasta terminar. Sin modificar datos.

| Producto | ID | Variante | Stock actual | Venta | Detalle | Movimiento |
|---|---|---|---|---|---|---|
| Cafetera Moka Italiana 9 Tazas | 306 | 352 Negro | 0 | 40 | 85 | 996 |
| Cafetera Moka Italiana 9 Tazas | 306 | 351 Plateado | 1 | Sin venta en los detalles consultados | — | Alta 783 |
| Cafetera Italiana 9 Tazas | 308 | 355 Unico | 0 | 50 | 97 | 1016 |

- Venta 40: 16/10/2026 17:44:50 UTC, efectivizada, efectivo, total Bs 250; detalle de cafetera Bs 112,50. Descuenta una unidad negra.
- Venta 50: 22/10/2026 19:59:07 UTC (15:59:07 Bolivia), efectivizada, QR, total Bs 150; detalle 97 identifica producto 308/variante 355. Movimiento 1016: stock 1 → 0.
- Ambas cafeteras tenían stock inicial en variantes. `productos.stock_inicial = 0` no demuestra ausencia de ingreso: las variantes y movimientos documentan el alta.
- El agotamiento de 308 también existe en Cloud. No se puede atribuir exclusivamente a una copia incorrecta de la base. Tampoco se puede afirmar que la venta 50 represente lo realmente entregado: falta contrastar pedido/comprobante y Dell. Una posible selección equivocada de producto sigue pendiente de investigación.
- No se restituyó stock ni se alteraron ventas.
- No existe `public.pagos` en el esquema REST consultado; se deben identificar las tablas reales de pagos. Los pedidos con `venta_id` 40/50 no devolvieron filas en `carritos_pendientes`.

## Seguridad: cambios locales preparados

- La ruta `forgot-password` permitía actualizar Auth con solo email si el perfil carecía de CI, o con email/CI si lo tenía. El CI no acredita control de la cuenta.
- Las dos rutas antiguas responden ahora 410 sin acceder a Auth ni credenciales. El handler antiguo fuera del formato App Router también queda inhabilitado.
- El formulario actual ya usa `resetPasswordForEmail`, y `/reset-password` actualiza mediante sesión Auth. Pendiente revisar ajustes reales, redirecciones, entrega del correo y expiración en Dell.
- `.gitignore` excluye nuevos respaldos y la clave exclusiva de auditoría. Hay un respaldo de caja **ya versionado antes de esta auditoría**; ignorar la carpeta no lo elimina del historial. No se borró ni se volvió a publicar.
- No se compararon contraseñas, hashes de contraseña ni restricciones SQL de Cloud/Dell.

## Validación local

- TypeScript: aprobado.
- Compilación Next.js: aprobada, 79 páginas generadas.
- Primera ejecución de pruebas bloqueada por `spawn EPERM` del entorno; repetida con permiso de ejecución.
- Suite inicial: 104 aprobadas / 1 fallo de imágenes. Corregido mediante resolución centralizada; suite actual: 110/110 aprobadas.
- Lint: falla con 97 errores y 82 advertencias en el conjunto del repositorio (efectos React, tipos `any`, imports `require`, entre otros). No se considera aprobada la calidad global.
- Nuevas pruebas de seguridad: 2 aprobadas. Comprueban que ambos endpoints rechazan email, email/CI y códigos antiguos sin acceder al cliente privilegiado ni actualizar Auth.

## Trabajo pendiente para aprobar

1. Revisar el informe de inspección privilegiada y restauración aislada cuando el usuario ejecute el script. Identificación y acceso SSH ordinario ya confirmados.
2. Completar esquema SQL, nulabilidad, claves, restricciones, secuencias, funciones y permisos contra el snapshot original Cloud y el estado real de Dell. La comparación REST paginada ya está realizada; no reemplaza esta comprobación SQL ni un snapshot transaccional.
3. Usuarios Auth paginados ya comparados. Pendientes URL/redirecciones reales, configuración telefónica, entrega/expiración del correo y prueba de recuperación con una cuenta de prueba autorizada. No afirmar igualdad de contraseñas.
4. Cerrar el informe Storage con SHA-256, MIME y lectura del archivo de respaldo, y revisar las políticas reales. El resolver ya está preparado y probado.
5. Resolver con el usuario la discrepancia entre la venta #50 registrada y el producto realmente vendido. Conservar los problemas históricos de ledger separados de los cambios posteriores en Dell.
6. Corregir permisos de códigos antiguos y evaluar pagos/ledger, preservando agregar/aumentar/disminuir/eliminar productos de cesta anónima y autenticada; comprobar mutaciones solo en entorno aislado.
7. Aprobar restauración de base y verificar independencia física de respaldos; no sobrescribir producción.
8. Atender los fallos globales de lint y su falta de cobertura JSX. Pedir autorización sobre cambios concretos antes de producción, push o despliegue, y verificar la aplicación publicada después. No se realizó ningún despliegue en esta auditoría.
