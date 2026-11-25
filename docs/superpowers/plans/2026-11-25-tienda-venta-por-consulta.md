# Tienda: venta por consulta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/tienda` en una tienda de servicios sin precios con asistente IA a la derecha, solicitud de presupuesto con Meet aprobado por Mariano (Google Calendar), avisos a Telegram, y una página de presupuesto para el cliente con link de pago.

**Architecture:** La lógica pura vive en `src/lib/` con su test (turnos, aviso, contexto del asistente, token del link); las rutas `src/app/api/...` solo leen/escriben Firestore con `getDb()` y llaman a esa lógica. La UI de la tienda se parte en componentes chicos en `src/components/tienda/`. Los precios nunca salen del servidor salvo para admin.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Framer Motion 12, Firebase Admin (Firestore), Vercel AI SDK (`ai`, `@ai-sdk/google`, `conRespaldo`), Google Calendar API (REST con OAuth del usuario), Telegram Bot API, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-tienda-link-cliente-design.md`

## Global Constraints

- Ningún precio, suma ni "desde" llega a un visitante: ni en el HTML de `/tienda`, ni en `/api/tienda/*` (salvo admin), ni en el asistente, ni en el chat del sitio.
- Copy en español rioplatense, sin jerga técnica sin traducir (Firestore, Vercel, webhooks, SEO técnico).
- Toda URL que reciba POST de un servicio externo termina en `/` (`trailingSlash: true`), ej. `/api/telegram-webhook/`.
- Server components y rutas leen Firestore con `getDb()` (nunca self-fetch).
- IA: `conRespaldo` + `conClaves` de `src/lib/ai/gemini.js` (cadena `gemini-3.8-flash` → `gemini-2.5-flash`).
- Rutas públicas que gastan tokens o escriben: `hitRateLimit(db, key, { limit, windowS })` de `src/lib/mcp/rateLimit.js`.
- Horarios de Meet en `America/Argentina/Buenos_Aires` (UTC−3, sin horario de verano); el servidor corre en UTC.
- Default de turnos: lunes a viernes 09:00–12:00 ART, 30 min, desde +24 h hasta +14 días.
- Aviso a Telegram: uno por visita al llegar a ≥2 servicios o primera pregunta; otro al pedir presupuesto. No se guarda la IP.
- Tests: `npx vitest run <archivo>` (en la PC de escritorio con Node 25: `npx vitest run --pool=vmThreads <archivo>` para tests sin `vi.mock`). CI corre `npm test` + `npm run build`.
- No commitear `.env*`. Commits en `feat/home-ia`, mensajes en español con el trailer de Co-Authored-By de la sesión.

## Review Focus

1. **Turno ocupado entre que el cliente lo ve y Mariano acepta** → al aceptar, re-chequear freebusy; si está ocupado, 409 con "Ese horario ya se ocupó, coordiná otro por WhatsApp" y no crear evento. Test en Task 4.
2. **El cliente pide precio de forma indirecta** ("más o menos cuánto sale", "en dólares?") → el asistente no da números de plata. Contexto sin `priceUSD` + filtro `sinMontos()` sobre la respuesta. Test en Task 5.
3. **Link del cliente con token incorrecto, sin token, o presupuesto sin `pdfToken`** → 404, nunca 500 ni datos. Test en Task 8.
4. **Dos requests simultáneos de la misma visita** cruzan el umbral → un solo aviso de Telegram (transacción sobre `avisado`). Test en Task 6.
5. **Turnos a fin de semana / borde de las 12:00 / cambio de día UTC** (09:00 ART = 12:00 UTC) → solo turnos lunes–viernes 09:00, 09:30 … 11:30 ART. Test en Task 4.

---

### Task 1: Precios solo para admin

**Files:**
- Modify: `src/app/api/tienda/precios/route.js`
- Modify: `src/lib/ai/chatTools.js` (sacar `cotizar` y `cotizacionParaChat`)
- Modify: `src/app/api/chat/route.js` (dejar de pasar dólar/seña; quitar `needsLogin`)
- Modify: `src/components/social/AIChatBot.jsx` (quitar botón "Entrar con Google para ver precios")
- Test: `src/lib/ai/chatTools.test.js`, `src/app/api/tienda/precios/route.test.js`

**Interfaces:**
- Produces: `crearHerramientasChat({ catalogo })` → `{ ver_servicios }` únicamente.

- [ ] **Step 1: Tests que fallan**
  - `chatTools.test.js`: `expect(Object.keys(crearHerramientasChat({ catalogo }))).toEqual(['ver_servicios'])`; el resultado de `ver_servicios.execute({})` serializado no contiene `priceUSD` ni `"price"`.
  - `precios/route.test.js` (mock de `@/lib/adminAuth`): sin admin → `401/403` y el body no tiene `precios`; con admin → `200` y `precios` presente.
- [ ] **Step 2:** Correr ambos tests → FAIL.
- [ ] **Step 3:** `GET` de precios usa `requireAdmin(request)`; `chatTools.js` queda solo con `ver_servicios`, `serviciosPublicos`, `linkTienda`; `/api/chat` y `AIChatBot` sin la rama de login para precios. El prompt del chat dice que los precios se charlan con Mariano y ofrece `/tienda/`.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `feat(tienda): precios solo para admin; el chat ya no cotiza`.

### Task 2: Fichas de servicio, grupos en criollo y contexto general

**Files:**
- Create: `src/data/tiendaFichas.js` — `FICHAS: { [id]: { paraQue, ejemplo, necesitoDeVos, tiempo, faq: [{ q, a }] } }` para **todos** los ids activos de `serviceCatalog.js` + `tienda_catalogo` (incluye `payments_payway`, `payments_nave`, `payments_bind`); `CONTEXTO_GENERAL` (string: cómo trabaja Mariano, Meet, tiempos, hosting/mantenimiento, qué pasa después de pagar, Neuquén / todo el país, que los precios se charlan).
- Create: `src/lib/tiendaGrupos.js` — `GRUPOS: [{ id, label, emoji, categorias: string[] }]` y `grupoDe(categoria) -> id`.
- Modify: `src/lib/tienda.js` — `normalizarItem` conserva `ficha` (objeto o null); `sinPrecios` la conserva.
- Modify: `src/app/api/tienda-catalogo/route.js` — acción `{ accion: 'sembrarFichas' }` (admin): escribe `ficha` en cada doc existente que no la tenga (merge). Contexto general en `site_config/asistente_tienda.texto` (si no existe, semilla).
- Modify: `src/components/admin/BenefitsEditor.jsx` — editar `ficha` (5 campos + FAQ) y el contexto general.
- Test: `src/data/tiendaFichas.test.js`, `src/lib/tiendaGrupos.test.js`

**Interfaces:**
- Produces: `FICHAS`, `CONTEXTO_GENERAL`, `GRUPOS`, `grupoDe(categoria: string): string`, ítems de catálogo con `ficha`.

Grupos (labels exactos): `Vender online` 🛒, `Cobros` 💳, `Que te encuentren en Google` 🔎, `Mostrar tu negocio` 🏪, `Turnos, clientes y gestión` 📋, `IA para tu negocio` 🤖, `Redes y avisos` 📣, `Lo técnico que tu web necesita` 🧰. Toda categoría de `serviceCatalog.js` mapea a uno.

- [ ] **Step 1: Tests que fallan**
  - Cada id activo del catálogo semilla tiene `FICHAS[id]` con los 5 campos no vacíos y `faq.length >= 2`.
  - `JSON.stringify(FICHAS)` no matchea `/US\$|\$\s?\d|USD|dólar/i`.
  - Cada `categoria` de `serviceCatalog.js` → `grupoDe(cat)` está en `GRUPOS.map(g => g.id)`.
  - `sinPrecios([{ id:'a', priceUSD: 5, ficha:{ paraQue:'x' } }])[0]` tiene `ficha` y no `priceUSD`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Redactar fichas (Claude) en criollo, sin montos; implementar grupos y la acción del admin.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `feat(tienda): fichas en criollo por servicio y grupos por objetivo`. Avisar a Mariano para revisar `tiendaFichas.js` y correr "Cargar fichas" en admin → Tienda.

### Task 3: Solicitud de presupuesto (reemplaza el checkout)

**Files:**
- Create: `src/lib/tiendaSolicitud.js`
- Modify: `src/app/api/tienda/route.js` (POST llama a `crearSolicitud`)
- Modify: `src/lib/tiendaCheckout.js` (borrar `checkoutTienda`; queda `cargarCatalogo`, `CATALOGO`, `PRESUPUESTOS`, `loadOverrides`)
- Test: `src/lib/tiendaSolicitud.test.js` (Firestore fake de `createFakeDb`, ver `src/app/api/lead-finder-pro/run/route.test.js`)

**Interfaces:**
- Consumes: `validarCliente` (`src/lib/tienda.js`), `resolverDependencias` (`src/lib/tiendaDeps.js`), `cargarCatalogo`, `turnoValido` (Task 4), `avisarSolicitud` (Task 6).
- Produces: `crearSolicitud(db, body, { user, now = Date.now, turnoValido, avisar }) -> { status, id?, error? }`.
  - `body = { servicios: string[], cliente: { nombre, email, telefono, empresa, notas }, chat?: [{ rol: 'cliente'|'asistente', texto }], meet?: { inicio: ISO } | null, sesionId?: string }`.
  - Doc en `presupuestos`: `clientName, clientEmail, clientPhone, clientCompany, projectDescription, selectedServices (labels), servicioIds, origen: 'tienda', source: 'tienda', status: 'pending', userId, chat (≤20, texto ≤500 c/u), meet: { estado: 'pedido'|'sin_meet', inicio, fin }, sesionId, createdAt`. **Sin** campos de monto.

- [ ] **Step 1: Tests que fallan**: sin `user` → 401; servicios vacíos o inexistentes → 400; con meet cuyo `turnoValido` da false → 409 "Ese horario ya no está libre"; caso feliz → 201, doc sin ninguna clave que matchee `/USD|ARS|price|monto/i`, `meet.estado === 'pedido'`, `fin = inicio + 30 min`; sin meet → `meet.estado === 'sin_meet'`; `avisar` llamado una vez con el id.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(tienda): la tienda crea solicitudes de presupuesto (sin cobro directo)`.

### Task 4: Google Calendar — turnos libres y aceptar Meet

**Files:**
- Create: `src/lib/meetSlots.js` (puro)
- Create: `src/lib/googleCalendar.js`
- Create: `src/app/api/google-calendar-auth/route.js` (GET admin: inicio OAuth y callback, guarda `integrations/google_calendar` = `{ refreshToken, email, conectadoMs }`)
- Create: `src/app/api/tienda/horarios/route.js` (GET público: `{ turnos: ISO[] }`, `Cache-Control: s-maxage=60`)
- Create: `src/app/api/presupuesto/meet/route.js` (POST admin `{ id, accion: 'aceptar'|'rechazar' }`)
- Modify: `src/lib/healthCheck.js` (+ `checkGoogleCalendar({ db })`) y `src/app/api/cron/health/route.js`
- Modify: `src/components/admin/BudgetManager.jsx` (muestra meet pedido + botones Aceptar/Rechazar + `meetUrl`; botón "Conectar Google Calendar"; config de horarios en `site_config/meet` = `{ dias:[1..5], desde:'09:00', hasta:'12:00', minutos:30, minAnticipacionH:24, maxDias:14 }`)
- Test: `src/lib/meetSlots.test.js`, `src/lib/googleCalendar.test.js`

**Interfaces:**
- Produces:
  - `turnosLibres({ config, ocupados: [{ inicio, fin }], now }) -> string[]` (ISO UTC, ordenados).
  - `turnoValido(inicioISO, { config, ocupados, now }) -> boolean`.
  - `getCalendarAuth(db) -> { accessToken } | null` (refresca con `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`).
  - `ocupados({ accessToken, desde, hasta, fetchImpl }) -> [{ inicio, fin }]` (freeBusy de `primary`).
  - `crearEventoMeet({ accessToken, inicio, fin, titulo, descripcion, invitado, fetchImpl }) -> { eventId, meetUrl }` (`conferenceDataVersion=1`, `sendUpdates=all`, `createRequest.requestId` = id de la solicitud).
  - `aceptarMeet(db, id, { calendar, now }) -> { status, meetUrl?, error? }`.
- Env nuevas: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (OAuth client "Web" en el proyecto de Google Cloud, redirect `https://marianoaliandri.com.ar/api/google-calendar-auth/`, app **publicada**). Scopes: `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/calendar.freebusy`.

- [ ] **Step 1: Tests que fallan (`meetSlots.test.js`)**, con `now = 2026-11-25T13:00:00Z` (mié 10:00 ART):
  - el primer turno es jue 26/11 13:00Z (+24 h exactas: incluido), luego 13:30Z, 14:00Z, 14:30Z;
  - no hay turnos sáb/dom; el último del día es 14:30Z (11:30 ART); ninguno ≥ 15:00Z;
  - un `ocupado` 13:15Z–13:45Z saca 13:00Z y 13:30Z;
  - nada más allá de `now + 14 días`;
  - `turnoValido('2026-11-28T13:00:00Z', …)` (sábado) → false.
- [ ] **Step 2: Tests que fallan (`googleCalendar.test.js`)** con `fetchImpl` fake: `aceptarMeet` re-consulta freebusy; si el turno está ocupado → `{ status: 409 }` y no llama a events.insert; si libre → guarda `meet.estado='aceptado'`, `eventId`, `meetUrl` y devuelve 200; presupuesto sin `meet.inicio` → 400.
- [ ] **Step 3:** FAIL. **Step 4:** implementar (OAuth con `prompt=consent&access_type=offline`, state firmado). **Step 5:** PASS.
- [ ] **Step 6:** Commit `feat(meet): turnos libres de Google Calendar y aceptar Meet desde el admin`. Pasos manuales para Mariano en el mensaje final: crear OAuth client, publicar la app, cargar env vars, "Conectar Google Calendar".

### Task 5: Asistente de la tienda (API)

**Files:**
- Create: `src/lib/ai/tiendaAsistente.js`
- Create: `src/app/api/tienda/asistente/route.js` (POST público, `maxDuration = 60`)
- Test: `src/lib/ai/tiendaAsistente.test.js`

**Interfaces:**
- Consumes: catálogo con `ficha` (Task 2), `CONTEXTO_GENERAL`/`site_config/asistente_tienda`, `conRespaldo`, `hitRateLimit`.
- Produces:
  - `contextoAsistente({ catalogo, contextoGeneral, marcados: string[] }) -> string` (system prompt; catálogo vía `sinPrecios`).
  - `herramientasAsistente({ catalogo }) -> { ver_ficha, sumar_servicio, sacar_servicio }` — las dos últimas devuelven `{ accion: 'sumar'|'sacar', id }` (la ruta las junta en `acciones`).
  - `sinMontos(texto) -> string` reemplaza montos de dinero por "eso lo charlamos en la reunión".
  - `explicacionAlMarcar(item, { agregadoPor }) -> string` (sin IA, para la UI): `paraQue` + `ejemplo` + si `agregadoPor`, "Lo sumé porque lo necesita <label>".
  - Ruta: body `{ mensaje (≤1000), historial (≤10 turnos), marcados }` → `{ respuesta, acciones: [{ accion, id }] }`; rate limit 20/h por IP sin sesión, 60/h con sesión; 429 con mensaje en criollo.

- [ ] **Step 1: Tests que fallan**:
  - `contextoAsistente(...)` no matchea `/priceUSD|US\$\s?\d|\$\s?\d/`; incluye la `ficha.paraQue` de un id marcado; incluye la regla "Nunca des precios".
  - `sinMontos('Sale US$ 500 o $ 750.000 más o menos')` no contiene dígitos seguidos de/antecedidos por moneda.
  - `herramientasAsistente(...).sumar_servicio.execute({ id: 'carrito' })` → `{ accion: 'sumar', id: 'carrito' }`; id inexistente → `{ error }`.
  - `explicacionAlMarcar` con `agregadoPor` menciona el label del que lo pidió.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(tienda): asistente con fichas, sin precios, que suma y saca servicios`.

### Task 6: Sesiones de la tienda y avisos a Telegram

**Files:**
- Create: `src/lib/telegram.js`
- Create: `src/lib/tiendaSesion.js`
- Create: `src/app/api/tienda/sesion/route.js` (POST público, rate limit 120/h por IP)
- Test: `src/lib/telegram.test.js`, `src/lib/tiendaSesion.test.js`

**Interfaces:**
- Produces:
  - `sendTelegram({ texto, botones?: [{ texto, url }], env, fetchImpl }) -> { ok, error? }` (sin `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` → `{ ok:false, error:'sin config' }`, nunca tira).
  - `debeAvisar(prev, next) -> 'interes' | null` (`interes` si `!prev.avisado` y (`next.servicios.length >= 2` o `next.ultimaPregunta`)).
  - `textoAviso(sesion, { labels }) -> string` y `textoSolicitud(solicitud) -> string`.
  - `registrarSesion(db, { id, servicios, ultimaPregunta, ciudad, ua }, { avisar, now }) -> { avisado: boolean }` (transacción en `tienda_sesiones/{id}`; bots por UA → no escribe).
  - `avisarSolicitud(db, solicitudId)` (usado por Task 3).
- Doc `tienda_sesiones/{id}`: `servicios, ultimaPregunta, ciudad, inicioMs, ultimoMs, avisado, solicitudId, expiraEn (now + 30 d, TTL)`.
- Env nuevas: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

- [ ] **Step 1: Tests que fallan**:
  - `debeAvisar({avisado:false},{servicios:['a']})` → null; con 2 servicios → `'interes'`; con pregunta y 0 servicios → `'interes'`; `prev.avisado` → null.
  - `registrarSesion` llamado **dos veces en paralelo** cruzando el umbral → `avisar` llamado 1 vez.
  - UA `Googlebot` → no escribe ni avisa.
  - `textoAviso` incluye ciudad, labels y la pregunta; nunca un monto.
  - `sendTelegram` arma `POST https://api.telegram.org/bot<token>/sendMessage` con `chat_id`, `text` y `reply_markup.inline_keyboard`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (ciudad = `decodeURIComponent(headers['x-vercel-ip-city'])`). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(tienda): avisos a Telegram cuando alguien arma en serio`.

### Task 7: UI de la tienda

**Files:**
- Rewrite: `src/components/tienda/TiendaServicios.jsx` (orquesta estado: marcados, sesión, envío)
- Create: `src/components/tienda/ListaServicios.jsx` (grupos de `GRUPOS`, checkbox + `benefit`, atajos `RECETAS`)
- Create: `src/components/tienda/Asistente.jsx` (mensajes, input, botones [Sí] [No]; en celular bottom sheet)
- Create: `src/components/tienda/SolicitudForm.jsx` (datos + notas + turnos de `/api/tienda/horarios/` o "Prefiero que me escriban"; login Google)
- Create: `src/components/tienda/useSesionTienda.js` (id en `sessionStorage` con try/catch; debounce 3 s a `/api/tienda/sesion/`)
- Modify: `src/app/tienda/page.jsx` (texto del header: "Marcá lo que necesitás y te ayudo a entender cada cosa. Después lo charlamos y te paso el presupuesto.")
- Modify: `src/app/providers.jsx` (no montar `AIChatBot` en `/tienda`)

**Interfaces:**
- Consumes: Tasks 2, 3, 4, 5, 6.

- [ ] **Step 1:** Implementar. Layout desktop `lg:grid-cols-[minmax(0,1fr)_400px]`; asistente `sticky top-20 h-[calc(100dvh-6rem)]`; franja "Tu pedido: N servicios" sticky bajo el header con botón "Pedir presupuesto". Al marcar: mensaje `explicacionAlMarcar` en el asistente al instante. Acciones del asistente → marcan/desmarcan. Éxito → "¡Listo! Te escribo en menos de 24 h" (+ "Te llega la invitación al Meet cuando lo confirme" si pidió turno).
- [ ] **Step 2:** Verificar en Chrome (dev `:3005`), 1920×1080 y 390×844: `document.documentElement.scrollWidth <= innerWidth` y ningún elemento con `getBoundingClientRect().right > innerWidth`; sticky del asistente y de la franja; `document.body.innerText` sin `/US\$|\$\s?\d/`; bottom sheet abre/cierra.
- [ ] **Step 3:** Commit `feat(tienda): servicios en criollo con asistente al costado y solicitud con Meet`.

### Task 8: Página del presupuesto para el cliente + links

**Files:**
- Create: `src/lib/presupuestoCliente.js`
- Create: `src/app/tu-presupuesto/[id]/page.jsx` (server, `dynamic = 'force-dynamic'`, `robots: { index: false }`)
- Modify: `src/lib/presupuestos.js` (`presupuestoResumen` agrega `clienteUrl` si hay `pdfToken`; `mensajePresupuesto` usa `clienteUrl` en vez de `pdfUrl` cuando existe)
- Modify: `src/lib/presupuestoEmail.js` (botón principal "Ver mi presupuesto" → `clienteUrl`)
- Modify: `src/lib/mcp/tools/presupuestos.js` (`conLinks` asegura token con `tokenPdf` y suma `clienteUrl`)
- Modify: `src/components/admin/BudgetManager.jsx` (copiar link del cliente)
- Test: `src/lib/presupuestoCliente.test.js`, `src/lib/presupuestos.test.js`

**Interfaces:**
- Produces: `urlCliente(id, token) -> 'https://marianoaliandri.com.ar/tu-presupuesto/<id>/?t=<token>'`; `tokenOk(dado, guardado) -> boolean` (`timingSafeEqual`; false si falta alguno o largos distintos); `vistaCliente(d) -> { nombre, items: [{ titulo, beneficio }], totalARS, totalUSD, linkPago, pagado, numero }`.

- [ ] **Step 1: Tests que fallan**: `tokenOk('a', undefined)` false; distinto largo false; igual true. `vistaCliente` usa `benefit` y cae a `desc`; `pagado` true si `status==='accepted'`; ítems del formato MCP (`nombre/precioUSD`) y del admin (`label/priceUSD`) funcionan. `mensajePresupuesto({ ..., clienteUrl })` contiene la URL del cliente y no "PDF".
- [ ] **Step 2:** FAIL. **Step 3:** implementar; la página hace `notFound()` si no hay doc o `!tokenOk`. Copy: "Hola <nombre> 👋", "Este es el presupuesto, tal cual lo charlamos.", "Lo que vamos a hacer", "Pagar con MercadoPago", "Tengo una duda", "¡Recibimos tu pago! Ya arrancamos." **Step 4:** PASS.
- [ ] **Step 5:** Verificar con un presupuesto real en dev (link correcto → página; token alterado → 404).
- [ ] **Step 6:** Commit `feat(presupuesto): página para el cliente con link de pago`.

### Task 9: Arreglos de lo que se pisa, privacidad, embudos y docs

**Files:**
- Modify: `src/app/providers.jsx` (header en celular: el logo no choca con carrito/tema — ocultar `.com.ar` bajo `sm`)
- Modify: `src/app/globals.css` (flotantes sobre la barra inferior: `body[data-barra-inferior] .whatsapp-floating-btn, body[data-barra-inferior] .chatbot-floating-btn { bottom: 140px }`)
- Modify: `src/app/privacy/page.jsx` (línea sobre ciudad aproximada y lo marcado en la tienda)
- Modify: `src/data/funnels.js` (Tienda: `ver_tienda` → `solicitud_presupuesto` → `meet_pedido`; Presupuesto cliente: `ver_presupuesto` → `begin_checkout`) y los `track()` correspondientes en Tasks 7–8
- Modify: `CLAUDE.md` (sección Tienda reescrita; env nuevas `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; colecciones `tienda_sesiones`, `integrations/google_calendar`, `site_config/meet`, `site_config/asistente_tienda`; paso a paso de @BotFather y del OAuth)

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Verificar en 390×844: los rects del logo y del carrito no se intersectan; los flotantes no tapan la franja inferior. `npm test` y `npm run build` verdes.
- [ ] **Step 3:** Commit `fix(ui): header y flotantes en celular; docs de la tienda por consulta`.
