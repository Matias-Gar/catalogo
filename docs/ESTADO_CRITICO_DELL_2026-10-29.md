# Catálogo: incidencia confirmada de almacenamiento del Dell

## Actualización de cierre

El usuario aclara que creó RAID 5 con tres discos de 2 TB antes de instalar Ubuntu y migrar. Esa configuración inicial no demuestra la salud actual del arreglo: siguen pendientes su estado actual y la identificación física del disco señalado por PERC. El usuario confirma que la interfaz web de iDRAC en `192.168.0.120` no abre desde su PC.

La comprobación publicada de las 19:46–19:47 de Bolivia, con Cloud bloqueado en el navegador, obtuvo respuestas REST de Dell pero todavía detectó peticiones a logos de Cloud. En la espera de esa prueba solo cargaron 2 de 65 imágenes del catálogo; esto no demuestra pérdida de los archivos, pero impide afirmar que su entrega funciona correctamente. Evidencia: [prueba publicada](migration-live-cloud-blocked-2026-10-29.json).

Se preparó una copia aislada del repositorio actualizado en `.audit-access/migration-closeout`, rama `audit/migration-closeout-20261029`, con 21 archivos de aplicación y pruebas: resolución de imágenes públicas antiguas hacia Dell y desactivación de las rutas antiguas que podían cambiar contraseñas sin prueba suficiente de identidad. No contiene respaldos ni credenciales. No se hizo push ni despliegue de esos cambios. Las 110 pruebas Node, TypeScript, compilación y prueba Chromium del visor pasaron. ESLint sobre aplicación, componentes, librerías y pruebas falló con 92 errores y 70 advertencias; no se declara aprobado. [Alcance y validación de la publicación propuesta](PUBLICACION_PENDIENTE_CATALOGO_2026-10-29.md).

**No cancelar Supabase Cloud todavía. No activar SMTP ni recrear Auth hasta revisar el RAID.**

El servidor identificado es **Dell Storage NX430**, con controladora **PERC H730**. El diagnóstico del 29 de octubre de 2026, a las 19:25 de Bolivia, registra repetidamente:

```text
Unrecoverable medium error during recovery on PD 01(e0x20/s1) at 110cf3a
```

Es un error de medio irrecuperable comunicado por la controladora. Se observó además espera de lectura en programas del sistema, incluidos Compose y `/bin/true`. No se ha identificado todavía el nivel de RAID, el estado de todos sus discos ni la correspondencia física definitiva del identificador. **No se recomienda extraer discos, inicializar ni reconstruir el arreglo a partir únicamente de ese mensaje.** Dell advierte que intervenciones sobre arreglos con errores adicionales pueden exigir recuperación desde respaldo: [referencia oficial](https://www.dell.com/support/kbdoc/en-us/000139251/double-faults-and-punctures-in-raid-arrays).

La consulta SMART al ID físico 0 agotó su tiempo y no produjo un resultado de salud. Eso no constituye un diagnóstico de SMART para el PD 01 mencionado en los avisos.

## Datos de Catálogo preservados fuera del Dell

- **SQL independiente:** `C:\Users\saita\catalogo\backups\database-verification-2026-10-29T21-26-12-273Z`. Cinco archivos, incluido un dump de `public`, `auth` y `storage` del Dell. Se volvieron a comprobar tamaño y SHA-256 de los cinco: todos coinciden. El dump de Dell y el snapshot original ya se restauraron realmente en PostgreSQL WASM/PGlite aislado; se comprobaron datos y 119 restricciones de negocio, con rechazos efectivos de PK duplicada, PK nula y FK inválida. No fue un ensayo de recuperación completa de GoTrue, Storage, propietarios o ACL del sistema operativo.
- **Storage independiente:** `C:\Users\saita\catalogo\backups\verification-2026-10-29T21-17-14-362Z`. Los 1260 archivos compartidos entre Cloud y Dell coinciden por SHA-256 y MIME; existe un archivo nuevo en Dell. La relectura del respaldo verificó 2521 archivos binarios, sin diferencias contra su manifiesto.
- **Copia adicional de emergencia de los registros actuales:** `C:\Users\saita\catalogo\backups\emergency-api-2026-10-29T23-31-52Z`, terminada a las 19:31 de Bolivia. Se paginaron las 40 tablas/vistas públicas expuestas y los metadatos de seis usuarios de Auth. Incluye 363 productos, 412 variantes, 54 ventas, 102 detalles, 54 pagos y 1022 movimientos de stock. Cero errores y todos los archivos guardados coinciden con su manifiesto. Es una exportación REST de emergencia, **no un snapshot transaccional ni un respaldo SQL**, y no contiene hashes de contraseñas, RLS o funciones.
- El usuario confirmó que no hubo ventas, pagos ni cambios de inventario después del respaldo SQL de las **17:26 de Bolivia**. La copia REST aporta una lectura posterior; no se deduce igualdad por columna únicamente de que los recuentos coincidan.

Los respaldos están excluidos de Git. No se han publicado claves, tokens, contraseñas ni los datos exportados.

## Estado de los cambios

- Solo se publicaron, con autorización expresa, las dos páginas informativas de correo/privacidad en el commit `3c4b210`. Vercel confirmó el despliegue y se verificaron ambas URLs y el formulario de acceso.
- Gmail OAuth está En producción según la captura del usuario; se renovó la autorización de solo envío y se verificó desde Windows y Dell. El adaptador pasó siete pruebas SMTP, y el lector de metadatos Docker pasó seis pruebas adicionales. **No se ha enviado ningún correo real ni se ha instalado el servicio.**
- Los dos intentos root de activación salieron antes de modificar producción. **No se cambió SMTP, no se recreó Auth y no se aplicaron las tres URLs de logos.** El lanzador preparado en RAM ahora comprueba un marcador de suspensión para evitar una activación accidental mientras existe esta incidencia.
- No se reinició el Dell, Docker, iDRAC ni ningún otro proyecto. No se repararon discos ni se alteró el RAID.
- La revisión completa de la migración y las correcciones locales restantes se describen en [el informe principal](AUDITORIA_MIGRACION_2026-10-29.md). La incidencia de almacenamiento no invalida las coincidencias ya comprobadas, pero impide recomendar el Dell como reemplazo fiable y cerrar la migración.

## Próximo paso

Consultar, en modo de solo lectura, el RAID y los discos físicos en iDRAC antes de decidir una intervención. No se encontraron herramientas iDRAC instaladas; `/dev/ipmi0` sí existe. `scripts/read-idrac-ip.py`, copiado como `/dev/shm/catalogo-ver-ip-idrac.py`, envía únicamente la consulta IPMI Get LAN Configuration Parameter para leer la dirección IPv4 del canal 1. Su autoprueba de ABI, petición de solo lectura y decodificación pasó sin acceder al hardware. El usuario lo ejecutó con sudo y **confirmó la dirección configurada `192.168.0.120`**, sin cambios de producción ni configuración.

La comprobación HTTP/HTTPS anterior desde el PC a esa dirección agotó cuatro segundos y no intentó iniciar sesión. La IP configurada por sí sola no demuestra conectividad, cableado ni disponibilidad de la interfaz web. El siguiente paso es comprobar la pantalla `https://192.168.0.120` desde la misma red y, si no abre, verificar el puerto/cableado de gestión según el equipo, antes de decidir cualquier cambio. No se indicó un reinicio ni una modificación automática de iDRAC.

## Evidencias

- [Errores PERC confirmados](migration-dell-storage-health-confirmed-2026-10-29.json)
- [Reverificación SQL independiente](migration-independent-sql-recheck-2026-10-29.json)
- [Resumen de la copia REST de emergencia](migration-emergency-api-backup-2026-10-29.json)
- [Verificación de los archivos de Storage guardados](migration-storage-backup-verification-2026-10-29.json)
- [Restauraciones y restricciones](migration-restoration-verdict-2026-10-29.json)
