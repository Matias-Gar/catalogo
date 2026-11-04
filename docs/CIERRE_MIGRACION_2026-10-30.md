# Avance de migración, 30 de octubre de 2026

El usuario autoriza publicar los cambios y continuar usando el Dell pese al riesgo conocido de almacenamiento para dejar de pagar Supabase Cloud. Esta aceptación no supone reparación ni salud del RAID y no autoriza borrar proyectos, respaldos ni datos de otros servicios.

## Hardware confirmado por capturas de iDRAC

- Dell Storage NX430, PERC H730, disco virtual UBUNTUSERVER RAID 5 de 3725 GB: degradado, redundancia restante 0.
- Ranura 0: en línea, indicador verde en la captura general; sin diagnóstico completo individual.
- Ranura 1: en línea, falla prevista Sí, miembro del RAID.
- Ranura 2: fallido.
- Ranura 3: listo, falla prevista Sí, 0 GB usados por RAID, no es repuesto dinámico.
- No se modifica el RAID ni se inicia reconstrucción. Los errores de medio continúan en el diagnóstico de hoy.
- Se recuperó el acceso a iDRAC cambiando localmente la contraseña de la cuenta root, ID 2. La contraseña fue introducida por el usuario; no se guarda aquí.
- ipmitool y su biblioteca se extrajeron en RAM, sin instalación de paquetes. El cable volvió al puerto original según confirmación del usuario.

## Publicación y validación

- Publicado en origin/main el commit 075e971: resolución de imágenes públicas de este proyecto hacia Dell y cierre HTTP 410 de las rutas antiguas de recuperación insegura. 21 archivos; sin credenciales ni respaldos.
- GitHub informó éxito del despliegue Vercel: https://vercel.com/matias-projects-9f6961d9/catalogo/BwGgyWMF6tSujXNWKW7Nrhv4kz4B
- 110 pruebas Node aprobadas, TypeScript aprobado, compilación Next.js aprobada, prueba Chromium del visor aprobada. La compilación y Chromium se ejecutaron en la carpeta principal con los mismos cambios de aplicación.
- El lint previo sigue pendiente (92 errores y 70 advertencias en el alcance documentado). No se declara calidad global aprobada ni cierre completo.
- La web publicada se comprobó con Cloud bloqueado: /bo/productos, /login y /reset-password responden 200 y las solicitudes REST observadas apuntan al Dell. Cero solicitudes al host Cloud. En la prueba con desplazamiento, 58 de 65 imágenes estaban cargadas, ninguna había fallado y siete seguían pendientes al cerrar la observación; no se declara carga completa de todas las imágenes. Login y recuperación cargaron sus dos imágenes. Evidencia: migration-live-cloud-scrolled-2026-10-30.json.
- Las dos rutas antiguas POST de recuperación publicadas responden HTTP 410 con datos ficticios; no se modificó ninguna contraseña con esa comprobación.

## Datos preservados

- El usuario confirma que no hubo operaciones de negocio desde el SQL de ayer a las 17:26 de Bolivia.
- Cinco archivos SQL independientes releídos hoy: tamaño y SHA-256 coinciden con el manifiesto. Evidencia: migration-independent-sql-recheck-2026-10-30.json.
- Nueva exportación REST en backups/emergency-api-2026-10-30: 40 tablas/vistas completas, metadatos de seis usuarios, cero errores, todos los archivos cotejados con su manifiesto.
- Las páginas de registros públicos exportadas coinciden por SHA-256 con la exportación de emergencia de ayer. Evidencia: migration-records-recheck-2026-10-30.json.
- La exportación REST no es transaccional ni reemplaza un respaldo SQL. El respaldo Storage previamente verificado contiene 1261 paths, 1260 objetos Cloud y 1261 Dell.
- Los objetos Cloud del manifiesto suman 1236989727 bytes; no se presume que el proyecto cumpla las cuotas Free actuales sin revisar Billing.

## Correo y facturación pendientes

- Se preparó en RAM /dev/shm/catalogo-activar-gmail-20261030.py. El indicador --accept-storage-risk permite reconocer expresamente el riesgo, conservando el bloqueo por defecto, la verificación de hashes, las comprobaciones Docker/Auth y el intento de rollback.
- El usuario debe ejecutarlo con sudo en su terminal, pues la contraseña sudo no queda disponible en las conexiones del asistente. No se declara instalado ni correo enviado hasta revisar el informe y una prueba real.
- Intento de activación del 30 de octubre: timeout de 12 segundos en docker compose version, antes de cambios. production_changed, smtp_applied, logos_applied y mail_sent son false. Evidencia: migration-gmail-activation-attempt-2026-10-30.json.
- Se descargó Compose oficial estable 5.6.1 desde docker/compose en GitHub; SHA-256 cotejado con checksums.txt. Binario y configuración temporal en RAM dentro del stage privado. La prueba real de la versión directa y mediante docker compose respondió 5.6.1 y exit 0. No se reemplazó Docker/Compose instalado ni se modificaron servicios.
- El lanzador acepta --use-ram-compose: verifica el hash fijo del plugin y una configuración temporal vacía, y pasa DOCKER_CONFIG al instalador existente. Conserva hashes del bundle, comprobaciones previas y rollback. Pendiente repetir sudo con esa opción y revisar el resultado.
- La cancelación del plan de pago se realiza cambiando a Free en Billing de la organización; no exige borrar el proyecto. Hay que revisar advertencias, límites y cargos pendientes en la cuenta real. El asistente no tiene una sesión autenticada de facturación disponible.
- El usuario confirmó la transición y mostró Billing de Matias-Gar's Org en Free Plan. La baja del plan de pago está confirmada por captura; no se inspeccionaron facturas ni cargos por consumo anteriores. No se borró ningún proyecto.
- Segundo intento del 30 de octubre: Compose en RAM pasó, OAuth se verificó y se crearon el directorio del relay, sus dependencias, configuración y unidad systemd. Falló systemctl daemon-reload a los 30 segundos. SMTP y logos siguen sin aplicar; ningún correo enviado. Evidencia: migration-gmail-partial-install-2026-10-30.json.
- Se copió el systemctl instalado a RAM, SHA-256 37ec607113f55f1b385b4fa75588a43402aec0de57927500763b267713f10f63. Desde RAM respondió versión 255.4-1ubuntu8.18 y estado del relay loaded/inactive/dead/disabled.
- Preparada reanudación explícita con --resume --use-ram-systemctl. Comprueba propietarios/permisos, configuración exacta, código, todas las dependencias contra los wheels y unidad systemd exacta; conserva la instalación existente. Cuatro pruebas aisladas pasaron: instalación coincidente sin escrituras y rechazo de código, dependencia o configuración distintos.
- Bundle de reanudación verificado en RAM, SHA-256 b4810f9a83893d4d77c50b4bf1f3c61f92ba4e0c8f0d5ae3965d38db060080af; versiones anteriores preservadas. Pendiente ejecución sudo por el usuario y prueba real de recuperación.
- La reanudación posterior verificó la instalación existente y OAuth, pero la prueba SMTP no pasó; el instalador deshabilitó/detuvo el relay y mantuvo Auth sin cambios. Evidencia: migration-gmail-startup-failure-2026-10-30.json.
- Diagnóstico directo: el relay instalado arranca y renueva OAuth. La prueba SMTP tiene usuario y contraseña coincidentes, pero recibe el peer 192.168.0.17, fuera de 172.18.0.0/16, y devuelve 535. Incluso fijando source_address=172.18.0.1, el cliente informa origen 172.18.0.1 y el servidor recibe 192.168.0.17. Fijar el origen no resuelve la traducción observada.
- No se amplió la lista de redes permitidas ni se cambiaron reglas NAT. El listener temporal de diagnóstico se cerró, sin correos enviados.
- Preparado /dev/shm/catalogo-diagnostico-red-correo.py: consulta NAT y prueba SMTP desde un proceso hijo que entra únicamente al namespace de red de Auth; no altera reglas, servicios ni el namespace del contenedor. Requiere sudo. Pendiente resultado antes de otro intento de activación.
- Resultado del namespace de Auth comunicado por el usuario: peer 172.18.0.5, autenticación SMTP correcta. Se corrigió la comprobación del instalador para ejecutarla desde un hijo en ese namespace; no se amplió la red permitida.
- Intento posterior (migration-gmail-auth-update-failure-2026-10-30.json): SMTP privado pasó, pero la recreación de Auth falló y rollback_health_ok es false. El archivo .env anterior se restauró según el instalador; la recuperación del contenedor no está confirmada. La comprobación externa con credenciales devolvió 503 para /auth/v1/health. El relay figura active/running. Prioridad: recuperar Auth, no repetir el instalador.
- Preparado /dev/shm/catalogo-inspeccionar-auth.py: lectura de todos los contenedores del servicio auth/proyecto supabase, estados, host/puerto SMTP sin secretos, coincidencia del archivo .env con rollback y estados de procesos Docker. Sin mutaciones. Pendiente ejecución sudo por el usuario para elegir una recuperación basada en el estado real.
- Inspección posterior del usuario: original 63d7981cd9047ab677536109dc397e726369a96159b45ba9a20b66f44530cff3 /supabase-auth estaba exited; reemplazo a706913622fbb70994998dab7c0608f1c247021064c48606b517a235a9e01b84 /aa65dab91b3f_supabase-auth estaba created. Ambos conservaban SMTP supabase-mail:2500. .env coincide con rollback.
- Recuperación preparada y ejecutada con sudo: un único POST start al ID original verificado; sin borrar ni recrear contenedores. La solicitud agotó 12 segundos. Evidencia: migration-auth-recovery-timeout-2026-10-30.json. No se repite el POST tras timeout porque el arranque puede seguir avanzando.
- Observación posterior por SSH de /proc: nuevo containerd-shim PID 4115528 y proceso auth PID 4115552 en estado D (disk sleep), wchan folio_wait_bit_common. Auth está esperando lectura del almacenamiento; su endpoint externo autenticado sigue en 503. No se declara recuperación ni cierre completo. No se reinició Docker, containerd ni el servidor.
