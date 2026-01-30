# GitHub Copilot – Instrucciones del Repositorio

Estas instrucciones definen el contexto, estándares y expectativas para que GitHub Copilot genere código consistente, seguro y alineado con este proyecto.

---

## 🧩 Contexto del Proyecto

Este repositorio corresponde a un **catálogo de comercio electrónico** desarrollado con **Next.js 16 (App Router)**.

Características principales:
- Panel administrativo
- Catálogo público de productos
- Integración con **Supabase** (base de datos y backend)
- Integración con **WhatsApp Business API**
- Integración con **Facebook / Meta (Pixel, catálogos)**
- Generación de catálogos imprimibles / PDF
- Despliegue en **Vercel**

El proyecto está orientado a **comercio minorista (street wear)**.

---

## 🛠️ Pila Tecnológica

Copilot **DEBE asumir** el siguiente stack:

- **Next.js 16.x** (App Router)
- **React 19.1**
- **JavaScript / TypeScript 5**
- **Tailwind CSS 4**
- **Supabase** (PostgreSQL + API)
- **Firebase Auth** (cuando aplique)
- **Vercel** (hosting)

---

## 📁 Estructura del Proyecto

Copilot debe respetar esta organización:
- `/app` — rutas y endpoints (app router + API)
- `/components` — componentes UI reutilizables
- `/lib` — clientes (SupabaseClient), hooks y utilidades
- `/public` — assets públicos
- `.github` — CI/CD y configuraciones de Copilot

---

## 🧭 Patrones de código y buenas prácticas

- Preferir componentes funcionales y hooks.
- Usar la directiva `"use client"` solo cuando el componente lo requiera.
- Exportaciones con nombre cuando sea posible; default export para páginas.
- Prefijo `@/` para alias de rutas si está configurado.
- Evitar Math.random() en keys; usar id o índice estable solo como fallback.
- Manejar errores y mostrar feedback (showToast o similar).
- Añadir rel="noopener noreferrer" a enlaces con target="_blank".
- Considerar `next/image` para optimizar imágenes cuando sea compatible con la funcionalidad (revisar html2canvas/html2pdf).

---

## 🔒 Seguridad y validación

- Nunca exponer secrets: usar variables de entorno (SUPABASE_URL, SUPABASE_ANON_KEY).
- Sanitizar entradas/HTML (ej. DOMPurify) antes de renderizar contenido de usuarios como HTML.
- Usar consultas parametrizadas y validar datos en el servidor.
- Validar CORS para assets que serán consumidos por html2canvas/html2pdf.

---

## 🌎 Idioma y localización

- Contenido orientado al usuario en español.
- Comentarios técnicos y mensajes internos pueden estar en inglés o español; mantener consistencia.

---

## 🧰 Linting y formato

- Seguir reglas de ESLint y Prettier del repo.
- Evitar deshabilitar reglas salvo justificación documentada.

---

## 📌 Ejemplos (para orientar sugerencias)

- Promociones:
```js
const { promociones, loading, error } = usePromociones();
const { precioFinal, tienePromocion } = calcularPrecioConPromocion(producto, promociones);
```

- Consultas Supabase:
```js
const { data, error } = await supabase
  .from('productos')
  .select('*')
  .order('nombre', { ascending: true });
```

---

## 🤖 Reglas de interacción de Copilot

- Priorizar sugerencias que sigan estas pautas.
- Si el código sugerido afecta seguridad (inyección SQL, XSS), indicar el riesgo y proponer mitigación.
- Proponer tests o pasos de verificación cuando se cambia lógica crítica.
- Ante ambigüedad, pedir aclaración antes de generar cambios riesgosos.

---

## ⚠️ Advertencias de CI/Firewall

- Si una acción requiere acceso a hosts externos (ej. gh.io), indicar la necesidad de whitelisting en la documentación del repo.

---

Mantener este documento actualizado con cambios de arquitectura o políticas de seguridad.

