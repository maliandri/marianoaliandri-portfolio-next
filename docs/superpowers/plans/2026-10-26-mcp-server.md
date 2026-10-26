# Servidor MCP — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer Lead Finder, auditorías, publicación, contacto por mail, prospectos de IG y métricas como un servidor MCP remoto con OAuth propio (login Google/Firebase, solo `ADMIN_EMAIL`), conectable como conector personalizado en Claude.

**Architecture:** Ruta `src/app/api/mcp/[transport]/route.js` con `mcp-handler` v2 envuelta en `withMcpAuth`; un authorization server OAuth 2.1 mínimo (DCR + PKCE S256 + refresh rotativo) en rutas propias + una página de consentimiento que usa el login de Firebase existente. Las tools viven en `src/lib/mcp/tools/` y llaman a funciones de `src/lib/` que se extraen de rutas/componentes actuales, para que la UI y el MCP compartan la lógica.

**Tech Stack:** Next.js 16.1.6 (App Router), `mcp-handler@^2` + `@modelcontextprotocol/server@^2`, `zod` 4, Firebase Admin (Firestore), Resend, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-mcp-server-design.md` (leer entero antes de empezar).

## Global Constraints

- Trabajar en la rama `feat/mcp-server` (crearla desde `main`). Commits sí; **nada de push ni deploy**.
- `trailingSlash: true`: toda URL publicada (endpoint MCP, metadata, register, authorize, token, baja) termina en `/`. URL del conector: `https://marianoaliandri.com.ar/api/mcp/mcp/`.
- Base URL desde `MCP_BASE_URL` (default `https://marianoaliandri.com.ar`); en dev `http://localhost:3000`.
- `MCP_ENABLED !== "true"` → endpoint MCP y endpoints OAuth responden 503. Falla cerrado.
- Solo entra un idToken con `email_verified` y email == `ADMIN_EMAIL` (case-insensitive), igual que `requireAdmin()`.
- Tokens opacos de 32 bytes; en Firestore solo `sha256` hex. Access TTL 3600 s, refresh 30 días rotativo, código 60 s de un solo uso.
- Redirects permitidos: `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`, `http://localhost:<puerto>/<path>`, `http://127.0.0.1:<puerto>/<path>`.
- Topes (env, con default): `MCP_RATE_PER_MIN`=60, `MCP_RATE_PER_DAY`=1500, `MCP_PLACES_DAILY_CAP`=150, `MCP_EMAIL_DAILY_CAP`=15, `MCP_EMAIL_RECONTACT_DAYS`=30; register 20/día; token 30/min; corte mensual de Places al 90 % del cupo gratis (`PLACES_LIMITS` de `src/data/placesFreeTier.js`).
- `search_leads`: `cantidad` 1–30 (15 si Fluid compute no está activo, ver Task 0).
- Nombres de tools en `snake_case`; descripciones en español para un LLM; `inputSchema: z.object({...})` con `.describe()` por campo; listas con `{ items, nextCursor }`, `limit` default 20, máx 50.
- Las tools devuelven campos elegidos a mano (nunca docs crudos ni respuestas crudas de terceros). Errores al cliente: mensaje corto; detalle solo en `console.error`.
- Contrato de Make intocable: usar `buildAuditPublishPayload()` tal cual.
- Extracciones = mover código sin cambiar comportamiento. Los tests existentes pasan sin editarlos (salvo moverles imports si el símbolo cambió de archivo).
- Comentarios y textos en español rioplatense, mismo estilo que el resto del repo.

## Review Focus

1. Refresh token ya rotado que se reusa (Claude reintenta tras un timeout) → se revoca toda la familia y responde `invalid_grant`; un refresh nuevo válido sigue andando solo si no hubo reuso. Test en Task 7.
2. Dos corridas de rutina en paralelo mandando al mismo negocio / pasando el tope diario → la reserva de envío es transaccional; solo una pasa. Test en Task 5.
3. Job de `search_leads` que se queda sin cupo de Places a mitad de camino → termina `done` con `aviso` y lo ya encontrado, no `error`, y no sigue llamando a Google. Test en Task 11.
4. Request al MCP con token válido pero `ADMIN_EMAIL` cambiado después de emitirlo → 401. Test en Task 7.
5. POST a `/api/mcp/mcp` **sin** barra final → el 308 no debe romper el flujo de Claude: la metadata siempre publica la URL con barra. Verificación manual en Task 15.

---

### Task 0: Rama, dependencias y chequeo de Fluid compute

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1:** `git checkout -b feat/mcp-server`
- [ ] **Step 2:** `npm install mcp-handler@^2 @modelcontextprotocol/server@^2` (zod ya está en 4.3.6, cumple `^4.2.0`).
- [ ] **Step 3:** Verificar Fluid compute: `vercel project inspect marianoaliandri-portfolio-next` (o `vercel api` / dashboard). Anotar el resultado en el resumen final. Si no está activo: en Task 11 el máximo de `cantidad` es 15 y `maxDuration` de la ruta MCP 300.
- [ ] **Step 4:** `npm test` → todo verde (línea base).
- [ ] **Step 5:** Commit `chore(mcp): agrega mcp-handler y SDK MCP v2`.

### Task 1: Fake Firestore compartido para tests

**Files:**
- Create: `src/test/fakeDb.js`
- Modify: `src/app/api/lead-finder-pro/run/route.test.js` (importar en vez de definir)

**Interfaces:**
- Produces: `createFakeDb(initialDocs?: Record<string, object>) -> { db, docs, writes }`. `db` soporta: `collection(name).doc(id?)` (sin id = id aleatorio), `.add(data)`, `.where(field, op, value)` con `==`, `>=`, `<=`, `>`, `<`, `in`, `.orderBy(field, dir)`, `.limit(n)`, `.startAfter(value)`, `.get()` → `{ docs:[{id, data(), exists}], empty, size }`; doc: `get/set(merge)/update/delete/collection`; `runTransaction(fn)` con `tx.get/set/update/delete` (ejecución serial); `FieldValue.increment` y `serverTimestamp` resueltos como hoy (`resolveFieldValues`). `__name__` en `where` compara contra el id del doc.

- [ ] **Step 1:** Test `src/test/fakeDb.test.js`: `add` + `where('estado','==','pendiente').orderBy('updatedAt','desc').limit(2)` devuelve los 2 más nuevos; `startAfter` pagina; `where('__name__','>=','2026-10-01')` filtra por id; transacción con `increment` suma.
- [ ] **Step 2:** `npx vitest run src/test/fakeDb.test.js` → FAIL (módulo inexistente).
- [ ] **Step 3:** Mover `createFakeDb`/`resolveFieldValues` de `route.test.js` a `src/test/fakeDb.js` y extenderlo según Interfaces.
- [ ] **Step 4:** `npm test` → PASS (incluido el test viejo del run route).
- [ ] **Step 5:** Commit `test: fake de Firestore compartido con queries`.

### Task 2: Extraer la lógica de Lead Finder Pro y del historial

**Files:**
- Create: `src/lib/leadFinderPro.js`, `src/lib/leadDemand.js`, `src/lib/leadSearchesStore.js`, `src/lib/leadDemand.test.js`, `src/lib/leadSearchesStore.test.js`
- Modify: `src/app/api/lead-finder-pro/run/route.js`, `src/app/api/lead-finder-pro/searches/route.js`, `src/components/leadfinder/LeadFinder.jsx`

**Interfaces:**
- Produces:
  - `runLeadFinderProAction(user: {uid,email}, body: object) -> Promise<{ status: number, body: object }>` — todo lo que hoy hace el `POST` después de autenticar (acciones gratis, `countProducts`, `rubroDemand`, `auditPlace` con cobro). La ruta queda: auth → `Response.json(body, { status })`.
  - `makeLeadFinderCall(user) -> (action: string, params: object) => Promise<object>` — mismo contrato que el `call` de `LeadFinder.jsx`: resuelve con `body` si `body.ok`, si no lanza `Error` con `code` (`401→NO_AUTH`, `402→NO_PLAN`, si no `body.code`).
  - `leadDemand.js`: `tipoParams(ids, lang)`, `labelToIdFor(ids, lang)`, `demandaDe(lead, demanda, labelToId)` — movidas tal cual desde `LeadFinder.jsx`.
  - `leadSearchesStore.js`: `listSearches(db, uid, { limit = 20, cursor = null }) -> { items, nextCursor }` (mismos campos resumidos que el GET actual, orden `createdAt desc`, cursor = `createdAt` ISO del último); `getSearch(db, uid, id) -> object | null`; `saveSearch(db, uid, fields, { isAdmin }) -> Promise<string>` (misma sanitización que el POST; acepta además `via: 'mcp'` opcional).

- [ ] **Step 1:** Tests: `leadDemand.test.js` (lead con `demanda` propia la devuelve; rubro de Maps busca por id; término libre por texto); `leadSearchesStore.test.js` (`listSearches` con 25 docs → 20 + `nextCursor`, segunda página 5 y `nextCursor: null`; `saveSearch` con `origen:'admin'` y `isAdmin:false` guarda `'cliente'`; `via:'mcp'` se guarda).
- [ ] **Step 2:** `npx vitest run src/lib/leadDemand.test.js src/lib/leadSearchesStore.test.js` → FAIL.
- [ ] **Step 3:** Implementar y re-cablear las dos rutas y el componente.
- [ ] **Step 4:** `npm test` → PASS (`run/route.test.js` y `searches/route.test.js` sin cambios de asserts).
- [ ] **Step 5:** Commit `refactor(lead-finder): lógica de run e historial en src/lib`.

### Task 3: Extraer borrador de informe, chequeo de imagen y envío a Make

**Files:**
- Create: `src/lib/auditReportDraft.js` (+ `.test.js`), `src/lib/imageCheck.js`, `src/lib/makeSocial.js`
- Modify: `src/components/leadfinder/admin/LeadFinderAdminExtras.jsx`, `src/lib/autoAuditRun.js`, `src/app/api/publish-social/route.js`

**Interfaces:**
- Produces:
  - `MIN_SITIOS_INFORME = 3` (se mueve acá; el componente lo re-exporta para no romper imports).
  - `buildAuditReportDraft(leads, { ciudades: string[], rubros: string[], radioKm: number, now?: Date }) -> { filas, title, summary, stats: { total, withEmail, lowSeoCount, avgSeoScore }, config: { ciudades, pais: 'Argentina', radioKm, tiposLabels } }` — mismo texto que hoy arma `abrir()` en `PublishReport` (usa `filasParaInforme` y `rubrosTexto`).
  - `imageIsReachable(url) -> Promise<{ ok: boolean, detail: string }>` (misma lógica; `autoAuditRun.js` pasa a usar `detail` del retorno).
  - `postToMakeSocial(payload) -> Promise<void>` — lanza `Error('Make.com webhook failed: <status>')` si `!ok`. URL: `MAKE_SOCIAL_WEBHOOK_URL || <la de hoy>`. Nunca devolver la URL.
- [ ] **Step 1:** Test `auditReportDraft.test.js`: 4 leads (3 con web+score, scores 30/45/80, 2 con email) en `['Neuquén']`, rubros `['Durlock']` → `stats` `{ total: 3, withEmail: 2, lowSeoCount: 2, avgSeoScore: 52 }`, `title` empieza con `Auditoría SEO de páginas web de Durlock (`, `summary` contiene `El 67% (2)`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar y re-cablear.
- [ ] **Step 4:** `npm test` → PASS (incluye `autoAuditRun.test.js`).
- [ ] **Step 5:** Commit `refactor: borrador de informe, chequeo de imagen y webhook de Make en src/lib`.

### Task 4: Cerrar las tres rutas abiertas

**Files:**
- Create: `src/utils/adminFetch.js`, `src/app/api/publish-social/route.test.js`
- Modify: `src/app/api/auditorias/send-biz-email/route.js`, `src/app/api/publish-social/route.js`, `src/app/api/auditorias/route.js` (POST/PATCH/DELETE; GET queda público), y cada caller: `src/components/admin/AuditoriasManager.jsx`, `SendAuditEmailButton.jsx`, `SentEmailsManager.jsx`, `SocialPublisher.jsx`, `ZoneAnalysis.jsx`, `LabsPublisher.jsx`, `src/utils/makeService.js`, `src/components/leadfinder/admin/LeadFinderAdminExtras.jsx`

**Interfaces:**
- Produces: `adminFetch(url: string, init?: RequestInit) -> Promise<Response>` (cliente): agrega `Authorization: Bearer <idToken>` de `firebaseAuth.getCurrentUser()`; sin usuario, hace el fetch igual (la ruta responde 401).
- [ ] **Step 1:** Tests (mock de `@/lib/adminAuth`): `POST /api/publish-social` sin admin → 401 y no llama a Make; con admin → llama `postToMakeSocial`. Igual para `POST /api/auditorias` (401 sin admin) y `GET /api/auditorias` sin auth → 200.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Agregar `requireAdmin()` al inicio de cada handler cerrado; reemplazar en los callers `fetch(` por `adminFetch(` solo para esas rutas/métodos (verificar con `grep -rn "send-biz-email\|/api/publish-social\|/api/auditorias" src scripts`). Confirmar que nada en `scripts/` llama a estas rutas por HTTP.
- [ ] **Step 4:** `npm test` y `npm run build` → PASS.
- [ ] **Step 5:** Commit `fix(security): send-biz-email, publish-social y escrituras de auditorias exigen admin`.

### Task 5: Mail a negocios: extracción, frenos y baja

**Files:**
- Create: `src/lib/bizEmail.js` (+ `.test.js`), `src/lib/emailGuards.js` (+ `.test.js`), `src/app/baja/page.jsx`, `src/app/api/email-baja/route.js`
- Modify: `src/app/api/auditorias/send-biz-email/route.js`

**Interfaces:**
- Produces (`bizEmail.js`, movido desde la ruta):
  - `buildTemplateEmail(neg)`; `problemasSeo(neg) -> string[]`; `nivelSeo(score)`.
  - `buildBizEmailDraft(neg, { providedText?, providedShot? }) -> Promise<{ subject, emailText, source: 'edited'|'gemini'|'template', screenshotUrl, extraServices }>` — si `source==='gemini'` y `!validateGeneratedEmail(text, neg.nombre)`, usa la plantilla y `source='template'`.
  - `validateGeneratedEmail(text, nombre) -> boolean`: 300–2500 caracteres, contiene `nombre` (case-insensitive), sin `[`, `{{`, `XXX`, `Nombre del negocio`, y todo `https?://` que aparezca es de `marianoaliandri.com.ar` o `wa.me`.
  - `renderBizEmailHtml({ nombre, siteUrl, seoScore, emailText, screenshotUrl, extraServices, unsubscribeUrl }) -> string` (HTML actual + línea de pie "Si no querés recibir más mails, [date de baja](unsubscribeUrl)").
  - `sendViaResend({ to, subject, html }) -> Promise<{ resendId }>`.
- Produces (`emailGuards.js`):
  - `normalizeDomain(url) -> string | null` (host sin `www.`, minúsculas).
  - `unsubscribeUrl(email) -> string` = `${MCP_BASE_URL}/baja/?e=<email>&t=<hmac>`; `verifyUnsubscribe(email, t) -> boolean` (HMAC-SHA256 con `EMAIL_UNSUBSCRIBE_SECRET`, comparación `timingSafeEqual`).
  - `checkBlocked(db, { email, dominio }) -> Promise<null | 'baja' | 'rebotado'>` (`email_bajas` por email o dominio; `sent_emails` con `status in ['bounced','complained']` para ese email).
  - `lastContactAt(db, { email, dominio }) -> Promise<Date | null>`.
  - `reserveDailySend(db, { cap, now }) -> Promise<boolean>` (transacción sobre `mcp_email_counter/{YYYY-MM-DD}`).
  - `addBaja(db, email) -> Promise<void>` (guarda email + dominios de sus `sent_emails`).
- [ ] **Step 1:** Tests: `validateGeneratedEmail` (texto sin el nombre → false; con `[Nombre]` → false; link a otro dominio → false; texto bueno → true); `checkBlocked` (baja por dominio con otra casilla → `'baja'`; bounced → `'rebotado'`); `lastContactAt` encuentra envío viejo sin `placeId` por dominio; `reserveDailySend` con cap 2 y 3 llamadas en paralelo → exactamente 2 `true`; `verifyUnsubscribe` rechaza token alterado.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar; la ruta `send-biz-email` usa `buildBizEmailDraft`/`renderBizEmailHtml`/`sendViaResend`, respeta `checkBlocked` (responde 409 con el motivo) y guarda `dominio` en `sent_emails`. Página `/baja/` (server component simple que muestra un botón "Confirmar baja" → `POST /api/email-baja/` con `{e,t}` → `verifyUnsubscribe` → `addBaja`). Sin dato extra en la respuesta.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(email): link de baja, lista de bloqueo y lógica de mail en src/lib`.

### Task 6: Extraer prospectos de IG y stats del sitio

**Files:**
- Create: `src/lib/igProspectosStore.js` (+ `.test.js`), `src/lib/siteStats.js`
- Modify: `src/app/api/ig-prospectos/route.js`, `src/app/api/dashboard-stats/route.js`

**Interfaces:**
- Produces: `listProspectos(db, { estado?, limit = 20, cursor? }) -> { items, nextCursor }` (orden `updatedAt desc`; `serialize` actual); `updateProspecto(db, handle, { estado?, dm?, notas? }) -> Promise<{ item } | { error, status }>` (mismas validaciones del PATCH); `upsertProspecto(db, lead, { regenerar })` (el POST). `siteStats.js`: `fetchGSC()` y `fetchGA4()` movidas tal cual (si hoy no reciben período, agregar `{ days = 28 }` opcional sin cambiar el default).
- [ ] **Step 1:** Test: `updateProspecto` con estado inválido → `{ status: 400 }`; `'contactado'` setea `contactadoAt`; `listProspectos({ estado:'pendiente' })` filtra.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar y re-cablear. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `refactor: prospectos de IG y stats del sitio en src/lib`.

### Task 7: Núcleo OAuth

**Files:**
- Create: `src/lib/mcp/config.js`, `src/lib/mcp/oauth.js`, `src/lib/mcp/oauth.test.js`

**Interfaces:**
- Produces (`config.js`): `baseUrl()`, `MCP_URL = baseUrl()+'/api/mcp/mcp/'`, `RESOURCE_METADATA_URL = baseUrl()+'/.well-known/oauth-protected-resource/'`, `ISSUER = baseUrl()`, `mcpEnabled()`, `isAdminEmail(email)`, `envInt(name, def)`.
- Produces (`oauth.js`), todas con `db` inyectado y `now` opcional:
  - `isAllowedRedirect(uri) -> boolean`
  - `verifyPkceS256(verifier, challenge) -> boolean`
  - `registerClient(db, body) -> { status, body }` (RFC 7591: valida `redirect_uris` no vacío y todas permitidas; devuelve `client_id`, `client_id_issued_at`, `redirect_uris`, `token_endpoint_auth_method: 'none'`, `grant_types`, `response_types`).
  - `validateAuthorizeRequest(db, params) -> { ok: true, client } | { ok: false, error }` (cliente existe, redirect registrado, `response_type=code`, `code_challenge_method=S256`).
  - `createAuthCode(db, { clientId, redirectUri, codeChallenge, scope, resource, uid, email }) -> Promise<string>`
  - `exchangeCode(db, { code, clientId, redirectUri, codeVerifier }) -> { status, body }` (borra el código al usarlo; código vencido/reusado/PKCE malo → 400 `invalid_grant`).
  - `refreshTokens(db, { refreshToken, clientId }) -> { status, body }` (rota; reuso de un refresh ya rotado → revoca familia + `invalid_grant`).
  - `verifyAccessToken(db, token) -> Promise<{ uid, email, clientId, expiresAt } | null>` (vencido o email ≠ `ADMIN_EMAIL` → null).
  - Respuesta de tokens: `{ access_token, token_type: 'Bearer', expires_in: 3600, refresh_token, scope }`.
- [ ] **Step 1:** Tests: allowlist (claude.ai ok, `http://localhost:6274/oauth/callback` ok, `http://127.0.0.1:5000/cb` ok, `https://evil.com/cb` no, `http://localhost.evil.com/` no); PKCE con el vector del RFC 7636 (`dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` → `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`); flujo completo register → code → exchange → verify; reuso de código → `invalid_grant`; refresh rota y el viejo reusado revoca el nuevo; token con `ADMIN_EMAIL` cambiado → null; en Firestore no aparece el token en claro.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar (colecciones `mcp_oauth_clients`, `mcp_oauth_codes`, `mcp_oauth_tokens`). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(mcp): núcleo OAuth (DCR, PKCE, tokens rotativos)`.

### Task 8: Rate limiter y presupuesto de Places

**Files:**
- Create: `src/lib/mcp/rateLimit.js`, `src/lib/mcp/placesBudget.js` (+ tests)

**Interfaces:**
- Produces: `hitRateLimit(db, key, { limit, windowS, now? }) -> Promise<{ ok: boolean, retryAfterS: number }>` (ventana fija, doc `mcp_rate/{key}__{inicioVentana}`, transacción). `placesBudget(db, { now? }) -> Promise<{ ok: boolean, reason?: 'diario'|'mensual', usedToday, dailyCap, monthPct }>`; `bumpMcpPlaces(db, n = 1, now?)` (campo `mcpPlaces` en `leadfinder_usage/{día}`). El mensual suma `getPlaceRequests+searchTextRequests+searchNearbyRequests` del mes contra `PLACES_LIMITS`.
- [ ] **Step 1:** Tests: 61.ª llamada en el mismo minuto → `ok:false` con `retryAfterS > 0`; minuto siguiente → ok; `usedToday` 150 → `reason:'diario'`; mes al 91 % → `reason:'mensual'`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(mcp): rate limiting y tope de Places`.

### Task 9: Endpoints OAuth y página de consentimiento

**Files:**
- Create: `src/app/.well-known/oauth-protected-resource/route.js`, `src/app/.well-known/oauth-authorization-server/route.js`, `src/app/api/mcp-oauth/register/route.js`, `src/app/api/mcp-oauth/authorize/route.js`, `src/app/api/mcp-oauth/token/route.js`, `src/app/mcp/authorize/page.jsx`, `src/app/mcp/authorize/AuthorizeClient.jsx`, `src/app/api/mcp-oauth/token/route.test.js`

**Interfaces:**
- Consumes: Task 7 y 8.
- AS metadata: `issuer`, `authorization_endpoint: baseUrl()+'/mcp/authorize/'`, `token_endpoint: …'/api/mcp-oauth/token/'`, `registration_endpoint: …'/api/mcp-oauth/register/'`, `response_types_supported:['code']`, `grant_types_supported:['authorization_code','refresh_token']`, `code_challenge_methods_supported:['S256']`, `token_endpoint_auth_methods_supported:['none']`, `scopes_supported:['mcp','offline_access']`. Protected resource: `protectedResourceHandler` de `mcp-handler` con `resource: MCP_URL`, `authorization_servers: [ISSUER]`, `scopes_supported: ['mcp']`. Ambos con CORS (`metadataCorsOptionsRequestHandler`).
- `/token` lee `application/x-www-form-urlencoded`; responde `Cache-Control: no-store`. `/register` lee JSON. `/authorize` (POST JSON `{ idToken, params }`): `getUserFromRequest`-equivalente sobre el idToken + `isAdminEmail` + `validateAuthorizeRequest` → `{ redirectTo }`; no admin → 403 sin código.
- Página: `noindex`; muestra nombre del cliente, **hostname del redirect** y aviso si es loopback; botón "Entrar con Google y permitir" (`useAuthUser().login`), "Cancelar" redirige con `error=access_denied`.
- Todos los endpoints: 503 si `!mcpEnabled()`; `hitRateLimit` (register 20/día por IP, token 30/min por IP).
- [ ] **Step 1:** Tests de la ruta token: form-urlencoded con code válido → 200 + `no-store`; JSON → 400 `invalid_request`; `MCP_ENABLED` vacío → 503.
- [ ] **Step 2–4:** FAIL → implementar → PASS; `npm run build` OK.
- [ ] **Step 5:** Commit `feat(mcp): endpoints OAuth y pantalla de consentimiento`.

### Task 10: Ruta MCP, wrapper de tools y registro de llamadas

**Files:**
- Create: `src/app/api/mcp/[transport]/route.js`, `src/lib/mcp/defineTool.js`, `src/lib/mcp/paginate.js`, `src/lib/mcp/register.js`, `src/lib/mcp/defineTool.test.js`

**Interfaces:**
- Produces:
  - `class ToolError extends Error` (mensaje apto para Claude).
  - `defineTool({ name, title, description, inputSchema, annotations, handler }) -> ToolDef`; `handler(args, ctx: { db, user: { uid, email }, now }) -> Promise<{ summary: string, data: object }>`.
  - `registerTools(server, tools: ToolDef[], { getDb })`: por cada tool, `server.registerTool(name, { title, description, inputSchema, annotations }, wrapped)`; `wrapped` lee `ctx.http?.authInfo.extra.{uid,email}`, aplica `hitRateLimit` (por minuto y por día, key = uid), corre el handler, registra en `mcp_tool_calls` `{ tool, ok, ms, argsResumen, error?, at }` y devuelve `{ content:[{ type:'text', text: summary }], structuredContent: data }`; error que no es `ToolError` → `isError: true` con "Error interno, revisá los logs".
  - `encodeCursor(obj) / decodeCursor(str)` (base64url JSON, cursor inválido → `ToolError`).
  - Ruta: `createMcpHandler((server) => registerTools(server, ALL_TOOLS, { getDb }), { serverInfo: { name: 'marianoaliandri', version: '1.0.0' } })`, envuelto con `withMcpAuth(handler, verify, { required: true, resourceUrl: MCP_URL, resourceMetadataPath: '/.well-known/oauth-protected-resource/' })` donde `verify` usa `verifyAccessToken` y devuelve `{ token, clientId, scopes:['mcp'], expiresAt, extra:{ uid, email } }`; antes, `mcpEnabled()` o 503. `export const maxDuration = 800` (300 sin Fluid). Exportar `GET`, `POST`, `DELETE`.
  - `register.js` exporta `ALL_TOOLS` (vacío en esta task; se llena en 11–14).
- [ ] **Step 1:** Tests de `defineTool`: handler que lanza `ToolError('x')` → `isError` con texto `x`; que lanza `Error('secreto')` → texto genérico sin `secreto`; rate limit superado → `isError` con "reintentá en"; se escribe un doc en `mcp_tool_calls`.
- [ ] **Step 2–4:** FAIL → implementar → PASS; `npm run build` OK.
- [ ] **Step 5:** Commit `feat(mcp): ruta MCP con auth y wrapper de tools`.

### Task 11: Tools de leads

**Files:**
- Create: `src/lib/mcp/leadJobs.js` (+ `.test.js`), `src/lib/mcp/tools/leads.js`
- Modify: `src/lib/mcp/register.js`

**Interfaces:**
- Consumes: `makeLeadFinderCall` (Task 2), `searchLeads` (`src/lib/leadSearch.js`), `leadDemand.js`, `saveSearch`/`listSearches`/`getSearch`, `placesBudget`/`bumpMcpPlaces`, `analyzeAll`/`rankAnalyzed`, `demandaParaLeads`, `oportunidad`.
- Produces: `createLeadJob(db, uid, params) -> Promise<string>`; `runLeadJob(db, user, jobId, params, { call, now, deadlineMs = 700_000 }) -> Promise<void>`: corre el generador, envuelve `call` para chequear `placesBudget` antes de `searchText`/`searchNearby`/`auditPlace` y `bumpMcpPlaces` después de cada llamada real (`auditPlace` con `fromCache`/`fromMyHistory` no cuenta); sin presupuesto → `isCancelled` true + aviso; guarda progreso en `mcp_lead_jobs/{id}` cada 5 eventos; al terminar agrega `demanda`, ordena por `oportunidad`, guarda con `saveSearch(..., { origen:'admin', via:'mcp' }, { isAdmin:true })` y deja `status:'done'`, `searchId`.
- Tools:
  - `search_leads` `{ localidades: string[] (1–5, "Ciudad, Provincia"), rubros?: string[] (ids de RUBROS), terminos?: string[] (≤10), cantidad: int 1–30, radio_km?: int 1–50 = 10, perfil?: 'dev'|'empresa' = 'dev', producto?: string }` → crea job, `after(() => runLeadJob(...))`, devuelve `{ jobId }` y en el summary "Llamá a get_lead_search cada ~15 s". Rechaza si `placesBudget` no da. Annotations `openWorldHint: true`.
  - `get_lead_search` `{ job_id?: string, search_id?: string, cursor?, limit? }` → `{ status, totales, avisos, items: lead[], nextCursor }`; lead = `{ placeId, nombre, ciudad, rubro, web, seoScore, email, telefono, whatsapp, instagram, canal, demanda: { score, ejemplos[0..2] } | null }`.
  - `list_lead_searches` `{ cursor?, limit? }`.
  - `rank_rubros_by_demand` `{ localidad: string, top?: int 1–50 = 20 }` → `[{ rubroId, label, score, ejemplos }]`. `readOnlyHint: true`.
- [ ] **Step 1:** Tests `leadJobs.test.js` con `call` falso: búsqueda de 2 leads termina `done` y guarda en `leadfinder_searches/{uid}/items` con `via:'mcp'`; con `MCP_PLACES_DAILY_CAP=1` termina `done` con aviso de cupo y no llama más a `call` para acciones pagas; `auditPlace` `fromCache` no suma `mcpPlaces`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(mcp): tools de leads`.

### Task 12: Tools de auditorías y redes

**Files:**
- Create: `src/lib/mcp/tools/audits.js` (+ `.test.js`)
- Modify: `src/lib/mcp/register.js`

**Interfaces:**
- Consumes: `buildAuditReportDraft`, `MIN_SITIOS_INFORME`, `saveAuditoria`, `imageIsReachable`, `postToMakeSocial`, `buildAuditPublishPayload`, `auditReportUrl`, `getSearch`, `revalidatePath`.
- Tools:
  - `list_audits` `{ cursor?, limit? }` → `{ id, title, ciudades, rubros, total, avgSeoScore, publishedAt, url, publicadoEnRedes }`. `readOnlyHint`.
  - `get_audit` `{ id, cursor?, limit? }` → cabecera + filas paginadas `{ placeId, nombre, web, seoScore, email, problemas }`.
  - `create_audit_report` `{ search_id?: string, job_id?: string, title?: string, summary?: string }` → menos de 3 filas → `ToolError` con cuántas hay; guarda, `revalidatePath('/auditorias')` y `('/auditorias/[id]','page')`, devuelve `{ id, url }`.
  - `publish_audit_social` `{ id, networks: ('linkedin'|'instagram'|'facebook')[] (≥1), caption?: string, force?: boolean = false, dry_run?: boolean = false }` → `imageIsReachable(auditScreenshotUrl(id))` falla → `ToolError` sin llamar a Make; ya publicado y `!force` → `ToolError`; `dry_run` → devuelve `{ caption, networks, imageOk }` sin llamar a Make; si no, `postToMakeSocial(buildAuditPublishPayload(...))` y marca `publicadoEn`, `publicadoVia:'mcp'`. `destructiveHint: false`, `openWorldHint: true`.
- [ ] **Step 1:** Tests: `create_audit_report` con 2 filas → error que menciona `2`; `publish_audit_social` con imagen caída no llama `postToMakeSocial` (mock); `dry_run` no llama; segunda publicación sin `force` → error.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(mcp): tools de auditorías y redes`.

### Task 13: Tools de mail y de Instagram

**Files:**
- Create: `src/lib/mcp/tools/email.js` (+ `.test.js`), `src/lib/mcp/tools/instagram.js`
- Modify: `src/lib/mcp/register.js`

**Interfaces:**
- Consumes: Task 5 (`bizEmail.js`, `emailGuards.js`), Task 6 (`igProspectosStore.js`), `getSearch`, lectura de `auditorias`.
- Tools:
  - `draft_business_email` `{ audit_id?: string, search_id?: string, place_id: string }` → busca el negocio en la auditoría o búsqueda; sin email → `ToolError`; `buildBizEmailDraft` → guarda en `mcp_email_drafts` (`expiresAt` +7 días) → `{ draftId, to, subject, emailText, source, bloqueo: null|'baja'|'rebotado'|'contactado_hace_N_dias' }`.
  - `send_business_email` `{ draft_id?: string, audit_id?: string, search_id?: string, place_id?: string, email_text?: string, dry_run?: boolean = false }` → frenos en orden (spec 6.4): `checkBlocked` → `lastContactAt` < `MCP_EMAIL_RECONTACT_DAYS` → `reserveDailySend`. Frenado → `{ enviado: false, motivo: 'baja'|'rebotado'|'ya_contactado'|'tope_diario' }` (no `isError`). OK → `sendViaResend` + `sent_emails` con `origen:'mcp'`, `placeId`, `dominio` → `{ enviado: true, to, subject }` (sin `resendId`). `openWorldHint: true`.
  - `list_sent_emails` `{ cursor?, limit?, origen?: 'mcp'|'admin' }` → `{ to, nombre, dominio, status, origen, sentAt }`.
  - `list_ig_prospects` `{ estado?, cursor?, limit? }` → `{ handle, nombre, ciudad, estado, dm, chatUrl: 'https://ig.me/m/<handle>' }`.
  - `update_ig_prospect` `{ handle, estado?, dm?, notas? }` — la descripción aclara que **no** envía nada a Instagram.
- [ ] **Step 1:** Tests: envío a dominio contactado hace 10 días → `ya_contactado` y no llama Resend; hace 31 días → envía; tope 15 alcanzado → `tope_diario`; texto Gemini inválido sale con plantilla (`source:'template'`); `dry_run` no llama Resend ni reserva cupo.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(mcp): tools de mail y prospectos de Instagram`.

### Task 14: Tools de consultas + test de "sin secretos"

**Files:**
- Create: `src/lib/mcp/tools/stats.js`, `src/lib/mcp/noSecrets.test.js`
- Modify: `src/lib/mcp/register.js`

**Interfaces:**
- Consumes: `buildUsageReport`, `PLACES_LIMITS`, `placesBudget`, `fetchGSC`, `fetchGA4`.
- Tools: `get_places_usage` `{ month?: 'YYYY-MM' }` → reporte + `{ mcpHoy, mcpTopeDiario }`; `get_site_stats` `{ days?: 7|28|90 = 28 }` → resumen GA4 + GSC (solo números y rutas/consultas top, nada de credenciales). Ambas `readOnlyHint`.
- [ ] **Step 1:** `noSecrets.test.js`: setear `GEMINI_API_KEY`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`, `MAKE_SOCIAL_WEBHOOK_URL`, `FIREBASE_PRIVATE_KEY`, `EMAIL_UNSUBSCRIBE_SECRET` a valores centinela; correr cada tool de `ALL_TOOLS` (con fakes/mocks de red) en camino feliz y de error; `JSON.stringify` de cada respuesta no contiene ningún centinela ni `hook.us2.make.com`. Además: `ALL_TOOLS` tiene exactamente las 15 tools de la spec y todos los nombres matchean `/^[a-z]+(_[a-z]+)*$/`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(mcp): tools de consultas y test de secretos`.

### Task 15: Verificación de punta a punta y documentación

**Files:**
- Modify: `CLAUDE.md`, `.env.example` (si existe; si no, solo CLAUDE.md)

- [ ] **Step 1:** `npm test` → PASS. `npm run build` → OK.
- [ ] **Step 2:** Sin auth, con `npm run dev` y `MCP_ENABLED=true`, `MCP_BASE_URL=http://localhost:3000`:
  `curl -i -X POST http://localhost:3000/api/mcp/mcp/ -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` → `401` con `WWW-Authenticate: Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/"`. Con `Authorization: Bearer basura` → 401. Con `MCP_ENABLED` vacío → 503. Probar también la URL sin barra final y anotar qué pasa.
- [ ] **Step 3:** `npx @modelcontextprotocol/inspector` → transporte Streamable HTTP, URL `http://localhost:3000/api/mcp/mcp/` → flujo OAuth completo con la cuenta admin. Llamar **cada una de las 15 tools**: `search_leads` con `cantidad: 2`; `publish_audit_social` y `send_business_email` con `dry_run: true`; un envío real solo a una casilla propia de Mariano **pidiéndole OK antes**. Anotar resultado de cada una.
- [ ] **Step 4:** CLAUDE.md: sección "Servidor MCP" (arquitectura, archivos, frenos, colecciones nuevas `mcp_*`/`email_bajas`, cómo sumar una tool: crear `defineTool` en `src/lib/mcp/tools/<grupo>.js` llamando a una función de `src/lib/`, agregarla a `ALL_TOOLS`, test, y el test de secretos la cubre sola), fila en la tabla de colecciones, corregir "Next.js 15" → 16 y las menciones a Vercel Hobby 60 s (ahora Pro).
- [ ] **Step 5:** Commit `docs: servidor MCP en CLAUDE.md`.
- [ ] **Step 6:** Resumen final para Mariano: env vars para Vercel (`MCP_ENABLED=true`, `MCP_BASE_URL` opcional, `EMAIL_UNSUBSCRIBE_SECRET` = 32+ bytes aleatorios, opcionales `MCP_PLACES_DAILY_CAP`, `MCP_EMAIL_DAILY_CAP`, `MCP_EMAIL_RECONTACT_DAYS`, `MCP_RATE_PER_MIN`, `MCP_RATE_PER_DAY`; confirmar `ADMIN_EMAIL`), pasos para conectar en Claude (Configuración → Conectores → Agregar conector personalizado → URL `https://marianoaliandri.com.ar/api/mcp/mcp/` → Conectar → login Google), cómo marcar "permitir siempre" para rutinas, y el resultado del modo voz si se pudo probar.
