# Lead Finder Pro para empresas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Sumar al panel de Lead Finder Pro un perfil "empresa" con conteo de productos por sitio, columnas de email y última actualización, y mail masivo en CCO por tandas.

**Architecture:** Módulos puros testeables (`sitemapUtils`, `productCounter`, `mailBatches`) + acción server `countProducts` (gratis, gateada por auditoría previa del cliente) + cambios de UI en `CustomerLeadFinderPanel`. El mail es 100% cliente.

**Tech Stack:** Next.js 15 route handlers, Vitest, Firestore Admin, React 19, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-24-lead-finder-pro-empresas-design.md`

Nota de ejecución: el usuario pidió modo automático; el plan se ejecuta sin pausa de revisión. El código vive directo en los archivos (no duplicado acá); cada tarea lista archivos, interfaces y casos de test.

## Global Constraints

- `countProducts` NO descuenta crédito y NO acepta URL del cliente: solo `placeId` + `keyword`; `siteUrl` sale de `leadfinder_client_audits/{uid}/audits/{placeId}`.
- Caché del conteo en colección `places_product_count` (clave `placeId__keywordSlug`, TTL 7 días), nunca en `places_seo_cache`.
- Presupuesto total del conteo ~20 s; resultados parciales no se cachean.
- Tandas de mail por largo real de URL (~1800 caracteres codificados), no por cantidad fija.
- Textos nuevos en ES y EN en `src/data/i18n/leadFinderPro.js`.
- `seoScore` no cambia. No tocar `trailingSlash` ni rutas de webhooks.

## Review Focus

1. Keyword con tildes/mayúsculas/plural ("Celulares", "CELULAR", "celulár") debe matchear igual → test en `productCounter`.
2. Un solo email más largo que el límite de URL (cuerpo enorme) → igual sale en su propia tanda, sin perder casillas → test en `mailBatches`.
3. Redirect a host privado (`127.0.0.1`, `169.254.x`, `localhost`) durante el conteo → se rechaza → test en `productCounter`.
4. Sitio caído / timeout / catálogo deshabilitado → devuelve `count: null`, sin tirar excepción → test en `productCounter`.
5. Emails duplicados en distinta capitalización o inválidos ("foo@", vacío) → deduplicados/filtrados → test en `mailBatches`.

---

### Task 1: `sitemapUtils` + `productCounter`

**Files:**
- Create: `src/lib/sitemapUtils.js`, `src/lib/productCounter.js`
- Test: `src/lib/productCounter.test.js`

**Interfaces:**
- Produces: `sitemapUtils`: `extractLocs(xml): string[]`, `extractLatestLastmod(xml): string|null` (ISO), `isSitemapIndex(xml): boolean`.
- Produces: `productCounter`: `normalizeKeyword(str): string`, `keywordMatcher(keyword): (text)=>boolean`, `isSafeUrl(url): boolean`, `countProducts(siteUrl, keyword, { fetchImpl?, budgetMs? }): Promise<{ count: number|null, confidence: 'catalogo'|'estimado'|null, platform: 'shopify'|'woocommerce'|'tiendanube'|null, partial: boolean }>`.

Comportamiento: `safeFetch` con `redirect:'manual'`, máx 3 saltos, valida cada salto con `isSafeUrl`. Detecta plataforma por HTML de la home. Shopify → `/products.json?limit=250&page=N` (hasta 4 páginas), Woo → `/wp-json/wc/store/v1/products?search=kw&per_page=1` + header `x-wp-total`, Tiendanube → sitemap filtrando `/productos/`. Fallback a sitemap (`/sitemap.xml`, `/sitemap_index.xml`, hasta 5 hijos) → `estimado`. Sin nada → `count: null`.

- [ ] Test primero (fetch falso por plataforma, fallback sitemap, tildes/plurales, host privado, sitio caído, budget agotado → `partial`)
- [ ] Ver fallar → implementar → ver pasar
- [ ] Commit

### Task 2: `mailBatches`

**Files:**
- Create: `src/lib/mailBatches.js`
- Test: `src/lib/mailBatches.test.js`

**Interfaces:**
- Produces: `buildMailBatches(emails: string[], { subject, body, to }): Array<{ emails: string[], url: string }>`, `cleanEmails(emails): string[]`.

- [ ] Test primero (nada supera 1800 chars salvo tanda de 1; no se pierde ni repite casilla; dedupe case-insensitive; inválidos fuera; vacío → `[]`; CCO en `bcc=`, `to` respetado)
- [ ] Implementar → pasar → commit

### Task 3: `lastUpdated` en `auditSite`

**Files:**
- Modify: `src/app/api/lead-finder/route.js` (`auditSite`, caso `auditPlace`)

**Interfaces:**
- Consumes: `extractLatestLastmod` de Task 1.
- Produces: `auditSite()` y `auditPlace` devuelven `lastUpdated: string|null`. En cache hit sin `lastUpdated` y con `siteUrl`, se recalcula solo `lastUpdated` (gratis) y se actualiza el caché.

- [ ] Reemplazar el chequeo `resourceOk` de sitemap por un GET que devuelva el texto; `lastUpdated = latestLastmod(xml) || header Last-Modified`
- [ ] Backfill en cache hit
- [ ] `npm test` (los tests existentes siguen verdes) → commit

### Task 4: acción `countProducts`

**Files:**
- Modify: `src/app/api/lead-finder-pro/run/route.js`
- Test: `src/app/api/lead-finder-pro/run/route.test.js` (casos nuevos; mockear `@/lib/productCounter`)

**Interfaces:**
- Consumes: `countProducts` de Task 1.
- Produces: `POST {action:'countProducts', placeId, keyword}` → `{ok:true, applicable:boolean, count, confidence, platform, partial}`. 400 si falta `placeId` o `keyword` (2–60 chars). 401 sin login.

- [ ] Tests: 401; 400 sin keyword; `applicable:false` si el cliente no auditó ese place; `applicable:false` sin `siteUrl`; devuelve conteo y NO toca `leadfinder_entitlements`; segunda llamada sale de caché sin invocar el counter; resultado `partial` no se cachea
- [ ] Implementar (`export const maxDuration = 30`) → pasar → commit

### Task 5: i18n

**Files:**
- Modify: `src/data/i18n/leadFinderPro.js` (bloques `es.panel` y `en.panel`)

Claves nuevas: `perfilLabel`, `perfilDev`, `perfilEmpresa`, `productoLabel`, `productoHint`, `productoPlaceholder`, `colEmail`, `colUpdated`, `colProducts`, `countingProducts`, `productsCatalog`, `productsEstimated`, `productsPartial`, `retryProducts`, `csvExtra` (4 columnas), y `mail: { title, subject, body, defaultSubject, defaultBody, writeBtn(n), batchLabel(i,total,n), nextBatch, copyAll, copied, hint }`.

- [ ] Agregar en ES y EN → commit

### Task 6: `MailBatchPanel`

**Files:**
- Create: `src/components/leadfinderpro/MailBatchPanel.jsx`

**Interfaces:**
- Consumes: `buildMailBatches`, `cleanEmails` (Task 2), strings `t.mail` (Task 5).
- Props: `{ emails: string[], userEmail: string, t: object }`.

- [ ] Asunto/cuerpo editables, "Escribir tanda i de N" (`<a href=mailto>`), "Siguiente tanda", "Copiar todas las casillas" (con fallback si falla el clipboard) → commit

### Task 7: cambios en `CustomerLeadFinderPanel`

**Files:**
- Modify: `src/components/leadfinderpro/CustomerLeadFinderPanel.jsx`

- [ ] Estado `perfil` (`'dev'|'empresa'`) + `producto`; selector arriba de la config; "Producto a rastrear" obligatorio en empresa (deshabilita "Buscar")
- [ ] `auditPlace` guarda `email` y `lastUpdated`; con perfil empresa y sitio, dispara `countProductsFor(neg)` sin bloquear el loop; promesas pendientes se esperan antes de `saveSearch`
- [ ] Columnas Email, Actualizado (color si >18 meses) y Productos (solo empresa, con etiqueta catálogo/estimado, reintento por fila)
- [ ] CSV con 4 columnas nuevas; render de `MailBatchPanel` con los emails de las filas
- [ ] commit

### Task 8: docs y verificación

- [ ] `CLAUDE.md`: sección corta en Funcionalidades + colección `places_product_count`
- [ ] `npm test` y `npm run build` verdes; probar `countProducts` contra 2-3 sitios reales (Shopify, Woo, Tiendanube) y ajustar detección si hace falta
- [ ] commit

## Self-review

- Cobertura de spec: backend (T1, T3, T4), panel (T5, T7), mail (T2, T6), docs/tests (T8). Sin huecos.
- Consistencia de nombres: `countProducts`, `buildMailBatches`, `cleanEmails`, `extractLatestLastmod`, `lastUpdated` iguales en todas las tareas.
