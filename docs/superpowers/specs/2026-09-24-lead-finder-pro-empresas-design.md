# Lead Finder Pro para empresas — diseño

Fecha: 2026-09-24. Estado: aprobado en conversación, pendiente de revisión del spec escrito.

## Objetivo

Hoy Lead Finder Pro apunta a devs y agencias (auditar negocios locales sin web o con SEO débil).
Se quiere que también sirva a **empresas que venden un producto** (ej. un comercio de celulares):
encontrar a los comercios del rubro en una zona, ver qué tan activa está su web y cuánto de ese
producto tienen publicado, y escribirles a todos de una vez.

El cliente puede ser dev/agencia **o** empresa. Un mismo motor de búsqueda, dos perfiles.

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Perfil | Selector al empezar: "Soy dev/agencia" o "Soy empresa que vende un producto". Cambia qué campos pide y qué columnas prioriza; el motor es el mismo. |
| Conteo de productos | Donde se pueda detectar: catálogo real de la plataforma (Shopify, Tiendanube, WooCommerce); si no, estimación por sitemap; si no, "no detectable". Con indicador de confianza. |
| Ubicación del robot | Acción nueva `countProducts`, separada de `auditPlace`, llamada por el panel después de auditar. |
| Costo | Incluido. 1 crédito = 1 negocio con todo adentro. `countProducts` no descuenta crédito. |
| Mail masivo | `mailto:` en CCO por tandas + botón "Copiar todas las casillas". Todo del lado del cliente. |

## Lo que ya existe (no se reconstruye)

- Búsqueda por zona + rubro, nombre, teléfono, sitio web, score SEO: `CustomerLeadFinderPanel.jsx` y `/api/lead-finder-pro/run`.
- `auditSite()` en `src/app/api/lead-finder/route.js` ya calcula `email` y `lastModified`, y el resultado ya se guarda en el historial del cliente. El panel simplemente no los muestra.

## 1. Backend

### Acción `countProducts` (en `/api/lead-finder-pro/run`)

- Gratis: se agrega a las acciones permitidas sin pasar por el gate de créditos, pero **exige login**.
- Entrada: `placeId` y `keyword`. **Nunca una URL.**
- El server lee `leadfinder_client_audits/{uid}/audits/{placeId}` y toma `siteUrl` de ahí. Si el cliente no auditó ese negocio o no tiene sitio, responde `no aplica`. Solo se rastrea un sitio que el cliente ya auditó.
- Salida: `{ ok, count, confidence: 'catalogo' | 'estimado' | null, platform, partial, checkedAt }`.
- Seguridad de red: solo `http/https`; se rechazan hosts privados/locales, también tras redirecciones; tope de páginas leídas.
- Tiempo: timeout por fetch y presupuesto total de ~20 s. Si se agota, devuelve lo contado con `partial: true`.
- Caché: colección nueva `places_product_count`, clave `placeId + keyword normalizada`, TTL 7 días. Separada de `places_seo_cache` porque el número depende de la palabra clave.

### Módulo `src/lib/productCounter.js`

Función pura, con `fetch` inyectable para testear sin red.

1. Detecta plataforma por señales de la home.
2. Con plataforma detectada, lee su catálogo público filtrado por palabra.
3. Si falla o no hay plataforma, cuenta URLs del sitemap cuyo slug contiene la palabra normalizada (sin tildes, con plurales) → `estimado`.
4. Sin sitemap ni catálogo → `null`.

Los endpoints públicos de cada plataforma se **validan contra sitios reales durante la implementación**; no están verificados todavía.

### Cambio en `auditSite`

Se agrega `lastUpdated`: el `<lastmod>` más reciente del sitemap, con el header `Last-Modified` de la home como respaldo. Motivo: `Last-Modified` casi nunca viene en sitios dinámicos. `seoScore` no cambia.

### Tests

- `productCounter`: respuestas falsas por plataforma, fallback a sitemap, caso sin datos, normalización de palabra.
- Gate de `countProducts`: 401 sin login, `no aplica` sin auditoría previa, no descuenta crédito. Reusa `createFakeDb` de `run/route.test.js`.

## 2. Panel del cliente (`CustomerLeadFinderPanel.jsx`)

Textos nuevos en `lfpT` (ES y EN).

- **Selector de perfil** al empezar. Perfil dev: sin cambios. Perfil empresa: campo obligatorio "Producto a rastrear".
- **Columnas nuevas:**
  - Email (dato que ya devuelve `auditPlace`).
  - Última actualización (`lastUpdated`); se marca en color si tiene más de 18 meses.
  - Productos (solo perfil empresa): número + etiqueta "catálogo" o "estimado"; "—" si no se pudo.
- **Flujo:** tras cada `auditPlace` exitoso con sitio, se llama a `countProducts`. Celda "contando…"; si falla, "—" con botón de reintentar por fila. Un fallo del conteo no frena la búsqueda ni consume crédito.
- **Historial:** las filas se guardan tal cual, así que los campos nuevos se persisten solos. Reabrir una búsqueda no re-rastrea.
- **CSV:** columnas nuevas Email, Última actualización, Productos y Confianza.

## 3. Mail masivo

100% cliente. Sin backend, sin costo, sin envío desde nuestros servidores.

- Botón "Escribir a los N mails", visible si hay resultados con email. Junta emails sin duplicados ni vacíos.
- Tandas por **largo real del enlace** (~1800 caracteres codificados, contando asunto y cuerpo), no por cantidad fija.
- `mailto:` con "Para" = email del propio cliente y los negocios en **CCO**.
- Indicador "Tanda 1 de 5 · 38 casillas" + botón "Siguiente tanda".
- Botón "Copiar todas las casillas": separadas por coma, sin límite (escape para Gmail web y gestores que manejan mal `mailto`).
- Panel editable de asunto y cuerpo, con plantilla por defecto que incluye línea de baja ("Si no querés recibir más mails, respondé BAJA"). El envío comercial masivo no solicitado tiene implicancias legales; la responsabilidad de uso ya figura en los Términos de Servicio.
- Módulo puro `src/lib/mailBatches.js`: `buildMailBatches(emails, { subject, body, to })`, con tests de que ninguna tanda supere el límite y no se pierda ni repita ninguna casilla.

## Fuera de alcance

- Envío de mails desde el servidor (Resend). El pedido es abrir el gestor del cliente.
- Cola/worker en segundo plano para lotes de cientos de negocios. Se reevalúa si el conteo en el panel resulta lento en la práctica.
- Cambios al modelo de créditos o a los planes.
- Filtrar o seleccionar filas antes de armar el mail (se manda a todas las que tengan email).
