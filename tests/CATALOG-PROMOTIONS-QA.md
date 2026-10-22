# Verificación de promociones — 22 de octubre de 2026

La revisión ampliada y el estado actual se documentan en [order-sale-audit.md](reports/order-sale-audit.md). Los resultados siguientes conservan la verificación inicial; no sustituyen ese informe posterior.

## Incidencia posterior: convertir un pedido en venta

La primera verificación no cubría convertir un pedido existente cuyo campo `precio_original` ya estaba incorrecto. Se confirmó mediante lectura del pedido 5: el producto 204 tenía `precio_unitario=142.50` y `precio_original=142.50`, mientras el precio de BD era 190 y la promoción vigente 25%. Eso producía una segunda aplicación de 25%, enviando 106.88 por unidad y provocando el rechazo del servidor.

La reconstrucción del pedido ahora recupera la base de la BD, incluyendo el precio propio de la variante cuando existe. También se recupera la base del catálogo por encima de metadatos incorrectos en cestas antiguas.

Se agregaron nueve pruebas en `tests/sale-order-conversion.test.mjs`, todas aprobadas. Cubren la reproducción del fallo, metadatos incorrectos/ausentes/correctos, variantes, precio fijo, descuento 100%, falta de precio verificable, rechazo de rebajas extra y la ruta real de creación con autenticación y guardado simulados. La prueba de la ruta comprueba respuesta 200 y llamada a `crear_venta_completa_segura` con total 285 y precio unitario 142.50; no ejecuta el procedimiento de producción. TypeScript aprobado.

Se agregó también una regresión de cesta con `precio_original` incorrecto, aprobada junto con las otras cinco pruebas de cesta y las 17 pruebas de descuentos de venta. La verificación original de navegador descrita abajo antecede a esta incidencia.

## Resultado

58 verificaciones aprobadas: 30 pruebas automatizadas de cálculo/API/almacenamiento y 28 recorridos en Chromium (14 en escritorio y 14 en tamaño móvil). `npm run typecheck` aprobado.

## Recorridos de navegador

Se usa la página real servida por Next.js. Las consultas y el guardado se interceptan con datos simulados; no se escriben pedidos reales ni se envían mensajes. Se captura la URL de WhatsApp.

Cada recorrido exitoso compara el total visible en la confirmación, el precio y cantidad del payload de guardado y el total del texto de WhatsApp.

1. Descuento de 25%, dos unidades de Bs 100: Bs 150.
2. Sin promoción: Bs 100.
3. Cesta antigua con precio ya descontado: Bs 150, sin descontar dos veces.
4. Cesta antigua con precio original: Bs 150.
5. Variante de Bs 200, dos unidades con 25%: Bs 300.
6. Cantidad fraccionaria 0,5 de Bs 100 con 25%: Bs 37,50.
7. Precio fijo de Bs 60, dos unidades: Bs 120.
8. Descuento absoluto de Bs 30, dos unidades: Bs 140.
9. Promoción vencida: Bs 100.
10. Promoción futura: Bs 100.
11. Recargar con la cesta guardada conserva Bs 150.
12. Error de guardado: conserva la cesta y no abre WhatsApp.
13. Bs 99,99 con 25%: precio unitario Bs 74,99; tres unidades Bs 224,97.
14. Descuento de 100%: Bs 0.

## Hallazgos corregidos

- El carrito usaba un cálculo distinto al catálogo y comparaba IDs sin normalizar su tipo.
- Se guarda la referencia del precio original y la promoción junto al precio final.
- La cesta antigua necesita recuperar la base del catálogo; la persistencia conserva los datos de origen mientras se carga.
- Se evita guardar la cesta de una sucursal bajo otra clave antes de terminar de recuperarla.
- El producto sin variantes usa el precio recién consultado al agregarlo.
- Una consulta exitosa de promociones limpia un error anterior.
- El precio promocional se redondea a centavos antes de multiplicarlo para coincidir con el precio mostrado.

## Comandos reproducibles

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3100
# En otra terminal:
node tests/catalog-cart-pricing.test.mjs
node tests/sale-discounts.test.mjs
node tests/pending-order-pricing.test.mjs
node tests/browser-storage.test.mjs
node tests/catalog-order-browser.mjs
$env:CATALOG_MOBILE = '1'
node tests/catalog-order-browser.mjs
npm run typecheck
```

## Límites

- La API real de pedidos se ejecutó adicionalmente con una base simulada para comprobar que conserva precios y promociones y devuelve errores correctamente. No se verificó una inserción en la base de producción.
- Las pruebas de navegador fueron en Chromium, con tamaños de escritorio y móvil; no representan un dispositivo físico ni Safari/Firefox.
- Lint de los módulos y pruebas revisados no reportó errores; existe una advertencia previa en `usePromociones.js`. La página de productos conserva errores previos de reglas React; no se presenta el lint global como aprobado.
- No se publicó el cambio ni se verificó el despliegue de producción.
