# Servidor MCP de marianoaliandri.com.ar — diseño

Fecha: 2026-10-26 · Estado: borrador para aprobar

## 1. Intención

Mariano quiere tener sus herramientas a mano desde cualquier sesión de Claude (claude.ai,
Desktop/Cowork y la app del celular, incluso dictando por voz) y que Claude **ejecute tareas**:
consultar leads, lanzar búsquedas y auditorías, publicar informes en redes y contactar negocios
por mail. La meta secundaria es que el contacto pueda correr **programado y sin supervisión**
(una rutina de Claude en la nube llamando a estas mismas tools), por eso los frenos tienen que
vivir en el servidor y no depender de que Claude "se porte bien".

El servidor MCP es una **interfaz más** sobre la lógica que ya existe (como la UI del admin),
no un sistema paralelo.

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Endpoint MCP remoto (Streamable HTTP) en el mismo deploy de Vercel, conectable como
  "conector personalizado" en Claude.
- OAuth 2.1 propio, con login de Google vía Firebase Auth; solo el email `ADMIN_EMAIL` entra.
- Primer paquete de 15 tools (sección 6) que cubren el flujo buscar → auditar → publicar →
  contactar, más consultas.
- Cero lógica duplicada: lo que hoy vive dentro de un componente o de una ruta se extrae a
  `src/lib/` y lo usan la ruta/pantalla existente y el MCP.
- Rate limiting, tope de Places propio para el MCP, frenos de envío de mail, nada de secretos
  en las respuestas.

**No-objetivos (por ahora)**
- WhatsApp automático. Queda para cuando Meta verifique el negocio (depende del monotributo):
  se sumará una tool `send_whatsapp` con la Cloud API. Hoy solo se devuelve un link `wa.me`.
- Envío automático de DMs de Instagram (regla existente: riesgo de baneo). El MCP prepara el DM
  y marca estados; el envío es manual.
- Segunda tanda de tools: presupuestos, bot de noticias, auditoría automática, reportes de zona
  (Routes + Places, cuestan plata), Mood Fit, ATS.
- Multiusuario o vender el MCP a clientes.
- Cerrar las demás rutas admin sin auth de la deuda técnica, fuera de las tres de 9.4.

**Anti-objetivos (sería un fracaso aunque "funcione")**
- Que alguien que no sea Mariano pueda usarlo, aunque tenga la URL.
- Que una rutina descontrolada queme el cupo de Places o mande decenas de mails.
- Escribirle dos veces al mismo negocio, o a alguien que pidió la baja o rebotó.
- Que una respuesta de tool filtre API keys, tokens, URLs de webhooks de Make o datos de otros
  usuarios.
- Romper la UI existente al extraer lógica.

## 3. Restricciones del entorno (verificadas en el repo)

- **Next.js 16.1.6**, App Router, React 19, `zod` 4.3.6 ya instalado. (CLAUDE.md dice "Next 15":
  corregir al cerrar.)
- **Vercel Pro** (confirmado por Mariano): `maxDuration` hasta 800 s con Fluid compute.
  CLAUDE.md todavía dice "Hobby: 60 s" en varios lugares → corregir al cerrar.
- **`trailingSlash: true`** en `next.config.mjs`: un POST sin barra final recibe 308 y los
  clientes no lo reenvían. **Todas las URLs que se publiquen (endpoint MCP, metadata, token,
  register, authorize) llevan barra final.** La URL que se carga en Claude es
  `https://marianoaliandri.com.ar/api/mcp/mcp/`, y el `resource` de la metadata debe ser
  exactamente esa cadena.
- Paquetes: `mcp-handler@^2` (2.3.0) + `@modelcontextprotocol/server@^2` (2.4.0) + `zod@^4`.
  API v2: `createMcpHandler(init, options)`, `server.registerTool(name, { title, description,
  inputSchema: z.object(...) }, handler)`, `withMcpAuth(handler, verifyToken, { required,
  resourceMetadataPath, requiredScopes, resourceUrl })`, `protectedResourceHandler`,
  `ctx.http?.authInfo`.
- Firebase Admin vía `getDb()` (`src/lib/firebase-admin.js`). En Firestore, una colección sin
  regla se deniega al cliente: las colecciones nuevas son solo para el Admin SDK y **no
  necesitan reglas nuevas**.
- Tests con Vitest junto al código (`*.test.js`), Firestore fake en memoria (`createFakeDb` en
  `src/app/api/lead-finder-pro/run/route.test.js`) como patrón para lo transaccional.

## 4. Autenticación (decidido: opción A — OAuth propio sobre Firebase Auth)

Requisitos del cliente OAuth de Claude (doc oficial
https://claude.com/docs/connectors/building/authentication):
- Sin token, el endpoint MCP responde **401** con
  `WWW-Authenticate: Bearer resource_metadata="<url>"`. Claude ignora el header en un 200.
- Protected Resource Metadata (RFC 9728): `resource` = URL exacta del MCP;
  `authorization_servers` con **un solo** issuer (Claude usa solo el primero).
- Authorization Server Metadata (RFC 8414) en `/.well-known/oauth-authorization-server`.
- **DCR** (RFC 7591, JSON) en un `registration_endpoint`. Claude cae a DCR si no se anuncia
  CIMD. **Decisión del diseño: solo DCR, sin CIMD** (más simple; CIMD obliga a pedir un
  documento a una URL arbitraria).
- PKCE **S256** obligatorio; anunciar `code_challenge_methods_supported: ["S256"]`.
- Cliente público: `token_endpoint_auth_methods_supported: ["none"]`.
- `/token` acepta `application/x-www-form-urlencoded`; `grant_type` `authorization_code` y
  `refresh_token`; **rota el refresh token** en cada uso; si es inválido responde
  `invalid_grant`.
- Responder rápido: discovery/register/token < 10 s, refresh < 30 s.
- Redirect URIs aceptadas (allowlist, rechazar cualquier otra al registrar y al autorizar):
  - `https://claude.ai/api/mcp/auth_callback` y `https://claude.com/api/mcp/auth_callback`
  - loopback `http://localhost:<cualquier puerto>/<path>` y `http://127.0.0.1:<puerto>/<path>`
    (Claude Code y el MCP Inspector).
- Anunciar `offline_access` en `scopes_supported` del AS para que Claude pida refresh token.

**Flujo**
1. Claude llama al MCP sin token → 401 con puntero a la metadata.
2. Claude lee la metadata y se registra por DCR (`POST /api/mcp-oauth/register/`): se guarda el
   cliente (`client_id` aleatorio, `redirect_uris` validadas contra la allowlist).
3. Claude abre en el navegador `/mcp/authorize?client_id&redirect_uri&state&code_challenge&...`
   (**página** del sitio, client component).
4. La página muestra "Claude quiere acceder a tus herramientas de marianoaliandri.com.ar", el
   **hostname del redirect** (lo exige la spec) y un aviso extra si es loopback. Usa el login de
   Google de Firebase que ya existe y, al aprobar, manda `idToken` + parámetros a
   `POST /api/mcp-oauth/authorize/`.
5. El server verifica el idToken (`getUserFromRequest`), exige **email verificado ==
   `ADMIN_EMAIL`** (misma regla que `requireAdmin()`), revalida cliente/redirect/PKCE y emite un
   código de un solo uso (TTL 60 s, guardado hasheado con el `code_challenge` y el `uid`).
   Devuelve la URL de redirect con `code` y `state`; la página redirige.
6. Claude canjea en `POST /api/mcp-oauth/token/` → access token (TTL 1 h) + refresh token
   (TTL 30 días, rotativo).
7. Cada llamada al MCP: `withMcpAuth` → `verifyToken` busca el hash del token en Firestore,
   chequea vencimiento y que el `email` guardado siga siendo `ADMIN_EMAIL` (si se cambia la env
   var, todo token viejo queda inválido).

**Tokens**: opacos, 32 bytes aleatorios (`crypto.randomBytes`), en Firestore **solo el hash
SHA-256**. Colecciones: `mcp_oauth_clients`, `mcp_oauth_codes`, `mcp_oauth_tokens` (refresh
con `familyId`: si se reusa un refresh ya rotado, se revoca la familia entera). Revocar acceso =
borrar docs de `mcp_oauth_tokens` (desde la consola de Firebase; una pantalla de admin queda
para después).

**Interruptor**: env `MCP_ENABLED` — si no es `"true"`, el endpoint MCP y los de OAuth responden
503. Falla cerrado.

**Protección de los endpoints OAuth**: DCR es público por diseño; tope de registros por día
(ej. 20) y de intentos de token por minuto, con el mismo rate limiter de la sección 5. Validar
largos y tipos de todos los campos.

## 5. Seguridad y límites

- **Solo Mariano**: el único que obtiene tokens es quien pasa el login de Google con
  `ADMIN_EMAIL` verificado. Las tools actúan como la cuenta admin (uid de ese login).
- **Rate limiting** (Firestore, ventana fija, transacción, helper en `src/lib/mcp/rateLimit.js`):
  - por token: 60 llamadas a tools por minuto, 1.500 por día;
  - endpoints OAuth: register 20/día, token 30/min.
  - Al pasarse: error MCP legible ("límite por minuto, reintentá en N s"), sin detalle interno.
- **Cupo de Google Places** (lo que cuesta plata):
  - Tope diario propio del MCP: `MCP_PLACES_DAILY_CAP` (default 150 llamadas reales a Google
    por día, contando getDetails + searchText + searchNearby). Se cuenta en
    `leadfinder_usage/{día}` con campos nuevos `mcpGetPlace`, `mcpSearch` (los contadores
    globales existentes se siguen sumando como hoy, en `bumpUsage`).
  - Tope mensual: antes de cada búsqueda se mira el acumulado del mes contra el cupo gratis de
    `src/data/placesFreeTier.js`; si supera el 90 %, `search_leads` se niega y lo dice.
  - Los cache hits (`places_seo_cache`, historial propio) no cuentan, igual que hoy.
  - `cantidad` máxima por búsqueda: 30 (se examinan hasta 3 × cantidad, como el motor actual).
- **Mail automático** (lo que puede quemar el dominio): ver 6.4.
- **Nada de secretos**: las tools devuelven objetos armados a mano (allowlist de campos), nunca
  el doc crudo de Firestore ni respuestas crudas de terceros. Errores: mensaje corto genérico +
  `console.error` del detalle en el server. Nunca devolver `process.env.*`, URLs de webhooks de
  Make, `resendId` crudo no hace falta, tokens, ni datos de `entitlements` de otros usuarios.
  Un test recorre las respuestas de todas las tools y falla si aparece algún valor de env var
  conocido.
- **Registro**: cada llamada a una tool se guarda en `mcp_tool_calls` (tool, argumentos
  resumidos sin datos personales, ok/error, duración, fecha) para auditar qué hizo Claude.

## 6. Tools (primer paquete)

Convenciones: nombres `snake_case`; descripciones en español escritas para un LLM (qué hace,
cuándo usarla, qué cuesta, qué devuelve); `inputSchema` con `z.object` y `.describe()` en
cada campo; listas con **paginación por cursor** (`cursor` opaco + `limit`, default 20, máx 50)
y respuesta `{ items, nextCursor }`. Las tools que tienen efectos afuera (`send_*`,
`publish_*`, `create_*`) lo dicen en la descripción y llevan `annotations`
(`readOnlyHint`/`destructiveHint`/`openWorldHint`) para que Claude pida confirmación cuando
corresponda.

Cada tool devuelve `content` de texto (resumen legible) + `structuredContent` (datos).

### 6.1 Leads

- **`search_leads`** — lanza una búsqueda de negocios (rubros de Google Maps y/o términos
  libres, una o varias localidades, `cantidad` 1–30, `radioKm`, `perfil` dev/empresa +
  `producto`). **Asíncrona**: crea un job en `mcp_lead_jobs`, responde enseguida con `jobId` y
  sigue en segundo plano con `after()` de `next/server` (Vercel `waitUntil`, dentro del
  `maxDuration` de la ruta: 800 s). Corre el motor existente `searchLeads()`
  (`src/lib/leadSearch.js`) con `call` = la lógica de `/api/lead-finder-pro/run` extraída (ver
  7), como la cuenta admin (ilimitada). El job guarda progreso (eventos resumidos), totales y
  leads; al terminar guarda la búsqueda en `leadfinder_searches/{uid}/items` igual que la UI
  (`origen: 'admin'`, campo nuevo `via: 'mcp'`), así aparece en el historial del admin.
  Respeta los topes de Places (sección 5): si se agota a mitad de camino, termina con lo que
  tiene y lo informa. Devuelve también el cruce con "Rubros buscados" (demanda) como hace la UI.
- **`get_lead_search`** — estado y resultados de un job (`running`/`done`/`error`, totales,
  avisos) o de una búsqueda guardada del historial; leads paginados. Campos por lead: nombre,
  ciudad, rubro, web, seoScore, email, teléfono/WhatsApp, instagram, canal, demanda,
  oportunidad. Claude la llama cada unos segundos mientras el job corre (la descripción se lo
  indica).
- **`list_lead_searches`** — historial de búsquedas del admin (paginado): fecha, ciudades,
  rubros, totales, origen/via.
- **`rank_rubros_by_demand`** — rubros más buscados en una localidad (autocompletado de Google,
  gratis, no usa Places): reusa `analyzeAll` + `rankAnalyzed` de `src/lib/rubroDemand.js`.
  Devuelve top N (default 20) con frases de ejemplo. No consume cuota de Analítica (es el admin).

### 6.2 Auditorías

- **`list_audits`** / **`get_audit`** — informes de `auditorias` (paginado; detalle con filas).
  El detalle incluye emails porque es el admin, pero no teléfono ni dirección más allá de lo que
  ya guarda el doc.
- **`create_audit_report`** — arma y guarda el informe público a partir de una búsqueda
  (`searchId` o `jobId`): usa `filasParaInforme()` y el borrador de título/descripción/stats
  que hoy está dentro de `PublishReport` (se extrae, ver 7). Mínimo 3 sitios con web y puntaje
  (`MIN_SITIOS_INFORME`). Permite sobreescribir `title`/`summary`. Guarda con
  `saveAuditoria()` y llama `revalidatePath` como `/api/auditorias`. Devuelve id y URL pública.
- **`publish_audit_social`** — anuncia un informe en LinkedIn/Instagram/Facebook vía Make con
  `buildAuditPublishPayload()` (contrato intocable). Antes verifica la captura de Microlink
  con `imageIsReachable()` (se extrae de `src/lib/autoAuditRun.js`); si no es imagen, no llama a
  Make y lo informa. Llama al webhook directo desde una función compartida extraída de
  `/api/publish-social` (no por HTTP). Guarda en el doc de la auditoría `publicadoEn` +
  `publicadoVia: 'mcp'`; si ya se publicó, se niega salvo `force: true`.

### 6.3 Prospectos de Instagram

- **`list_ig_prospects`** — de `ig_prospectos`, filtrable por `estado`, paginado, con el DM
  sugerido y el link `ig.me/m/<handle>`.
- **`update_ig_prospect`** — cambia `estado`, `dm` o `notas` (mismas validaciones que el PATCH
  actual; lógica extraída a `src/lib/igProspectosStore.js`). No manda nada a Instagram.

### 6.4 Contacto por mail

- **`draft_business_email`** — dado un negocio (de una auditoría o de un job/búsqueda, por id de
  fila/placeId), genera el texto con Gemini (fallback plantilla) y la captura, **sin enviar**.
  Devuelve asunto, cuerpo y `draftId` (borrador guardado en `mcp_email_drafts`, TTL 7 días).
  Reusa la lógica de `send-biz-email` extraída a `src/lib/bizEmail.js`.
- **`send_business_email`** — envía un borrador (`draftId`, con texto opcionalmente editado) o
  genera y envía en un paso (para rutinas). **Decisión de Mariano: en las rutinas se manda el
  texto de Gemini sin revisión humana.** Como red mínima (decisión del diseño), antes de enviar
  se valida el texto: largo razonable (300–2.500 caracteres), que nombre al negocio, que no tenga
  marcadores sin completar (`[`, `{{`, `XXX`, "Nombre del negocio") ni links que no sean del
  sitio; si falla, se usa la plantilla fija (`buildTemplateEmail`) en vez de no mandar. Frenos **en el servidor**, en este orden:
  1. dirección con formato válido y no en la lista de bloqueo `email_bajas` (bajas pedidas) ni
     con estado `bounced`/`complained` en `sent_emails`;
  2. **no volver a escribirle a un negocio antes de 30 días** (decisión de Mariano): se mira
     `sent_emails` (cualquier origen, también los envíos manuales del admin) por **dirección de
     email** y por **dominio de la web** (normalizado, sin `www.`), porque los envíos viejos no
     guardan placeId (decisión del diseño). Los envíos nuevos guardan además `placeId` y
     `dominio`. Pasados 30 días del último envío a ese negocio se le puede volver a escribir;
     `MCP_EMAIL_RECONTACT_DAYS` (default 30);
  3. tope diario de envíos del MCP: `MCP_EMAIL_DAILY_CAP` (default 15), contado en transacción;
  4. recién ahí, envío por Resend con el mismo HTML de hoy + **pie con link de baja**.
  Registra en `sent_emails` con `origen: 'mcp'`. Si un freno lo frena, devuelve el motivo
  (`ya_contactado`, `baja`, `rebotado`, `tope_diario`) sin error duro, para que una rutina siga
  con el próximo.
- **Link de baja**: `https://marianoaliandri.com.ar/baja/?t=<token>` donde el token es un
  HMAC-SHA256 del email con `EMAIL_UNSUBSCRIBE_SECRET`. Página pública simple que confirma y
  escribe en `email_bajas` (vía una ruta `POST /api/email-baja/`). La baja bloquea **la
  dirección y el dominio de la web** del negocio al que se le escribió (sale del registro en
  `sent_emails`), así no vuelve a entrar con otra casilla (decisión del diseño). Una baja es
  permanente: no le aplica la regla de los 30 días. El link se agrega a **todos**
  los mails a negocios (también los que se mandan a mano desde el admin), y la lista de bloqueo
  se respeta en ambos caminos; los frenos 2 y 3 solo aplican al MCP (en el admin Mariano aprieta
  el botón a conciencia).
- **`list_sent_emails`** — envíos recientes (paginado), con estado de Resend
  (sent/delivered/opened/bounced), origen y negocio.

### 6.5 Consultas

- **`get_places_usage`** — consumo del mes de Places (reusa `buildUsageReport` de
  `src/lib/placesUsage.js`), cupo restante, proyección, y además el consumo del MCP hoy vs su
  tope.
- **`get_site_stats`** — GA4 + Search Console de un período (7/28/90 días): lo que hoy arma
  `/api/dashboard-stats` en `fetchGSC`/`fetchGA4` (se extraen a `src/lib/siteStats.js`).

## 7. Extracciones para no duplicar lógica

| Hoy vive en | Se mueve a | Lo usan |
|---|---|---|
| Cuerpo del `POST` de `/api/lead-finder-pro/run` (cobro, historial, acciones) | `src/lib/leadFinderPro.js` → `runLeadFinderProAction(user, body)` que devuelve `{ status, body }` | la ruta (envuelve en `Response`) y el MCP |
| Título/descripción/stats del informe en `PublishReport` (`LeadFinderAdminExtras.jsx`) | `src/lib/auditReportDraft.js` → `buildAuditReportDraft(leads, { ciudades, rubros, radioKm })` | el componente y `create_audit_report` |
| `imageIsReachable` en `src/lib/autoAuditRun.js` | `src/lib/imageCheck.js` | auto-audit y `publish_audit_social` |
| Fetch al webhook en `/api/publish-social` | `src/lib/makeSocial.js` → `postToMakeSocial(payload)` | la ruta y el MCP |
| Prompt/plantilla/HTML/envío de `/api/auditorias/send-biz-email` | `src/lib/bizEmail.js` (`buildBizEmailDraft`, `renderBizEmailHtml`, `sendBizEmail`) + `src/lib/emailGuards.js` | la ruta y el MCP |
| GET/PATCH de `/api/ig-prospectos` | `src/lib/igProspectosStore.js` | la ruta y el MCP |
| `fetchGSC`/`fetchGA4` de `/api/dashboard-stats` | `src/lib/siteStats.js` | la ruta y el MCP |
| GET de `/api/lead-finder-pro/searches` y POST (guardar) | `src/lib/leadSearchesStore.js` | la ruta y el MCP |

Regla: las extracciones son movimientos de código **sin cambiar comportamiento** (salvo el link
de baja y la lista de bloqueo en `send-biz-email`). Los tests existentes tienen que seguir
pasando sin tocarlos.

## 8. Estructura de archivos nuevos

```
src/app/api/mcp/[transport]/route.js        # createMcpHandler + withMcpAuth, maxDuration 800
src/app/.well-known/oauth-protected-resource/route.js
src/app/.well-known/oauth-authorization-server/route.js
src/app/api/mcp-oauth/register/route.js
src/app/api/mcp-oauth/authorize/route.js    # POST desde la página, emite el código
src/app/api/mcp-oauth/token/route.js
src/app/mcp/authorize/page.jsx              # consentimiento + login Google (client)
src/app/baja/page.jsx                       # baja de mails
src/app/api/email-baja/route.js
src/lib/mcp/oauth.js                        # clientes, códigos, tokens, PKCE, allowlist
src/lib/mcp/rateLimit.js
src/lib/mcp/placesBudget.js
src/lib/mcp/tools/*.js                      # un archivo por grupo: leads, audits, ig, email, stats
src/lib/mcp/register.js                     # registra todas las tools en el server
```

Las tools viven en `src/lib/mcp/tools/` para poder testearlas sin levantar la ruta.

## 9. Lo que queda a criterio del implementador (y decisiones mías marcadas)

1. **Mi decisión**: DCR sin CIMD; access 1 h / refresh 30 días rotativo; topes por defecto
   (60/min, 1.500/día, Places 150/día, mails 15/día) configurables por env.
2. **Mi decisión**: `search_leads` asíncrono con `after()` + polling, en vez de tandas con
   "seguí desde acá" (el generador no es reanudable sin repetir búsquedas pagas). **A verificar
   primero**: que Fluid compute esté activo en el proyecto (sin Fluid el techo es 300 s); si no lo
   está, bajar el máximo de `cantidad` a 15.
2b. **Verificado**: `mcp-handler@2.3.0` (npm pack, `index.d.ts`) exporta `createMcpHandler`,
   `withMcpAuth(handler, verifyToken, { required, resourceMetadataPath, requiredScopes,
   resourceUrl })`, `protectedResourceHandler`; peer `@modelcontextprotocol/server@^2` (2.4.0).
3. **A verificar en la implementación**: que `/.well-known/*` funcione con `trailingSlash: true`
   (GET con 308 probablemente lo siga Claude, pero el `resource_metadata` del 401 debe apuntar a
   la URL exacta que responde 200). Si el 308 molesta en el AS metadata, servirla en las dos
   variantes con un rewrite.
4. **Dentro del alcance (decisión de Mariano)**: `/api/auditorias/send-biz-email`,
   `/api/publish-social` y `POST/PATCH/DELETE /api/auditorias` hoy **no tienen auth**: cualquiera
   puede mandar mails con el Resend del sitio, saltearse los frenos o publicar en las redes. Se
   cierran con `requireAdmin()` (idToken + `ADMIN_EMAIL`), y cada pantalla del admin que las llama
   pasa a mandar `Authorization: Bearer <idToken>` (buscar todos los `fetch` a esas rutas en
   `src/`). `GET /api/auditorias` queda público (lo usan páginas públicas y la demo). Ojo con
   llamadores que no son el navegador (scripts de GitHub Actions): no deben usar estas rutas por
   HTTP; si alguno lo hace, se pasa a `src/lib` directo.
5. Nombres de campos nuevos en Firestore, forma exacta de los cursores, y cuánto detalle va en
   `mcp_tool_calls`.

## 10. Verificación

- `npm test` y `npm run build` en verde.
- Tests nuevos: PKCE y canje de código (incluido reuso de código y de refresh rotado),
  allowlist de redirects, `verifyToken` con email distinto, rate limiter, presupuesto de Places,
  los 3 frenos de mail + baja, y el test de "sin secretos en respuestas".
- `npx @modelcontextprotocol/inspector` contra `npm run dev` (redirect loopback): flujo OAuth
  completo y **cada tool** llamada al menos una vez (las que gastan o mandan: con `cantidad`
  chica y un mail a una casilla propia de Mariano).
- Sin token: `POST /api/mcp/mcp/` → 401 con `WWW-Authenticate` correcto; token inválido → 401;
  token de otro email → rechazado; `MCP_ENABLED` apagado → 503.
- Sin deploy ni push.

## 11. Entregables finales

- Sección "Servidor MCP" en CLAUDE.md (arquitectura, cómo sumar una tool, frenos).
- Lista de env vars nuevas para Vercel: `MCP_ENABLED`, `MCP_PLACES_DAILY_CAP`,
  `MCP_EMAIL_DAILY_CAP`, `EMAIL_UNSUBSCRIBE_SECRET` (y confirmar que `ADMIN_EMAIL` existe).
- Pasos para conectar el conector en Claude.
- Corregir en CLAUDE.md: Next 16, Vercel Pro.
