# Lead Finder unificado — diseño

Fecha: 2026-10-12 · Estado: aprobado en conversación, pendiente de revisión escrita

## Problema

Hay tres buscadores de negocios que comparten el servidor (`runLeadFinderAction` en
`src/app/api/lead-finder/route.js`) pero cada uno tiene su propio recorrido de búsqueda:

| | Lead Finder Pro (clientes) | Admin | Auditoría automática |
|---|---|---|---|
| Archivo | `components/leadfinderpro/CustomerLeadFinderPanel.jsx` | `components/audit/LeadFinderPanel.jsx` | `lib/autoAuditBatch.js` |
| Búsqueda | solo términos | tipos de Places + términos | tipo o término |
| Tope | cantidad (= créditos) | "máx. auditorías" que cuenta solo los con web | 30 examinados / 15 con web |
| Auditoría | `auditPlace` (caché 30 d) | `getDetails` + `checkSite` (sin caché) | `auditPlace` |
| Perfil empresa | sí | no | no |

Consecuencias: el admin gasta Google de más (sin caché, sin tope real), el admin no puede usar
el perfil empresa, el cliente no puede buscar por tipo de Places, y cada arreglo se hace tres veces.

## Decisiones (tomadas con el usuario)

1. **Unificar motor y pantalla** (opción A): una sola lógica de búsqueda y un solo componente
   de pantalla con variante cliente/admin. La automática usa el mismo motor.
2. **Los clientes también buscan por tipo de Places.**
3. **El admin usa `/api/lead-finder-pro/run`** con su acceso ilimitado (la cuenta `ADMIN_EMAIL`
   tiene `leadfinder_entitlements.unlimited: true, status: active`, verificado 2026-10-12). Así
   hereda historial, conteo de productos y caché por cliente. Sus búsquedas van al mismo
   historial, marcadas con `origen: 'admin'`.
4. **Regla de lead** (pedido del usuario): tiene web → auditar; no tiene web → sirve solo si
   tiene email o WhatsApp; si no, se descarta.
5. **Se cobra solo por lead entregado**; un descartado no gasta crédito.

## Regla de lead — `src/lib/leadRule.js`

Función pura `clasificarLead(audit, { pais })` → `{ esLead, canal, whatsapp }`. La usan el
servidor (para cobrar) y el motor (para filtrar).

| Situación | Resultado |
|---|---|
| Tiene web propia (no red social) | lead, `canal: 'web'` |
| Sin web, celular argentino (`+54 9 …` en formato internacional, o `15` tras el código de área en formato nacional) | lead, `canal: 'whatsapp'`, `whatsapp` = número E.164 sin `+` para `wa.me` |
| Sin web, país distinto de Argentina, con cualquier teléfono | lead, `canal: 'whatsapp'` (el formato no distingue celular de fijo) |
| Sin web y sin teléfono válido | descartado |

Notas:
- Google Places no devuelve emails; el email sale de leer el sitio. Sin web no hay email, así
  que en la práctica "sin web" depende solo del WhatsApp.
- Si `websiteUri` es una red social (Instagram/Facebook, `isSocialUrl`), se guarda como
  `socialUrl` y se muestra como contacto, pero **no** alcanza para ser lead.
- Un fijo con WhatsApp Business queda afuera (limitación aceptada).
- País: se deduce del prefijo del teléfono internacional que da Google (`+54` = Argentina), no de la
  zona buscada: es más confiable y se decide en el servidor. Entradas viejas del caché sin formato
  internacional usan el formato nacional argentino (`0<área> 15-…`).

## Servidor

### `src/app/api/lead-finder/route.js`
- `DETAIL_FIELDS` agrega `internationalPhoneNumber` (mismo SKU de contacto que
  `nationalPhoneNumber`, sin costo extra).
- `auditPlace` devuelve y cachea `internationalPhone` y `socialUrl`. Entradas viejas de
  `places_seo_cache` sin esos campos: la regla usa el formato nacional.

### `src/app/api/lead-finder-pro/run/route.js` — cobro por lead
1. Si el negocio ya está en el historial del cliente (`leadfinder_client_audits/{uid}/audits/{placeId}`,
   lead o descartado) → se devuelve gratis, sin Google. Igual que hoy, ahora también para descartados.
2. Si no: transacción de **verificación** (tiene saldo ≥ 1, o ilimitado, o cupo de suscripción),
   sin descontar. Sin saldo → 402 `NO_PLAN`.
3. Llama a `auditPlace`, aplica `clasificarLead`.
4. Si es lead → transacción que **descuenta** 1 (misma prioridad que hoy: ilimitado → suscripción
   → créditos). Si en ese instante ya no hay saldo (carrera entre pestañas) → 402 y no se entrega.
5. Si es descartado → transacción que incrementa `descartesHoy: { fecha, n }` en
   `leadfinder_entitlements/{uid}`. Tope **100 por día UTC por usuario** (~US$2 de Google en
   el peor caso: 100 × US$0,02). Superado → 429 `DISCARD_LIMIT` con mensaje "límite diario alcanzado".
   Usuarios ilimitados (admin) sin tope.
6. Guarda en el historial: `esLead`, `canal`, `whatsapp`, `socialUrl` además de lo actual.
7. La respuesta incluye `esLead` y `canal`.

### `src/app/api/lead-finder-pro/searches/route.js`
POST acepta y guarda `origen` (`'admin'` solo si el usuario es `ADMIN_EMAIL`; si no, se fuerza
`'cliente'`), `tipos`, `perfil` y `stats` (encontrados, examinados, leads, descartados).

## Motor — `src/lib/leadSearch.js`

Generador asíncrono sin React ni HTTP:

```js
for await (const ev of searchLeads(params, { call, sleep, isCancelled })) { ... }
```

`params`:
- `zonas`: `[{ ciudad, pais }]`
- `terminos`: string[] → `searchText` con `"${termino}, ${ciudad}"`
- `tipos`: string[] (ids de Places) → `searchNearby`
- `radioKm`
- `cantidad`: leads a entregar
- `maxExaminados`: por defecto `3 × cantidad`
- `perfil`: `'dev' | 'empresa'`, `producto` (string, requerido si empresa)
- `soloConWeb`: si `true`, solo entrega leads con `canal: 'web'`

`deps.call(action, params)` es la única conexión al servidor: las pantallas usan
`fetch('/api/lead-finder-pro/run')`; la automática, `runLeadFinderAction` (leyendo el JSON del
`Response`).

Recorrido: por cada zona → geocode; por cada término y cada tipo → hasta 3 páginas (1,5 s entre
páginas); dedup por `place.id` entre zonas y búsquedas; por cada negocio nuevo → `auditPlace` →
`lead` o `descartado`; en perfil empresa con web → `countProducts` en paralelo (se espera al final).
Corta al llegar a `cantidad` leads, a `maxExaminados`, o si `isCancelled()`.

Eventos: `zona`, `busqueda`, `negocio`, `lead`, `descartado`, `productos`, `aviso`
(falló una zona o búsqueda, sigue), `fin` con `{ encontrados, examinados, leads, conWeb, descartados }`.

Errores que cortan todo (se propagan): 402 `NO_PLAN`, `QUOTA_EXCEEDED`, 429 `DISCARD_LIMIT`.
Los leads ya emitidos quedan.

## Pantalla — `src/components/leadfinder/`

| Pieza | Responsabilidad |
|---|---|
| `useLeadSearch.js` | Corre el motor, estado (fase, progreso, resultados, totales, error), cancelar |
| `LeadFinderForm.jsx` | Perfil dev/empresa (+ producto), localidades, términos, tipos de Places agrupados por categoría (plegado por defecto), radio, cantidad |
| `LeadResultsTable.jsx` | Resumen ("12 leads · 8 con web · 4 por WhatsApp · 19 descartados"), tabla, CSV |
| `LeadFinder.jsx` | Compone; props `variant: 'cliente' \| 'admin'`, `lang` |
| `admin/LeadFinderAdminExtras.jsx` | Filtros (rubro, con email, SEO bajo, texto), log en vivo plegable, publicar informe + redes |

- Tabla: negocio · ciudad · rubro · Web (link + score SEO, o "sin web") · Contacto (email, botón
  WhatsApp `wa.me/<numero>`, teléfono, red social) · Productos (solo perfil empresa, con
  "Reintentar" si falla).
- CSV suma columnas WhatsApp y Red social.
- Términos o tipos: al menos uno. Se eliminan del admin la API key propia y los toggles
  "buscar contacto" / "revisar sitios".
- `src/data/rubros.js` agrega `labelEn` a cada rubro para la versión EN.
- Publicar informe (admin): incluye solo los leads con `canal: 'web'`; deshabilitado con motivo
  si son menos de 3 (misma regla que la automática). Usa `/api/auditorias` y
  `/api/publish-social` como hoy.
- Admin muestra "acceso ilimitado" en lugar del saldo.
- Rutas sin cambio: `/lead-finder-pro/buscar`, `/en/lead-finder-pro/buscar` y la pestaña
  Lead Finder de `AdminPage.jsx`; solo cambia el componente que cargan.

## Auditoría automática

`autoAuditBatch.js` llama a `searchLeads` con `zonas: [{ ciudad, pais: 'Argentina' }]`,
`terminos` o `tipos` según `rubro.kind`, `radioKm: 15`, `soloConWeb: true`, `cantidad: maxSites`
(15), `maxExaminados: maxCandidates` (30). Mapea los eventos `lead` al shape de resultado actual
y devuelve `{ results, status, examined, found }`. `autoAuditRun.js` (mínimo 3 sitios + reintento
con otra combinación, hecho el 2026-10-12) no cambia. El catálogo `RUBROS_SEMILLA` sigue siendo
propio de la automática.

### Cantidad configurable desde el admin

Hoy los topes están fijos en `scripts/auto-audit.mjs` (15 sitios con web, 30 examinados).
Pasan a `auditoria_auto/config`:

- `cantidad`: sitios con web por corrida. Default 15, rango 3 a 30. Se edita en la tarjeta
  (`AutoAuditCard.jsx`) con un campo "Cantidad de sitios por corrida".
- `maxExaminados` = `2 × cantidad` (con 15 da los 30 de hoy). No es editable aparte.
- Junto al campo, una estimación del consumo: `maxExaminados × 4 corridas × 4,3 semanas`
  consultas de detalle por mes contra el cupo gratis de 1.000 (con 15 → ~520/mes; con 30 →
  ~1.030/mes, en rojo porque supera el cupo). Las 4 corridas semanales salen del cron de
  cron-job.org (lun/mié/vie/sáb).
- El mínimo para publicar (3, `MIN_SITES_TO_PUBLISH`) no cambia.
- `scripts/auto-audit.mjs` deja de pasar `maxSites`/`maxCandidates` fijos; `runAutoAudit` los
  toma de la config. "Correr ahora" usa `min(cantidad, 8)` por el límite de 60 s de Vercel.
- Validación server-side en la ruta que guarda la config (`/api/auditoria-auto`): entero entre
  3 y 30; fuera de rango → 400.
- El texto de la tarjeta "martes y viernes" se corrige a los días reales del cron.

## Textos

El cobro cambia de "cada resultado = 1 crédito" a "pagás solo por los leads entregados; los
negocios sin web ni WhatsApp no se cobran". Actualizar en ES y EN: subtítulo del buscador, hint
de cantidad (`src/data/i18n/leadFinderPro.js`), landing de Lead Finder Pro y términos
(`LeadFinderProTermsPage*.jsx`). Los textos nuevos se le muestran al usuario antes de publicar.

## Errores

- Falla una zona o búsqueda: aviso y sigue.
- Sin créditos / cupo de Google / tope de descartes: corta, conserva los leads, cartel con el motivo.
- Falla el conteo de productos: "Reintentar" en la fila.
- Falla el guardado del historial: no rompe la búsqueda.

## Pruebas

- `src/lib/leadRule.test.js`: web, `+54 9`, `15`, fijo, otro país, solo red social, nada.
- `src/lib/leadSearch.test.js` (call falso): cantidad = leads, `maxExaminados`, `soloConWeb`,
  dedup entre zonas y búsquedas, paginado, cancelar, errores que cortan vs avisos.
- `src/app/api/lead-finder-pro/run/route.test.js`: cobra solo leads, descartado no descuenta,
  tope de 100 descartes/día, ilimitado sin tope, historial devuelve gratis también descartados,
  carrera sin saldo al descontar.
- `src/lib/autoAuditBatch.test.js` adaptado; `autoAuditRun.test.js` suma: toma `cantidad` de la config (default 15), `maxExaminados = 2 × cantidad`, "Correr ahora" usa `min(cantidad, 8)`; la ruta de config rechaza valores fuera de 3–30.
- Navegador: búsqueda real chica (Neuquén, cantidad 3) como admin y como cliente, ES y EN,
  perfiles dev y empresa.

## Orden de entrega

Rama aparte, un commit por paso, el sitio funciona después de cada uno:

1. Regla de lead + `internationalPhoneNumber` + cobro por lead en `run` + `searches` con origen.
2. Motor `leadSearch.js`.
3. Automática al motor (incluye el arreglo de Formosa del 2026-10-12) + cantidad configurable desde la tarjeta.
4. Pantalla única: primero `/lead-finder-pro/buscar` (ES/EN), después el admin.
5. Textos de cobro (ES/EN, buscador, landing, términos), revisados por el usuario.
6. Borrar `CustomerLeadFinderPanel.jsx` y `audit/LeadFinderPanel.jsx`; actualizar CLAUDE.md.

## Fuera de alcance

- Leer emails de Instagram/Facebook (las redes bloquean la lectura automática).
- Verificar si un número tiene WhatsApp de verdad (no hay API gratuita).
- Cambiar el mapa de leads (`LeadMapPanel`) o la pestaña "Emails".
