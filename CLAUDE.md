# Portfolio Mariano Aliandri — Guia para Claude

## Que es el proyecto

Portfolio profesional de Mariano Aliandri, desarrollador Full Stack y analista de datos.
Funciona como sitio de presentacion personal + plataforma con herramientas interactivas
para clientes (calculadoras, analizador ATS, tienda de servicios, dashboard de stats).

URL en produccion: https://marianoaliandri.com.ar

---

## Stack tecnico

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Animaciones | Framer Motion 12 |
| Estado servidor | TanStack Query 5 |
| Auth + DB | Firebase 12 (Auth + Firestore) |
| Imagenes | Cloudinary |
| Pagos | MercadoPago |
| AI | Google Gemini 2.5 Flash |
| TTS | Google Cloud Text-to-Speech API |
| Email transaccional | Zoho Mail (dominio propio) + Nodemailer |
| Email outreach | Resend (`notificaciones@marianoaliandri.com.ar`) |
| Automatizacion | Make.com (webhooks) |
| Deploy | Vercel (CLI: `vercel --prod`) |
| DNS | Vercel DNS (gestionado via Vercel CLI) |

---

## Estructura de carpetas

```
src/
  app/                  # App Router de Next.js
    page.jsx            # Home: HeroBuild + Servicios + Skills + ProyectosGrid + Contact
    layout.jsx          # Root layout: metadata, preconnects, dark mode script, favicon dinamico
    providers.jsx       # QueryClient, CartProvider, AppChrome (header, footer, tools)
    api/                # API Routes (server-side)
      analyze-cv/       # Gemini ATS — analiza PDF de CV
      chat/             # AI chatbot (Gemini 2.5 Flash)
      create-payment/   # MercadoPago — crea preferencia de pago
      cv-payment/       # Pago por analisis de CV
      lead-finder/      # Google Places + scraping de emails (multi-ciudad)
      publish-social/   # Proxy a Make.com webhook para publicar en redes sociales
      search-console/   # GSC stats — dinamico via gscClient (sin SITES hardcodeado)
      proyectos/        # GET: GSC sites.list() + clicks/imp + Firestore desc + Microlink URLs
      send-email/       # Envio de emails via Nodemailer + Zoho
      admin-login/      # Login del panel admin (ADMIN_USERNAME + ADMIN_PASSWORD_HASH)
      reset-products/   # Resetea coleccion products en Firestore (requiere password)
      seed-rental/      # Seedea coleccion productos_alquiler en Firestore (POST, una vez)
      rental-data/      # GET /api/rental-data → todos los docs activos de productos_alquiler
                        # GET /api/rental-data/[productId] → doc individual (usa Firebase Admin)
      upload-reel/      # Recibe videoUrl (MP4 Cloudinary) + notifica Make.com webhook
      reel-script/      # Genera script de locutor con Gemini 2.5 Flash
      reel-tts/         # Genera audio MP3 con Google TTS (voz es-AR-Standard-B)
      reel-music/       # Retorna URL de musica segun mood (Mubert o fallback Cloudinary)
      payment-webhook/  # Webhook de MercadoPago (notificaciones de pago)
      auditorias/       # GET (lista o por ?id=) / POST (crea) / DELETE — Firestore col "auditorias"
        send-biz-email/ # POST: Gemini genera email personalizado + Resend lo envia al negocio
      presupuesto/      # POST: guarda solicitud en Firestore col "presupuestos" + notifica admin
      zone-caption/     # Genera caption de zona con Gemini
      keyword-explorer/ # POST: rankea rubros por demanda (Google autocomplete) — requiere idToken + cuota
      me/               # GET: plan y cuota del usuario autenticado (Authorization Bearer)
      subscribe/        # POST: crea suscripcion mensual MercadoPago (PreApproval) → init_point
      subscription-webhook/ # Webhook MP suscripciones → activa plan en "entitlements" (URL con barra!)
      resend-webhook/   # Webhook de Resend (email.sent/delivered/opened/bounced) → col "sent_emails"
      gumroad-webhook/  # Ping de Gumroad → re-verifica venta via API Gumroad (GUMROAD_ACCESS_TOKEN)
                        # antes de acreditar → "leadfinder_entitlements" (packs USD Lead Finder Pro)
    auditorias/         # Paginas publicas de auditorias SEO (server components, ISR — ver seccion Active CPU)
      page.jsx          # Lista de auditorias — lee Firestore via getDb() directamente
      [id]/
        page.jsx        # Detalle de auditoria — lee Firestore via getDb() directamente
        AuditTable.jsx  # Tabla ordenable (client component — sin email/datos privados)
    presupuesto/        # Formulario publico de solicitud de presupuesto (3 pasos)
      page.jsx
    admin/              # Panel de administracion (requiere auth)
    tienda/             # E-commerce de servicios
      page.jsx          # Lista de productos (Store.jsx con toggle Compra/Alquiler global)
      [productId]/      # Detalle de producto con toggle Compra/Alquiler + datos de Firestore
    ats/ roi/ kpi/ web/ radarweb/ stats/  # Herramientas interactivas (ruta propia + metadata SEO)
  components/
    Store.jsx           # Grid de productos con toggle Compra/Alquiler, carrito, filtros
    ProductCard.jsx     # Card de producto — acepta prop rental={} de productos_alquiler
    ProductQA.jsx       # Preguntas y respuestas por producto (Firestore)
    ProyectosGrid.jsx   # Grid dinamico de proyectos con stats de GSC
    SocialPublisher.jsx # Publicador de servicios en redes (admin) — envia a Make.com
    BudgetForm.jsx      # Formulario de presupuesto (3 pasos: datos, servicios, resumen)
    leadfinder/         # Buscador unico de Lead Finder (cliente y admin): LeadFinder.jsx (variant),
                        # useLeadSearch, LeadFinderForm, LeadResultsTable, LeadSearchHistory, admin/
    admin/
      CanvasReelGenerator.jsx  # Generador de reels canvas — flujo 5 pasos (ver abajo)
      AuditoriasManager.jsx    # Lista/elimina auditorias, expande detalle con tabla+email
      BudgetManager.jsx        # Lista solicitudes de presupuesto, asigna monto, genera link MP
      ZoneAnalysis.jsx         # Analisis de zonas urbanas con heatmap
    ...otros componentes reutilizables
  views/
    StorePage.jsx       # Wrapper de /tienda con SEO, pasa asPage={true} a Store
    ProductDetailPage.jsx # Detalle de producto: toggle Compra/Alquiler con framer-motion,
                          # fetch desde /api/rental-data/[id], precios en USD+ARS, WA dinamico
    AdminPage.jsx       # Panel admin completo
    ...otras vistas
  context/              # CartContext
  hooks/                # useAnalytics, useFirebaseStats, useSearchConsole, useProyectos, etc.
  utils/
    priceService.js     # Carga productos desde Firestore (coleccion products), con cache 5min
    exchangeService.js  # Tipo de cambio USD→ARS, formatARS, formatUSD
    firebaseservice.js  # Firebase client SDK (db, auth, analytics)
    makeService.js      # Envia payload a Make.com webhook
    canvasReelService.js # Canvas animation + MediaRecorder + mezcla audio Web Audio API
    ...otros servicios
  lib/
    firebase-admin.js   # Firebase Admin SDK — usa FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY
                        # getDb() reintenta init si falló en cold start (ver seccion abajo)
    gscClient.js        # Google Search Console client + getVerifiedSites()
    leadRule.js         # Regla de lead: web → lead; sin web → solo si tiene WhatsApp (celular AR +54 9)
    leadSearch.js       # Motor unico de busqueda (generador): pantallas + auditoria automatica
  schemas/              # firebaseSchemas.js
  data/
    products.js         # Catalogo estatico de productos (IDs canonicos, fallback)
    localidadesAR.js    # PROVINCIAS_AR: 24 provincias con localidades para el Lead Finder
    serviceLogos.js     # Mapa tema→logo Cloudinary para SocialPublisher
```

---

## Deploy y entorno

- **Deploy**: `git push` → Vercel auto-deploy via GitHub. Emergencias: `vercel --prod`
- **GitHub**: `https://github.com/maliandri/marianoaliandri-portfolio-next` (privado, rama `main`)
- **DNS**: Vercel DNS (nameservers: ns1.vercel-dns.com)
- **Dominio principal**: marianoaliandri.com.ar (apex)
- **Email**: Zoho Mail — MX apuntando a mx.zoho.com (configurado en Vercel DNS)
- **Registrador de dominio**: NIC Argentina

### Vercel IDs
- Project: `prj_mnuqhcbbt6R6XJXFNcMQZzUS2tGM`
- Team: `team_AM8PT5kvxj9yWwmsVkeQd0y4`

---

## Variables de entorno necesarias (solo nombres)

```
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY        ← Firebase web API key (NO confundir con GEMINI_API_KEY)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# Firebase Admin — usa vars INDIVIDUALES (no FIREBASE_SERVICE_ACCOUNT_JSON)
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY                ← Con \n literales; firebase-admin.js hace .replace(/\\n/g,'\n')

# Google APIs
GOOGLE_PLACES_API_KEY
GEMINI_API_KEY                      ← Google Cloud API key sin restricciones (proyecto MarianoAliandri)
                                       Usada para Gemini + Google TTS + fallback Firebase
                                       Si se rota: actualizar tambien NEXT_PUBLIC_FIREBASE_API_KEY

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET           ← Clave secreta del webhook (Tus Integraciones → Webhooks).
                                       Valida la firma x-signature (HMAC-SHA256) en payment-webhook
                                       y subscription-webhook. Ver src/lib/mpWebhook.js
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY   ← Public key para el SDK del browser

# Gumroad
GUMROAD_ACCESS_TOKEN                ← Access token de una Application creada en
                                       Gumroad (Settings → Advanced → Applications →
                                       Generate access token). Usado por
                                       /api/gumroad-webhook para re-verificar cada venta
                                       contra GET https://api.gumroad.com/v2/sales/:id
                                       antes de acreditar créditos — el Ping de Gumroad
                                       no viene firmado, así que nunca hay que confiar en
                                       su body crudo. Ver seccion de Lead Finder Pro abajo.

# Instagram (historias) — secrets de GitHub Actions Y env de Vercel (Publicación Libre → Historia)
IG_ACCESS_TOKEN                     ← Token de PÁGINA (no vence; data access vence cada 90 días) de la
                                       app de Meta "Maliandri_APP" (modo desarrollo), con
                                       instagram_content_publish. Make no tiene módulo para historias: el
                                       bot de noticias, la auditoría automática y /api/publish-story/ las
                                       publican directo con la Graph API (scripts/igStoryClient.mjs).
                                       Sin esta var no sale ninguna historia.
IG_USER_ID                          ← 17841404013651966 (cuenta de Instagram Business)

# LinkedIn OAuth
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

# Email outreach
RESEND_API_KEY                      ← Para /api/auditorias/send-biz-email
                                       From: notificaciones@marianoaliandri.com.ar (DKIM verificado)
                                       Reply-To: yo@marianoaliandri.com.ar

# Terceros
PEXELS_API_KEY
SHOTSTACK_API_KEY
MUBERT_API_KEY                      ← Opcional. Sin esta var usa fallback de Cloudinary
GROQ_API_KEY                        ← Solo GitHub Actions (bot de noticias), NO en Vercel.
                                       Secret en GitHub → Settings → Secrets and variables →
                                       Actions. Free tier sin tarjeta. Fallback de Gemini en
                                       scripts/noticias-bot.mjs (modelo openai/gpt-oss-120b)

# Admin
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
```

**ADVERTENCIA en Windows PowerShell**: `printf` no existe en PowerShell. Usar:
```powershell
vercel env rm VAR_NAME production
vercel env add VAR_NAME production
# (pegar el valor cuando lo pide, marcar como sensitive)
```

**ADVERTENCIA en bash/Linux**: Nunca usar `echo` para setear vars en Vercel — agrega `\n`.
Siempre usar: `printf "VALUE" | vercel env add VAR production`

---

## Funcionalidades activas

- **Home**: Hero animado con editor de codigo en vivo, carrusel de servicios, skills, Proyectos Realizados (grid dinamico con GSC), contacto
- **Detalle de proyecto** (`/proyectos/[domain]` — sin barra final, ver seccion de trailingSlash):
  pagina publica por sitio del portfolio (server component, ISR 6 h, lee GSC + Firestore
  directo). Muestra stack, funcionalidades, impacto, stats de GSC y una galeria de fotos/videos
  (`proyectos/{domain}.media`, solo los items con `publicable: true`). Se sube contenido a esa
  galeria desde el admin (tab Proyectos → "Fotos y videos"), via `/api/proyectos/media`
  (POST crea, PATCH togglea `publicable`) reusando `cloudinaryService.js`. Cada card de
  `ProyectosGrid.jsx` en el home linkea a esta pagina.
- **Tienda** (`/tienda`):
  - Grid de servicios con toggle global **Compra / Alquiler** en el header de la tienda
  - Carrito + checkout con MercadoPago
  - Pagina de detalle por producto (`/tienda/[productId]`) con toggle animado (framer-motion), precios en USD y ARS, boton WhatsApp dinamico segun modo
  - Modelo de alquiler: datos en Firestore coleccion `productos_alquiler` (seña, cuota, duracionMinima, activo). Si `activo: false` el toggle no aparece
  - Seccion "¿Queres quedarte con el sitio?" en modo alquiler
  - Q&A por producto (Firestore)
- **Presupuesto** (`/presupuesto`):
  - Formulario publico de 3 pasos: datos del cliente → grilla de servicios (checkboxes) → resumen + envio
  - Guarda en Firestore coleccion `presupuestos` con estado `pending`
  - Admin tab "Presupuestos": asigna monto USD/ARS, genera link MercadoPago, envia por email o WhatsApp
- **Lead Finder** (un solo buscador, `src/components/leadfinder/LeadFinder.jsx`):
  - Lo usan `/lead-finder-pro/buscar` (`variant="cliente"`, ES/EN) y el admin (`variant="admin"`),
    los dos contra `/api/lead-finder-pro/run` (la cuenta admin tiene acceso ilimitado). La
    auditoría automática usa el mismo motor (`src/lib/leadSearch.js`) desde GitHub Actions.
  - Regla de lead (`src/lib/leadRule.js`): con web → se audita; sin web → sirve solo si tiene
    celular (WhatsApp); si no, se descarta. Se cobra 1 crédito solo por lead; los descartados
    no se cobran (tope 100/día por usuario, `descartesHoy` en `leadfinder_entitlements`).
  - Busca por términos libres y por rubros de Google Maps (`src/data/rubros.js`), varias
    localidades, perfil dev/empresa (empresa cuenta productos en cada sitio con web).
  - `cantidad` = leads a entregar; se examinan como máximo 3 × cantidad negocios.
  - Admin suma filtros, log, selector provincia → localidad y "Publicar informe" (solo leads con
    web y puntaje SEO, mínimo 3) + redes.
  - Historial en `leadfinder_searches` con `origen: 'admin' | 'cliente'`.
  - **Cruce con "Rubros buscados"** (decisión 2026-10-23: incluido gratis en Lead Finder Pro): acción
    `rubroDemand` de `/api/lead-finder-pro/run` (`src/lib/rubroDemand.js`, mismo autocompletado de Google
    que `/api/keyword-explorer`, caché 7 días en `rubro_demanda/{ciudad}`). Devuelve solo el top 10 + 3
    frases por rubro (la lista completa y el CSV siguen siendo del producto Keywords). El formulario
    sugiere los rubros más buscados; cada lead lleva `demanda` y se ordena por oportunidad (demanda ×
    web floja); el DM de Instagram cita la frase real. Desde Keywords, "Buscar negocios de este rubro"
    abre el Lead Finder con `?zona=&rubro=` (admin: `sessionStorage.lf_prefill`).
  - Saca el @ de Instagram de cada negocio (`src/lib/instagramHandle.js`: links de la home/contacto o la web de Maps si es el perfil). En el admin, panel "Prospectos de Instagram" bajo los resultados + pantalla Marketing → Prospectos Instagram: DM sugerido por Gemini (`src/lib/igProspectos.js`), "Copiar y abrir chat" (ig.me/m/handle, marca contactado) y seguimiento en `ig_prospectos`. Los DMs se mandan a mano: nada de envío automático (Instagram banea).
  - Listado publico de reportes SEO (`/auditorias`) — server component, lee Firestore directo
  - Detalle de reporte (`/auditorias/[id]`) — full width, tabla ordenable por columna
  - Tabla publica NO muestra email/telefono/direccion (privacidad)
  - Admin tab "Auditorias": lista/elimina, expande detalle con email visible
  - Boton "✉ Enviar" por negocio: Gemini genera email personalizado → Resend lo envia
    - From: `Mariano Aliandri <notificaciones@marianoaliandri.com.ar>`
    - Incluye screenshot del sitio via Microlink + score SEO badge
    - Texto generado es editable (se muestra en <details> tras envio)
- **Auditoría automática** (admin → Marketing → Auditoría automática):
  - Audita sola un rubro × ciudad (lun/mié/vie/sáb 11:00 ART vía cron-job.org), guarda el informe en `auditorias`
    y lo anuncia en LinkedIn/Instagram/Facebook vía Make.com con el mismo contrato que el botón "Publicar en redes" de Auditorías (body de `/api/publish-social`: `type: 'service'`, `networks` array, `imageUrl` = captura Microlink de `/auditorias/<id>?screenshot=1`, `link`; helper `src/lib/socialAuditPost.js`).
  - Corre en **GitHub Actions** (`.github/workflows/auditoria-auto.yml`, `scripts/auto-audit.mjs`,
    ejecutado con `tsx --tsconfig jsconfig.json`), disparado por cron-job.org vía
    `workflow_dispatch` (igual que el bot de noticias). NO usa el cron de Vercel (se armó así cuando
    el plan era Hobby, 60 s; hoy el proyecto está en **Vercel Pro con Fluid compute**, hasta 800 s).
  - **Historias de Instagram** (desde 2026-10-26): si Instagram está entre las redes y hay `IG_ACCESS_TOKEN`/`IG_USER_ID`, después del post sube como historia la captura del informe en formato celular (`auditStoryScreenshotUrl`, 1080x1920 JPG). Resultado en `historia` del run; un fallo no cambia `estado`. Lo mismo en el bot de noticias con el checkbox "Publicar también como historia" del tópico (`historia`, default false): tarjeta 9:16 (`renderNoticiaCard({ format: 'story' })`), resultado en `storyId`/`storyError` de la nota. Ambos usan `scripts/igStoryClient.mjs` (Graph API, no Make).
  - El post usa solo datos agregados (sin nombres de negocios). Arranca **apagada**: activar desde
    la tarjeta tras probar "Correr ahora".
  - Rubros prioritarios = negocios con etapas constructivas o de fabricación (candidatos al
    punto 3: oferta de sistema a medida). Cada resultado guarda `rubro` y `aptoSistemaMedida`.
  - Secrets de GitHub necesarios: `FIREBASE_*`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`,
    `GEMINI_API_KEY_1..3`, `MAKE_WEBHOOK_URL`.
  - El secret de GitHub `MAKE_WEBHOOK_URL` (compartido con el bot de noticias) debe ser el webhook del Router del escenario principal de Make (el mismo que usa `/api/publish-social`); si fuera otro escenario, los posts de auditoría caen en el lugar equivocado.
  - Instagram/Facebook fallan con `OAuthException 324 (Missing or invalid image file)` si el payload no trae `imageUrl` válido (https público, JPG/PNG 1080x1080). La auditoría automática siempre envía `imageUrl` (la captura del informe recién guardado); el checkbox de publicar del Lead Finder (`leadfinder/LeadFinder.jsx`) usa ahora el mismo contrato vía `/api/publish-social`.
  - `estado: 'ok'` en el log de corridas solo significa que Make aceptó el payload (responde 200 antes de correr el escenario); antes de publicar se verifica esa captura de Microlink (GET, `image/*`; Microlink la renderiza en el primer pedido, así que además la deja cacheada) y, si no responde con una imagen, la corrida queda `post_fallido` sin llamar a Make.
  - Cantidad de sitios por corrida: `cantidad` en `auditoria_auto/config` (default 15, rango 3–30, se edita en la tarjeta). Se examinan hasta `2 × cantidad` comercios (getDetails); con 15 son ~516/mes con 4 corridas por semana, la mitad del cupo gratis de Places. La tarjeta muestra el consumo estimado y lo pinta en rojo si supera 1.000/mes.
  - Mínimo 3 sitios con web para guardar/publicar (`MIN_SITES_TO_PUBLISH` en `src/lib/autoAuditRun.js`): si una combinación da menos (pasó el 2026-10-12 con Durlock × Formosa: Google tenía 2 comercios, 1 con web, y se publicó un informe de 1 sitio), se marca como hecha y se prueba otra en la misma corrida (hasta 3 intentos, compartiendo el tope de `maxCandidates` y el tiempo). Cada corrida guarda `intentos` (encontrados / examinados / con web por combinación), visible en la tarjeta del admin.
  - "Correr ahora" (admin) usa modo rápido (pensado para el límite de 60 s del viejo plan Hobby; con Pro se podría alargar): lote corto (hasta 8 sitios, 15 s) y resumen de plantilla sin Gemini; la corrida programada de GitHub Actions usa el presupuesto completo.
- **Informes de demanda** (`/demanda/` + admin → Marketing → Informes de demanda, desde 2026-10-27): ranking de los 20
  rubros más buscados por zona (autocompletado de Google vía `analyzedConCache` de `src/lib/rubroDemand.js`, gratis, sin Places).
  Una zona = una ciudad o un grupo de localidades (ej. Alto Valle: Neuquén, Plottier, Centenario, Cipolletti, Cinco Saltos, Allen,
  General Roca); semillas en `src/data/demandaZonas.js`, se editan en el admin (`demanda_auto/config`). Solo cuentan las frases
  que nombran la localidad como palabra entera (`mencionaLocalidad`; si no, "Allen" suma "allende"). Lógica pura en
  `src/lib/demandaReport.js` (índice de zona = suma de puntajes; por localidad = relativo a su máximo; cambio contra el informe
  anterior vía `ultimoReporte`), corrida en `src/lib/demandaAutoRun.js`. **Cron de Vercel** (`vercel.json`, mar–vie 21:00 UTC =
  18:00 ART, `/api/cron/demanda/` con `CRON_SECRET`; el POST es el "Correr ahora" del admin, `publicar:false` para probar). Cada zona
  sale como mucho una vez por semana (`COOLDOWN_MS`): con menos de 4 zonas no alcanzan los 4 posts. Publicación (desde 2026-10-28,
  `src/lib/demandaPublish.js`): las imágenes son **capturas del propio informe** (decisión del usuario: nada de placas
  diseñadas aparte), una por parte (`seccionesDe`: portada + puestos 1–10, puestos 11–20, tabla por localidad, frases,
  cierre). El sitio muestra solo esa parte con `?screenshot=1&seccion=<parte>` (`DemandaShot.jsx` + atributos `data-sec`
  en `/demanda/[id]`, resuelto en el cliente para no perder el ISR; marca `body[data-shot-ready]`, que Microlink espera
  con `waitForSelector`, viewport 1080x1350 JPG). Se bajan, se suben a Cloudinary (`demanda/<id>`, guardadas en `slides`
  del informe, imagen OG y miniaturas en el admin) → **carrusel en Facebook + Instagram** por
  Make (`buildFreePostPayload`, rama de carrusel de Publicación Libre) y **PDF en LinkedIn** (pdf-lib) por la API de
  LinkedIn directo (`src/lib/linkedinClient.js`: documents initializeUpload → PUT → esperar AVAILABLE → `/rest/posts`;
  commentary en "little text" escapado; header `LinkedIn-Version` = mes de hace 2 meses). Make no sube documentos. Token =
  conexión del admin (`integrations/linkedin`, vence a los 60 días sin refresh: reconectar en admin → LinkedIn; el chequeo
  diario avisa). Cada red falla por separado (`redes` en el run). Las capturas se sacan también sin publicar (vista previa).
  Texto de plantilla sin IA. Con menos de
  20 rubros con datos no publica (`sin_datos`); los fallos mandan alerta. El público ve el top 20: la lista completa sigue siendo
  de Analítica. El buscador + provincia + ciudad del listado filtra informes ya publicados (no consulta Google). Embudo propio.
- **Consumo Google** (admin → Marketing → Consumo Google): tabla por día del mes con comercios
  auditados (getDetails), búsquedas, acumulado y cuánto queda del cupo gratis mensual de Places
  (1.000 detalles), proyección a fin de mes y costo estimado. Lee `leadfinder_usage` vía
  `/api/places-usage` (admin). Cupos y precios estimados en `src/data/placesFreeTier.js`;
  cálculo en `src/lib/placesUsage.js`.
- **Embudos de conversión** (admin → Panel → Embudos, desde 2026-10-27): personas (GA4, sin bots) por paso en
  Presupuesto, IA para empresas, Tienda, Analítica y Lead Finder Pro + clicks a WhatsApp. Pasos en
  `src/data/funnels.js`, lectura en `fetchFunnels` (`src/lib/siteStats.js`), ruta `/api/funnels/`, tool MCP
  `get_funnels`. Los eventos salen con `track()` de `src/lib/track.js` (gtag →
  `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, la propiedad que lee el sitio). **No usar `trackGAEvent` para conversiones**:
  va a la propiedad de Firebase (`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`, otra propiedad que nadie lee); por eso
  `generate_lead` y `whatsapp_click` nunca habían llegado. Clicks a `wa.me` y a `/presupuesto` se registran solos
  en todo el sitio (listener global en `providers.jsx`); la vuelta de MercadoPago (`?payment=`/`?sub=`/`?lfp=success`)
  marca `compra_*`.
- **Alertas por mail** (desde 2026-10-27, `src/lib/alert.js`): `sendAlert` / `alertError` mandan un mail (Resend) a
  `ALERT_EMAIL` o `ADMIN_EMAIL`, máx. uno por hora por `key` (las repeticiones se cuentan en la colección `alertas`),
  con `redactSecrets` y sin tirar nunca. Disparan: cualquier error no capturado del servidor (`src/instrumentation.js`,
  `onRequestError`, solo en producción), los catch de los webhooks de MercadoPago (pagos y suscripciones), Gumroad y
  Resend, y el cron diario `/api/cron/health/` (12:00 UTC, `vercel.json`, `CRON_SECRET`) que revisa el token de
  Instagram (que sirva + aviso con ≤7 días a `expires_at` o `data_access_expires_at`), la conexión de LinkedIn
  (`checkLinkedIn`: no conectada, vencida o ≤7 días) y el de MercadoPago
  (`src/lib/healthCheck.js`). Para un catch nuevo que importe: `await alertError('clave', 'Título', e, { contexto })`.
- **Menú del admin y pantallas nuevas**: `nav_config/admin` guarda `knownIds` (los ids que existían
  en el código al guardar). `src/lib/navMerge.js` agrega solo los ítems/sub-ítems del código que
  aparecieron después, así una pantalla nueva en `adminNav.js` aparece sola y lo que el usuario
  quitó a mano no vuelve.
- **Herramientas** (modales desde home + rutas propias con metadata SEO):
  - `/ats` — Analizador de CV con Gemini AI (PDF upload, analisis ATS)
  - `/roi` — Calculadora de ROI digital
  - `/web` — Cotizador de sitios web
  - `/kpi` — Radar KPI interactivo
  - `/radarweb` — Radar Web
  - `/stats` — Dashboard de estadisticas (GSC, Firebase, visitas)
- **Analitica** (`/analitica`) — **PROTEGIDA CON REGISTRO + PLANES DE PAGO**:
  - Toda la seccion requiere login (Firebase Auth). Tabs: Tendencias, Reportes de Zona, **Rubros buscados**
  - Tab "Rubros buscados" = Keyword Explorer: elegis provincia/localidad de Argentina y ranquea los
    rubros por demanda de busqueda via **autocompletado de Google** (endpoint publico gratuito, NO
    usa Places API ni cuota). Devuelve las frases long-tail reales que busca la gente + export CSV
  - Muro de login (`AuthGate`) + badge de plan/cuota (`PlanBadge`) en el header
  - Planes (`src/data/plans.js`): Free (1 busqueda unica) / Basico $4999 (10/mes) / Full $14999 (ilimitado)
  - Cobro: **MercadoPago PreApproval** (suscripcion mensual automatica) via `/api/subscribe` →
    `/api/subscription-webhook` activa el plan en `entitlements`
  - Enforcement server-side en `/api/keyword-explorer`: verifica idToken + consume cuota atomica
    (transaccion Firestore). Sin token → 401. Cuota agotada → 402 → abre `PlansModal`. **NO evadible**
- **Keywords** (`/keywords`): landing publica de SEO del buscador de rubros (funnel). La accion
  "Analizar" pasa por el mismo gating (login + cuota) via `/api/keyword-explorer`
- **IA para empresas** (`/ia-para/` + `/ia-para/[nicho]/`, desde 2026-10-26): landings estáticas que venden
  "tu sistema conectado a la IA" (servidor MCP a medida, ver sección Servidor MCP), una por rubro. Los
  nichos son datos en `src/data/iaNichos.js` (pregunta del equipo, herramienta, respuesta de ejemplo con
  datos ficticios, tareas, sistemas, SEO); para sumar un rubro se agrega un bloque ahí y
  `iaNichos.test.js` valida campos y sitemap. Componentes en `src/components/iaPara/` (tipografías
  Bricolage + JetBrains Mono solo en estas páginas). CTA: WhatsApp con mensaje por nicho + `/presupuesto`.
- **Admin** (`/admin`): Panel interno con tabs: Stats, Productos, Publicar Redes, Reels, Proyectos GSC, Auditorias, Presupuestos
- **Historias de Instagram desde el admin** (Marketing → Redes Sociales → Publicación Libre → **Historia**,
  desde 2026-10-26): `src/components/social/StoryComposer.jsx` → `POST /api/publish-story/` (admin). Tres tipos:
  texto (tarjeta de marca 9:16 de `scripts/noticiaCard.mjs`), imagen (Cloudinary: fondo `e_blur` + capa `c_fit`, 1080x1920 JPG;
  `b_blurred` solo existe para video, en imágenes da 400)
  y video (MP4 9:16, recortado a 60 s). Primero `dryRun` (vista previa), después publica directo con la Graph API
  (no pasa por Make). Registro en `ig_stories`. satori y @resvg/resvg-js van en `serverExternalPackages` y las
  tipografías en `outputFileTracingIncludes` (`next.config.mjs`): sin eso el build/la ruta fallan en Vercel.
- **Publicador de redes** (admin): envia POST a Make.com → Make llama a Gemini y publica en LinkedIn/Instagram/Facebook. Logos de servicios en Cloudinary (`service-logos/`)
- **Generador de reels Canvas** (admin): flujo de 5 pasos:
  1. Seleccion de contenido (Producto / Tecnologia / Proyecto)
  2. Script generado por Gemini 2.5 Flash (`/api/reel-script`) — editable, max 60 palabras
  3. Audio: musica por mood via Mubert o fallback Cloudinary (`/api/reel-music`) + voz Google TTS (`/api/reel-tts`, voz `es-AR-Standard-B`)
  4. Visual: fondo degradado (5 temas), efecto de texto (6 opciones), duracion 15/30s
  5. Grabacion: canvas 1080x1920 → WebM → Cloudinary (transformacion f_mp4,vc_h264,ac_aac) → Make.com webhook
  - Subtitle muestra CTA a la tienda (no precios) para productos
  - Mezcla de audio: voz volumen 1.0 + musica volumen 0.25 via Web Audio API
- **Bot de noticias** (GitHub Actions, no Vercel): un script autocontenido (`scripts/noticias-bot.mjs`) busca noticias nuevas de los tópicos activos (`noticias_topics`) vía Google News RSS, le pide a Gemini que redacte título/cuerpo/caption y después arma la imagen: una **tarjeta 1080x1350 (4:5)** dibujada por `scripts/noticiaCard.mjs` con Satori + resvg (gratis, corre en Actions; tipografías Inter en `scripts/fonts/`) que lleva el tópico, el titular de la IA, el medio y `marianoaliandri.com.ar`. Cada tópico decide desde el admin (checkbox "Usar la foto del artículo", campo `usarFoto` en `noticias_topics`, default `true` si no existe) si la tarjeta lleva de fondo la foto del artículo (`og:image` vía Microlink `meta=true`, descargada con User-Agent de navegador porque varios diarios dan 403 sin él; si mide menos de 600px, no es JPEG/PNG/WebP o falla, cae al fondo de marca) o siempre el fondo de marca. El color de cada tópico sale de una paleta de 6 según su id. Antes se sacaba una captura de pantalla de la página (`screenshot=true`), que salía recortada y con banners — se eliminó (2026-09-21). Consecuencia: la imagen ya no descarta noticias (siempre hay tarjeta), por eso el texto se genera antes que la imagen. Instagram solo acepta JPG, así que a Make va la URL de Cloudinary con `f_jpg,q_auto` (sin recorte, la tarjeta ya es 4:5). Cada nota guarda `imageMode: 'foto' | 'marca'`. El `body` tiene un tope de **500 caracteres** (`MAX_BODY_CHARS` en el bot, decisión del usuario 2026-09-21; el prompt pide ≤450 y `fitBody()` recorta en un final de párrafo/oración si la IA se pasa; el texto compartido con Instagram tampoco puede superar 2.200, error 36004). **Nota completa del sitio** (desde 2026-10-11): el `body` (≤500) es solo para las redes; `/noticias/[id]` muestra `contenido` (3-6 párrafos, tope `MAX_CONTENIDO_CHARS` = 4000), que la IA escribe con sus palabras a partir del texto real del artículo. Ese texto sale de la misma consulta a Microlink que da la foto y la URL final (`getArticleMeta`: reglas `data.paras` = `article p, main p` y `data.ld` = JSON-LD, con `articleBody` como respaldo; `articleTextFrom()`). Se le pide a Microlink y NO con un fetch directo porque varios diarios (ej. La Voz) están detrás de Cloudflare y a Node le devuelven 403. Si no se puede leer el artículo, la IA escribe solo con el titular y `contenido` = `body`; las notas viejas sin `contenido` también muestran el `body`. El prompt exige que el `body` cuente la noticia completa (qué/quién/cuándo/por qué importa) — nada de gancho vacío tipo "enterate haciendo click"; el link a `/noticias/{id}` va aparte, como extra opcional, no como única forma de leer la nota (decisión 2026-09-18, hartazgo explícito con portales que hacen eso). **Rotación de keys** (desde 2026-10-11): el bot prueba `GEMINI_API_KEY_1..5` (cuentas satélite) y deja `GEMINI_API_KEY` (compartida con el sitio) para el final; ante 429/503/timeout (60 s) pasa a la siguiente (`geminiKeys()` / `callGeminiRotating()`, mismo orden que `src/lib/geminiClient.js`). El workflow pasa `GEMINI_API_KEY_1..3`: si el secret no existe en GitHub llega vacío y se saltea. **Fallback de proveedor**: si fallan todas las keys de Gemini (error de red, contenido bloqueado, cuota agotada — la cuota de `GEMINI_API_KEY` es compartida con el resto del sitio, ver advertencia en el código) y hay `GROQ_API_KEY` configurada, reintenta con Groq (`openai/gpt-oss-120b` — Groq deprecó `llama-3.3-70b-versatile` para free tier el 2026-06-17, ver comentario en el código —, free tier sin tarjeta, mismo prompt). Cada doc en Firestore guarda `contentProvider: 'gemini' | 'groq'` para poder ver si el fallback se está usando seguido (señal de que Gemini se está quedando sin cuota). Sin `GROQ_API_KEY`, el bot se comporta como antes (solo Gemini, esa noticia se descarta si falla). Publica en `/noticias` + al mismo webhook de Make (`type: 'noticia'`) como post nativo en Facebook e Instagram con el cuerpo completo + link a `/noticias/{id}` (en Instagram ese link no es clickeable, limitación de la plataforma). **Destino por tópico** (`destino` en `noticias_topics`, default `fb_ig`; se elige en el admin): `fb_ig` = Facebook + Instagram, `linkedin` = SOLO LinkedIn (para tópicos de trabajo/empleo/trabajo remoto), `todas` = las tres, `x` = SOLO X (pensado para política, decisión del usuario 2026-09-21: **esas notas NO se muestran en el portfolio**). El bot lo traduce con `networksFor()` al campo `networks` del payload a Make. Los destinos que no son `x` publican además en `/noticias`; con `x` la nota se guarda igual en Firestore (dedup, tope diario, log del admin) pero con `visibleEnSitio: false`, y `/noticias`, `/noticias/[id]` (404) y `/api/noticias?public=1` la filtran. `GET /api/noticias` sin `?public=1` (log del admin) ahora **exige login de admin** (antes devolvía todo a cualquiera). Para `x` el bot no genera tarjeta, no usa Cloudinary y **no pasa por Make** (Make sacó su módulo de X): publica directo con la API de X (`scripts/xClient.mjs`, OAuth 1.0a, `POST /2/tweets`) el texto de `buildXText()` (la `caption` + el link final del artículo vía Microlink, ≤280 caracteres). Necesita los secrets de GitHub `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` (app de developer.x.com con permisos Read and Write, tokens generados después de darlos). Si X rechaza (cuota/pago) el error queda en `makeError` de la nota como `X: ...`. Sin verificar en una publicación real todavía. **Tope de notas por corrida por tópico** (`maxPorCorrida`, 1-5, default 2 = `MAX_ITEMS_PER_TOPIC`; `itemsPerRunFor()`), siempre dentro del máximo de 5 por corrida. **LinkedIn**: el módulo se había borrado de la rama "Noticia (bot)" de Make el 2026-09-20 porque las capturas recortadas daban vergüenza; con las tarjetas nuevas vuelve, pero segmentado por `destino`. Para que funcione la rama de Make necesita un filtro por `networks.facebook / instagram / linkedin` en cada módulo (FB, IG y LinkedIn en rutas de un Router separado, así un filtro en uno no corta a los otros). **Orden de despliegue**: primero el bot (que manda `networks` real), después Make — el bot viejo mandaba las tres en `true`, y un módulo de LinkedIn filtrado por `networks.linkedin` publicaría TODO en LinkedIn. Esa rama (módulos 50 = Facebook, 52 = Instagram) tiene un handler `builtin:Ignore` en ambos, igual que los módulos de Instagram 32/33 de los otros tipos de post, desde 2026-09-21: sin eso, un fallo de Instagram dejaba una ejecución incompleta que trababa la cola (`sequential: true`, `dlq: false`) y apagaba el escenario. Contra: un fallo de Instagram ya no se ve en el historial de Make. Corre 100% fuera de Vercel — no consume Function Invocations ni toca ninguna ruta `/api/` del sitio. Interruptor general + tope diario opcional desde el admin (tab "Noticias (Bot)", `noticias_config/settings`) — el tope diario limita publicaciones exitosas por día, no corridas; con "sin tope" el script igual respeta el máximo de 5 intentos por corrida, repartidos como máximo 2 por tópico para que roten entre los tópicos activos (`noticias_topics`) — sin ese tope por tópico, uno con mucho volumen de RSS (ej. "inteligencia artificial") se comía todo el cupo de la corrida y los demás tópicos activos nunca se publicaban (bug detectado y corregido 2026-09-18). **Scheduling**: el trigger `schedule` de GitHub Actions se sacó del workflow porque demostró ser poco confiable (llegó a saltear varias horas seguidas sin correr) — el disparo real cada hora lo hace un cronjob externo en cron-job.org pegándole a `POST /repos/.../actions/workflows/noticias-bot.yml/dispatches` con un fine-grained PAT (permiso Actions: Read and write, acotado a este repo). El workflow solo tiene `workflow_dispatch` como trigger.
- **Compras Mood Fit** (`/compras/moodfit`, privada, noindex): copia propia del catálogo de
  WhatsApp Business del proveedor Mood Fit para Johana Belén Reyes (y Mariano). Acceso: `ADMIN_EMAIL`
  + `PROVEEDOR_ALLOWED_EMAILS` (env, separados por coma; hoy `reyesjohanab@gmail.com`), chequeado
  server-side en `src/lib/proveedorAuth.js`. Colecciones `proveedor_productos`, `proveedor_syncs`,
  `proveedor_pedidos` — solo Admin SDK (sin regla = deny al cliente). Precio por mayor = costo (con
  ese se calcula el pedido); el "por menor" de la descripción = **precio sugerido de venta**. Pedido:
  talles con selector (parseados por `src/lib/proveedorParse.js`), color libre, export .xlsx con un
  renglón por producto+talle y fórmulas de subtotal/total (`src/components/proveedor/exportPedido.js`).
  **Sincronizar catálogo** (manual, Claude + extensión de Chrome en la PC de escritorio):
  1. Chrome con WhatsApp Web abierto. Ojo: si WhatsApp está instalado como app de Chrome, las
     pestañas nuevas de web.whatsapp.com se van a la ventana de la app (desactivar "abrir vínculos
     compatibles"). Descargas de Chrome sin "preguntar dónde guardar", carpeta `D:\moodfit` vaciada.
  2. Chat "Mood Fit" → ícono de tienda → Catálogo. El panel es `[data-testid=drawer-right]` y las
     vistas se apilan: la activa es la que tiene su `drawer-title-body` visible (elementFromPoint).
     `element.click()` no abre el detalle de un producto (WhatsApp exige clics reales) pero sí los
     "Ver todo". No hace falta abrir el detalle: la lista trae título, descripción, `ARS` y la foto
     completa (1600px) como `background-image: blob:`.
  3. Recorrer cada colección ("Ver todo") para saber la pertenencia, después "Todos los artículos":
     la lista pagina (puede quedarse en 10 hasta cerrar y reabrir) y está virtualizada — scrollear
     de a ~70% del alto, leer los `[role=listitem]` visibles, bajar cada blob a JPEG 1200px con un
     canvas y descargarlo con `<a download>` (`moodfit-img-NNN.jpg`). Al final descargar
     `moodfit-catalogo.json` = `{ extraidoEn, productos: [{ idx, tituloOriginal, descripcion,
     precioTxt, colecciones, imagenes }] }`. WhatsApp tiene CSP: no se puede hacer fetch a
     Cloudinary/localhost ni usar window.open + postMessage (COOP corta el opener).
  4. `npx tsx --tsconfig jsconfig.json scripts/proveedor-sync.mjs D:/moodfit` (`--dry` para probar):
     sube fotos a Cloudinary `proveedores/moodfit/` (solo si cambió el hash), hace el diff de
     precios, marca `activo:false` lo que desapareció y guarda el log en `proveedor_syncs` (la
     página muestra nuevos / cambios de precio de la última sincronización).
  Primera sincronización 2026-10-19: 430 ítems (421 productos + 9 de info del vendedor).
- **Auth**: Firebase Auth (Google login)
- **Likes + Visitas**: Contadores en Firestore, anonimos con localStorage
- **AI Chatbot**: Integrado en header (Gemini 2.5 Flash)
- **WhatsApp Button**: Flotante en todas las paginas
- **Favicon dinamico**: Emoji segun dia de la semana (Dom😴 Lun😊 Mar😄 Mie🥳 Jue😎 Vie🤩 Sab😁) — script inline en `<head>`, sin archivos ni requests
- **Dark mode**: Persistido en localStorage, aplicado antes del primer render (sin flash)
- **Redirect www → apex**: `next.config.mjs` redirige 301 `www.marianoaliandri.com.ar` → `marianoaliandri.com.ar`
- **SEO**: sitemap.xml con todas las rutas (incluye /auditorias, /presupuesto), robots.txt optimizado para Google e IAs, metadata por pagina con canonical, OG y JSON-LD

---

## Colecciones Firestore

| Coleccion | Uso | Quien escribe |
|-----------|-----|---------------|
| `products` | Precios de compra de servicios | Admin |
| `productos_alquiler` | Seña, cuota, duracionMinima por producto | Admin (seed) |
| `auditorias` | Reportes SEO publicos (con email para admin, sin dir/tel) | `/api/auditorias` POST |
| `presupuestos` | Solicitudes de presupuesto con servicios seleccionados | `/api/presupuesto` POST |
| `proyectos` | Descripcion y orden de proyectos GSC | Admin tab Proyectos |
| `entitlements` | Plan y cuota de busquedas de keywords por usuario | **Solo Admin SDK** (server) |
| `likes` / `visitas` | Contadores anonimos | Client-side |
| `noticias` | Notas publicadas por el bot (título, cuerpo, caption, imagen, estado) | Solo `scripts/noticias-bot.mjs` (GitHub Actions) |
| `noticias_topics` | Tópicos a seguir (activo/inactivo, tono, `usarFoto`, `historia`, `destino`, `maxPorCorrida`) | Admin (tab Noticias) |
| `noticias_config` | Interruptor on/off + tope diario opcional del bot | Admin (tab Noticias) |
| `auditoria_auto` | Config de la auditoría automática (`config`: activo, ciudades, rubros, puntero, candado) | Admin SDK (server) / admin tab |
| `auditoria_auto_runs` | Historial de corridas de la auditoría automática | Admin SDK (server) |
| `ig_prospectos` | Negocios con @ de Instagram a contactar por DM: DM sugerido (Gemini, fallback plantilla), estado (pendiente/contactado/respondio/cliente/descartado), notas. Doc id = handle | Solo Admin SDK vía `/api/ig-prospectos` (admin) y el MCP |
| `email_bajas` | Bajas de los mails a negocios (email + dominios de su web). Permanentes | `/api/email-baja` (link firmado del pie del mail) |
| `mcp_oauth_clients` / `mcp_oauth_codes` / `mcp_oauth_tokens` | OAuth del servidor MCP: clientes DCR, códigos y tokens (solo el sha256). Borrar un doc de tokens = cortar ese acceso | Solo Admin SDK |
| `mcp_lead_jobs` | Búsquedas de leads lanzadas por el MCP (progreso + leads) | Solo Admin SDK |
| `mcp_email_drafts` / `mcp_email_counter` / `mcp_email_locks` | Borradores de mails del MCP (TTL 7 días), contador del tope diario y candado por negocio (email/dominio, último envío) que evita mails duplicados | Solo Admin SDK |
| `ig_stories` | Registro de cada historia publicada desde el admin o el MCP (`origen`, `storyId` o `error`) | Solo Admin SDK |
| `mcp_social_counter` | Contador diario de publicaciones en redes hechas desde el MCP (tope `MCP_SOCIAL_DAILY_CAP`) | Solo Admin SDK |
| `demanda_auto` / `demanda_auto_runs` | Config de los informes de demanda (activo, zonas, ultimaCorrida, ultimoReporte, candado) y log de corridas | Admin SDK (server) / admin |
| `demanda_reportes` | Informes públicos de /demanda (zona, localidades, provincias, top 20 con porLocalidad, ejemplos y cambio) | Solo Admin SDK |
| `alertas` | Una por clave de alerta: último envío, total y repeticiones suprimidas (tope 1 mail/hora) | Solo Admin SDK (`src/lib/alert.js`) |
| `mcp_rate` / `mcp_tool_calls` | Rate limiting y registro de cada llamada a una tool del MCP | Solo Admin SDK |

**IMPORTANTE `entitlements/{uid}`**: el cliente NO puede escribirla (regla `write: if false`).
El plan y el contador de busquedas solo los escribe el Admin SDK desde el server. Esto evita que
un usuario se auto-asigne un plan o resetee su cuota. Ver `src/lib/entitlements.js`.

---

## Decisiones de arquitectura importantes

### Carga diferida de Firebase (providers.jsx)
`AuthButton`, `LikeSystem`, `VisitorCounter`, `AIChatBot` usan
`dynamic()` con `ssr: false`. Esto evita que `auth/iframe.js` de Firebase (90 KiB)
entre en el critical render path. Mejora LCP significativamente. **No revertir.**

### Preconnects en layout.jsx
Se preconectan Firebase, googleapis, firestore y Cloudinary para ahorrar ~900ms en
la negociacion TCP/TLS. **No eliminar.**

### API Routes en lugar de Netlify Functions
El proyecto migro de Netlify a Vercel. Todas las funciones serverless viven en
`src/app/api/` como Route Handlers de Next.js. **No crear Netlify Functions.**

### firebase-admin.js — init lazy con reintento
`src/lib/firebase-admin.js` usa `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y
`FIREBASE_PRIVATE_KEY` (vars individuales). La inicializacion corre a nivel de modulo
pero `getDb()` reintenta si `admin.apps.length === 0` (puede ocurrir en cold start
de server components durante build). Este patron evita los 404 con "no outgoing requests".
**NO usar self-fetch HTTP desde server components para leer Firestore** — usar `getDb()` directo.

### Server components leen Firestore directo
Las paginas `/auditorias/page.jsx` y `/auditorias/[id]/page.jsx` usan `getDb()` directamente.
Antes usaban `fetch(url_propia)` lo que causaba 404 intermitentes (el fetch HTTP fallaba
antes de que el deploy estuviera listo). Regla: server components → Firebase Admin directo.

### Paginas publicas con ISR (Active CPU de Vercel, desde 2026-10-15)
`/auditorias` (1 h), `/noticias` (15 min), `/auditorias/[id]`, `/noticias/[id]` (24 h) y
`/proyectos/[domain]` (6 h) usan `export const revalidate` + `generateStaticParams() { return [] }`
en vez de `force-dynamic`: antes corrian una funcion (Firestore + GSC) en cada visita/crawl y se
comian el cupo de Active CPU compartido entre todos los proyectos de la cuenta. `/api/proyectos`
(sin `all=1`) y `/api/noticias?public=1` devuelven `Cache-Control: s-maxage`. Las escrituras del
admin (`/api/auditorias`, `/api/proyectos`, `/api/proyectos/media`) llaman `revalidatePath`.
Los fetchers tiran el error en vez de devolver vacio (`src/lib/isr.js`): asi Next conserva la
ultima version buena. **No volver a `force-dynamic` en paginas publicas.**

### Dark mode sin flash
Script sincrono en `<head>` aplica la clase `dark` antes de que React hidrate.
El script en providers.jsx desregistra el Service Worker viejo de Netlify.

### ProyectosGrid — GSC dinamico sin hardcodeo
`src/components/ProyectosGrid.jsx` muestra los proyectos del portfolio con stats
reales de GSC (clicks + impresiones). La lista de sitios viene de `sites.list()` de
Search Console via `src/lib/gscClient.js` — **no hay array hardcodeado en ninguna ruta**.
Las descripciones y orden se editan desde el panel Admin tab "Proyectos" y se guardan en
Firestore (coleccion `proyectos`, doc por dominio). Los screenshots usan Microlink API
como `<img src>` directo (CDN cachea 24h). **No agregar arrays de dominios hardcodeados.**

### Cloudinary con srcSet responsive
`CloudinaryImage` genera srcset con [400, 800, 1200, 1920]w. **No usar el Carrousel
viejo** — fue reemplazado por ProyectosGrid.

### GEMINI_API_KEY — API key sin restricciones
La key de Google Cloud (proyecto MarianoAliandri) no tiene restricciones de aplicacion
ni de API. Esto es necesario porque las llamadas vienen del servidor de Vercel sin
HTTP Referer. Se usa para Gemini, Google TTS y como fallback de NEXT_PUBLIC_FIREBASE_API_KEY.
**Si Google la bloquea por leak**: crear nueva key en Google Cloud → Credenciales →
actualizar GEMINI_API_KEY y NEXT_PUBLIC_FIREBASE_API_KEY en Vercel → redeploy.

### Upload de reels — browser → Cloudinary directo
El video se graba en el browser (WebM via MediaRecorder) y se sube directamente a
Cloudinary desde el cliente (sin pasar por Vercel) para evitar el limite de 4.5MB
de las serverless functions. Luego se envia solo el videoUrl al servidor via
`/api/upload-reel`. Cloudinary convierte a MP4/H264 on-the-fly con la URL transformada.

### Resend — email outreach desde admin
Resend (`RESEND_API_KEY`) envia emails de prospeccion a negocios auditados.
Dominio `marianoaliandri.com.ar` verificado con DKIM + SPF en Resend.
**NO activar "Enable Receiving"** en Resend (agrega MX record que rompe Zoho Mail).
Reply-to siempre apunta a `yo@marianoaliandri.com.ar`.
El HTML del email incluye un botón "Escribime por WhatsApp" (`wa.me/5492995414422`,
mensaje pre-cargado) ademas del screenshot del sitio y el badge de Score SEO.

---

## Que NO tocar o romper

- **`trailingSlash: true` en `next.config.mjs` + WEBHOOKS**: Next.js responde **308 redirect**
  a cualquier POST sin barra final (`/api/x` → `/api/x/`). Los webhooks externos NO reenvian el
  POST al seguir el redirect → quedan como Failed con body `Redirecting...`. **Regla: toda URL de
  webhook registrada en un servicio externo (Resend, MercadoPago, Make.com) DEBE terminar en `/`.**
  Ya paso con Resend (`/api/resend-webhook/`). Aplica igual a `/api/subscription-webhook/` y a
  `/api/gumroad-webhook/` (Ping de Gumroad).

- **`trailingSlash: true` + segmentos dinamicos con punto (dominios)**: Next.js trata cualquier
  segmento de ruta que contenga un punto (ej. `marianoaliandri.com.ar`) como si fuera un archivo,
  y hace lo **opuesto** al resto del sitio: en vez de agregar la barra final, la saca con un 308.
  Pasa en `/proyectos/[domain]/page.jsx` — el canonical, el schema breadcrumb y los links desde
  `ProyectosGrid.jsx` apuntan a `/proyectos/{domain}` **sin** barra final a proposito. Si se agrega
  otra ruta dinamica cuyo parametro pueda contener un punto, aplica la misma regla.

- **NO usar una cuenta de servicio de Google para escribir en Google Drive personal**: las cuentas
  de servicio no tienen cuota de almacenamiento propia — pueden *leer* una carpeta que se les
  comparta (`drive.files.get` funciona) pero **no pueden crear/actualizar archivos** ahi salvo que
  sea una Shared Drive de Google Workspace (Mariano tiene Gmail personal, no Workspace). Se
  confirmo con una llamada real y se abandono el intento — ver
  `docs/superpowers/specs/2026-09-15-drive-screenshot-sync-design.md`. La alternativa real (si se
  necesita algo asi) es OAuth delegado a la cuenta real del usuario, no una cuenta de servicio.

- **Buscador de Keywords / Analitica — enforcement server-side**: el limite de busquedas se
  aplica en `/api/keyword-explorer` (verifica idToken con `src/lib/authServer.js` + consume cuota
  atomica en `src/lib/entitlements.js`). NUNCA confiar solo en el cliente. La coleccion
  `entitlements/{uid}` es `write: if false` en las reglas — solo el Admin SDK la escribe. El plan
  y cuota NO van en `users/{uid}` (que si es escribible por el dueño).

- **`src/app/layout.jsx` — dark mode script**: el script inline en `<head>` es
  intencional para evitar FOUC. No moverlo ni eliminarlo. Tambien contiene el favicon
  dinamico por dia de semana (script inline, sin archivos).

- **`src/app/providers.jsx` — dynamic imports**: los componentes Firebase como
  `AuthButton`, `LikeSystem`, etc. DEBEN ser `dynamic()`. Si se vuelven a importar
  estaticamente, Firebase vuelve al critical path y el LCP empeora ~2 segundos.

- **firebase-admin.js — NO mover init al modulo sin reintento**: el `getDb()` actual
  reintenta la inicializacion si falla en cold start. Si se simplifica sin ese reintento,
  vuelven los 404 intermitentes en las paginas de auditorias.

- **Auditorias — NO usar self-fetch**: `/auditorias/page.jsx` y `/auditorias/[id]/page.jsx`
  deben leer Firestore con `getDb()`, no con `fetch('/api/auditorias')`. El self-fetch
  causaba 404 intermitentes confirmados en Vercel logs.

- **DNS de Zoho Mail en Vercel**: hay 3 registros MX (mx.zoho.com prio 10/20/50) y
  un SPF record. No eliminarlos o los emails del dominio dejan de funcionar.
  **Tampoco agregar MX de Resend Inbound** — rompe los MX de Zoho.

- **Variables de entorno con `\n`**: `MERCADOPAGO_ACCESS_TOKEN`, `GOOGLE_PLACES_API_KEY`
  y `SHOTSTACK_API_KEY` fueron corregidos con `printf`. Si se re-setean en bash, SIEMPRE usar
  `printf "VALUE" | vercel env add VAR production` — nunca `echo`.
  Variables que aun pueden tener `\n`: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
  `PEXELS_API_KEY`.

- **Rutas de herramientas**: `/ats`, `/roi`, `/web`, `/kpi`, `/radarweb`, `/stats`
  son paginas reales con metadata SEO. Los modales se abren desde el home pero
  cada herramienta tiene su propia URL compartible.

- **`src/lib/gscClient.js`**: Unico lugar donde se define auth y `getVerifiedSites()`.
  Ambas rutas (`/api/proyectos` y `/api/search-console`) lo importan. No duplicar
  la logica de sites.list() en otro lugar.

- **`src/components/ProyectosGrid.jsx`**: Reemplaza al Carrousel. No restaurar el
  componente `Carrousel` en `page.jsx`.

- **Coleccion `productos_alquiler`**: NO mezclar con `products`. Son colecciones
  separadas. `products` tiene precios de compra. `productos_alquiler` tiene seña,
  cuota y duracionMinima. El fetch se hace server-side via `/api/rental-data/[id]`
  para evitar problemas de reglas de seguridad de Firestore.

- **SocialPublisher → Make.com**: el webhook es `https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi`.
  El payload usa campos `text`, `networks`, `type`, `useAI`, `aiProvider`, `imageUrl`.
  NO cambiar nombres de campos — el router de Make.com depende de ellos.
  La ruta `/api/generate-social-caption` NO existe (fue creada y eliminada).

- **CanvasReelGenerator → Make.com**: usa el mismo webhook `574hhr7jtxm2rsn52ntkghpxohcdhjvi`.
  El payload del reel incluye `metadata.videoUrl` (MP4 Cloudinary) para compatibilidad
  con los modulos de Instagram/LinkedIn en Make.com que mapean ese campo.
  `type: 'reel'` es lo que routea al modulo de Instagram Reels en el Router de Make.

- **Bot de noticias — contrato con Make**: el payload que manda `scripts/noticias-bot.mjs` al webhook de Make usa `type: 'noticia'` — necesita su propia rama en el Router (igual patrón que `type: 'reel'` y `zone_analysis`), configurada a mano en Make, no en código. El script vive en `scripts/`, corre en GitHub Actions con sus propios secrets (duplicados de los de Vercel, cargados aparte en GitHub → Settings → Secrets) — **nunca** llama a rutas `/api/` del sitio. Si se cambian los nombres de variables de entorno que lee el script (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GEMINI_API_KEY`, `GEMINI_API_KEY_1..3`, `GROQ_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`, `MAKE_WEBHOOK_URL`), hay que actualizar `.github/workflows/noticias-bot.yml` y los secrets de GitHub en el mismo cambio.

- **Modelo Gemini**: usar `gemini-3.8-flash` en todas las rutas. `gemini-2.0-flash`
  ya no esta disponible para nuevos usuarios.

- **No hay contraseñas hardcodeadas**: las API routes que antes tenian
  `process.env.ADMIN_PASSWORD || 'hardcoded'` fueron corregidas. Solo usar env vars.

- **Lead Finder — cobro por lead**: la regla de lead se decide en el server
  (`/api/lead-finder-pro/run` usa `clasificarLead`); nunca mover esa decisión al cliente. Cada
  lead tiene `ciudad`, `canal` y `whatsapp`; el `seen` del motor evita duplicados entre ciudades.

---

## Servidor MCP (desde 2026-10-26)

Las herramientas del sitio expuestas como **servidor MCP remoto** para usarlas desde Claude
(claude.ai, Desktop/Cowork, celular) como "conector personalizado". Diseño y decisiones:
`docs/superpowers/specs/2026-10-26-mcp-server-design.md`.

- **Endpoint**: `https://marianoaliandri.com.ar/api/mcp/mcp/` — **con barra final** (sin barra,
  `trailingSlash: true` responde 308 y el POST no llega). `src/app/api/mcp/[transport]/route.js`,
  `mcp-handler@2` + `@modelcontextprotocol/server@2`, Streamable HTTP, `maxDuration = 800` (Pro + Fluid).
- **Auth**: OAuth 2.1 propio (`src/lib/mcp/oauth.js`): DCR en `/api/mcp-oauth/register/`, pantalla
  `/mcp/authorize/` (login de Google de Firebase, **solo `ADMIN_EMAIL` con email verificado**),
  `/api/mcp-oauth/token/` (form-urlencoded, PKCE S256, access 1 h, refresh 30 días rotativo; reusar un
  refresh viejo revoca la familia). Metadata en `/.well-known/oauth-protected-resource/` y
  `/.well-known/oauth-authorization-server`. Redirects permitidos: callbacks de claude.ai/claude.com y
  loopback (Claude Code, MCP Inspector). En Firestore solo va el sha256 de códigos y tokens.
- **Interruptor**: sin `MCP_ENABLED=true` el endpoint y el OAuth responden 503.
- **Frenos (todos en el servidor)**: rate limit por usuario (`MCP_RATE_PER_MIN`=60,
  `MCP_RATE_PER_DAY`=1500); Places: tope diario propio `MCP_PLACES_DAILY_CAP`=150 (campo `mcpPlaces`
  en `leadfinder_usage`) y corte si un SKU del mes pasa el 90 % del cupo gratis
  (`src/lib/mcp/placesBudget.js`); mails: lista de bloqueo (bajas + rebotes, aplica también al botón del
  admin), no volver a escribirle a un negocio (por email o dominio) antes de `MCP_EMAIL_RECONTACT_DAYS`=30,
  tope `MCP_EMAIL_DAILY_CAP`=15 (`src/lib/emailGuards.js`). El texto de Gemini se valida antes de mandar
  (`validateGeneratedEmail`); si no pasa, sale la plantilla. Todos los mails a negocios llevan link de baja
  firmado (`/baja/`, `EMAIL_UNSUBSCRIBE_SECRET`: sin esa env var el envío falla).
- **Nada de secretos**: cada respuesta pasa por `redactSecrets()` (`src/lib/mcp/redact.js`) y los errores
  internos salen como "Error interno"; `src/lib/mcp/noSecrets.test.js` corre todas las tools con
  valores centinela en las env vars.
- **Registro**: cada llamada queda en `mcp_tool_calls` (tool, ok, ms, args resumidos).
- **Tools** (27): presupuestos (desde 2026-10-28, `tools/presupuestos.js` + `src/lib/presupuestos.js`):
  `list_budget_requests`, `get_budget_request`, `quote_budget_request` (monto + link de MercadoPago con
  `metadata.type: 'presupuesto'`; devuelve `whatsappUrl` con el mensaje escrito, no le escribe al cliente; `dry_run`) y
  `set_budget_status`. Cuando ese link se paga, `payment-webhook` llama `registrarPagoPresupuesto` (suma el pago a
  `payments`, estado `accepted`) y manda un mail con `sendAlert`. Demanda (`tools/demanda.js`): `list_demand_reports`,
  `get_demand_report`, `run_demand_report` (`publicar` default false; si es true usa el tope social) y `save_demand_zone`
  (valida contra `PROVINCIAS_AR` sin acentos). `get_automation_status` (`tools/status.js`): noticias 24 h, auditoría
  automática, demanda, presupuestos pendientes y últimas alertas. Además: `search_leads` (asíncrona: crea un job en `mcp_lead_jobs` y sigue con `after()`),
  `get_lead_search`, `list_lead_searches`, `rank_rubros_by_demand`, `list_audits`, `get_audit`,
  `create_audit_report`, `publish_audit_social` (`dry_run`), `draft_business_email`,
  `send_business_email` (`dry_run`), `list_sent_emails`, `list_ig_prospects`, `update_ig_prospect`
  (no manda DMs), `get_places_usage`, `get_site_stats`, `publish_free_post` (Publicación Libre vía Make: texto +
  0-10 imágenes por URL o `tarjeta_titulo`; 2+ = carrusel solo FB+IG; `dry_run`) y `publish_ig_story` (historia
  texto/imagen/video directo por Graph API; `dry_run` devuelve `preview_url` y se publica pasando ese mismo
  `preview_url`). Las imágenes externas se suben a Cloudinary (`src/lib/cloudinaryServer.js`). Las dos comparten
  el tope `MCP_SOCIAL_DAILY_CAP`=10 por día (`src/lib/mcp/socialCap.js`, colección `mcp_social_counter`).
- **Lógica compartida con la UI** (no duplicar): `src/lib/leadFinderPro.js`, `leadSearchesStore.js`,
  `leadDemand.js`, `leadSearch.js` (`reduceLeadEvent`), `auditReportDraft.js`, `imageCheck.js`,
  `makeSocial.js`, `bizEmail.js`, `emailGuards.js`, `igProspectosStore.js`, `siteStats.js`, `freePost.js`
  (mismo payload que Publicación Libre del admin, `makeService.js` usa su `carouselFields`), `igStory.js`.

**Cómo sumar una tool nueva**
1. Si la lógica vive en una ruta o un componente, sacarla primero a una función de `src/lib/` y hacer
   que la ruta/pantalla la use (con su test).
2. En `src/lib/mcp/tools/<grupo>.js`, `defineTool({ name, title, description, inputSchema, annotations, handler })`:
   nombre en `snake_case`; descripción en español pensada para un LLM (qué hace, cuándo usarla, si cuesta
   plata o tiene efectos afuera); `inputSchema: z.object({...})` con `.describe()` por campo; listas con
   `cursor`/`limit` y respuesta `{ items, nextCursor }` (`src/lib/mcp/paginate.js`); `annotations`
   (`readOnlyHint`, `openWorldHint`…). El handler recibe `(args, { db, user, now })` y devuelve
   `{ summary, data }`; errores para Claude con `throw new ToolError('...')`. Devolver campos elegidos a
   mano, nunca el doc crudo. Si tiene efectos afuera, agregar `dry_run`.
3. Agregarla a `ALL_TOOLS` en `src/lib/mcp/register.js` y a `ARGS` en `src/lib/mcp/noSecrets.test.js`
   (el test falla si hay una tool sin argumentos de ejemplo).
4. Test propio junto a la tool + `npm test` + probarla con
   `npx @modelcontextprotocol/inspector --cli http://localhost:3000/api/mcp/mcp/ --transport http --header "Authorization: Bearer <token>" --method tools/call --tool-name <tool>`.
   Para probar en local: `MCP_ENABLED=true MCP_BASE_URL=http://localhost:3000 npm run dev`.
5. Si agrega un query con `where` + `orderBy` en campos distintos, Firestore pide un índice compuesto:
   preferir filtrar en memoria si la colección es chica (pasó con `list_ig_prospects`).

---

## Tests y CI (desde 2026-09-19)

- **Vitest** (`vitest.config.mjs`, alias `@` → `src/`). Correr local: `npm test`
  (= `vitest run`). Los archivos de test viven junto al código que prueban
  (`*.test.js`), no en una carpeta `__tests__` separada.
- Cobertura actual, enfocada en los flujos de plata (el resto del repo sigue sin tests):
  - `src/lib/mpWebhook.test.js` — firma HMAC de webhooks de MercadoPago (función pura,
    sin mocks).
  - `src/app/api/lead-finder-pro/run/route.test.js` — gate de créditos (401 sin auth,
    acciones gratis sin tocar Firestore, 402 sin plan, descuento de crédito, caché de
    auditorías ya hechas). Usa un Firestore fake en memoria (`createFakeDb`, colecciones/
    docs por path string) en vez de mockear cada llamada — reusar ese patrón para el
    próximo test de un flujo con transacciones de Firestore.
- **`.github/workflows/ci.yml`**: corre en cada push/PR a `main` — `npm test` +
  `npm run build`. `npm run build` pasa sin ninguna env var seteada (firebase-admin.js
  tolera credenciales ausentes en build time, ver seccion de abajo), así que el workflow
  no necesita secrets. Si el build alguna vez empieza a requerir una env var real,
  agregarla como secret de GitHub igual que se hizo para `scripts/noticias-bot.mjs`.
- **Pendiente** (no implementado todavía): tests de `/api/subscribe` y
  `/api/payment-webhook`/`/api/subscription-webhook` end-to-end (hoy solo está probada
  la validación de firma, no el flujo completo de acreditación).

---

## ZoneAnalysis — Funcionalidades implementadas

Componente: `src/components/admin/ZoneAnalysis.jsx`
API Caption: `src/app/api/zone-caption/route.js`

### HeatmapPanel
- Componente inline de 600px capturado como imagen social (reemplaza Google Maps URL que Meta bloquea)
- Muestra grilla horaria con colores por congestion (LOW=verde, MEDIUM=amarillo, HIGH=rojo)
- Incluye concentracion de trafico por periodos (Manana/Mediodia/Tarde/Noche)
- Muestra dimensiones de la zona en cuadras (formula Haversine, 100m/cuadra estandar argentino)

### Cloudinary upload
- Upload preset: `zone_analysis_images` (Unsigned, confirmado que existe)
- Conversion: `atob()` → `Uint8Array` → `Blob` (mas confiable que fetch de dataUrl)
- Las capturas se hacen SECUENCIALMENTE (no en paralelo) para evitar race condition de re-render

### Payload Make.com para zone_analysis
```js
imageUrl: heatmapImageUrl || result.map_image_url,  // imagen principal
chartImageUrl: chartImageUrl,                         // grafico de barras
images: [heatmapImageUrl, chartImageUrl].filter(Boolean),  // array para Router 2
```

### Make.com Router 2 (PENDIENTE — el usuario debe configurar manualmente)
Para publicar 2 imagenes en Facebook/LinkedIn para posts de zone_analysis:
- Agregar Router 2 con filtro `type` = `zone_analysis`
- Branch 1: Facebook → modulo "Upload a Photo" con `images[0]` y `images[1]`
- Branch 2: LinkedIn → modulo con ambas imagenes

---

## Comandos utiles

```bash
# Desarrollo local
npm run dev

# Deploy a produccion (flujo normal via GitHub)
git add . && git commit -m "feat/fix: descripcion" && git push
# Vercel detecta el push y deploya automaticamente a marianoaliandri.com.ar

# Deploy de emergencia sin commitear (bypass de GitHub)
vercel --prod

# Ver logs de Vercel
vercel logs marianoaliandri.com.ar

# Gestionar DNS
vercel dns ls marianoaliandri.com.ar
vercel dns add marianoaliandri.com.ar @ TXT "valor"

# Variables de entorno en bash (SIEMPRE con printf, nunca echo)
printf "VALUE" | vercel env add VAR_NAME production
vercel env ls

# Variables de entorno en PowerShell (Windows)
vercel env rm VAR_NAME production
vercel env add VAR_NAME production

# Deployar reglas de Firestore (firebase.json + .firebaserc ya configurados,
# proyecto marianoaliandri-3b135). Requiere login previo: firebase login
firebase deploy --only firestore:rules
```

**PATH del CLI en Windows**: `gh` y `firebase` se instalan con winget pero la sesión de
terminal actual no ve el PATH actualizado hasta reiniciarla. Si da "command not found",
refrescar en la misma ventana con:
```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

---

## Browser Automation
Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Notas de este entorno (Windows):
- El binario global está en `C:\Users\maria\AppData\Roaming\npm` (no está en el PATH de Git Bash).
  En Bash: `export PATH="/c/Users/maria/AppData/Roaming/npm:$PATH"` antes de usarlo.
- Chromium instalado en `C:\Users\maria\.agent-browser\browsers`.
- La skill para Claude Code está en `.claude/skills/agent-browser`.
- Flujo típico: `agent-browser open <url>` → `agent-browser snapshot -i` → `agent-browser close`.
  Usar URLs con `https://` (sin esquema puede fallar el DNS).

---

## Agent Skills activas

Instaladas en `.claude/skills/` (ver con `npx skills list`):

- **frontend-design** (Anthropic): usar al crear/rediseñar UI — evita el look AI-generated.
- **vercel-react-best-practices** (Vercel): convenciones de routing, data fetching y performance en Next.js/React.
- **web-design-guidelines** (Vercel): revisar UI contra Web Interface Guidelines (accesibilidad, UX).
- **vercel-optimize** (Vercel): costos/perf en Vercel — Core Web Vitals, rutas lentas, caching, Function Invocations.
- **core-web-vitals** (addyosmani): técnicas para LCP / INP / CLS.
- **seo** (addyosmani): SEO técnico — metadata, structured data, sitemap.
- **firebase-security-rules-auditor** (Firebase oficial): auditar reglas de Firestore/Storage.
- **agent-browser**: automatización de navegador (ver sección Browser Automation).
- **programmatic-seo, schema, cro, copywriting, pricing** (coreyhaines31/marketingskills, desde 2026-10-27): landings a escala (`/ia-para/`), datos estructurados, conversión, textos de venta y precios.

MCP del proyecto (`.mcp.json`): **mercadopago** y **firebase** (`firebase mcp`, usa el login del CLI; en Windows va por `cmd /c` y necesita `npm i -g firebase-tools`; tarda ~10 s en arrancar). Para consultar Firestore preferir el MCP de Firebase antes que un script con Admin SDK.

No instaladas en `.claude/skills/` (vienen del plugin `make-skills`, ya disponible en esta cuenta) pero
en uso seguido en este repo para el escenario de Make.com del bot de noticias y del publicador de redes:

- **make-skills:make-scenario-building** — qué módulos usar y por qué al diseñar o modificar un escenario (routers, filtros, ramas).
- **make-skills:make-module-configuring** — cómo configurar cada módulo (conexiones, mapeo de datos, IML).
- **make-skills:make-mcp-reference** — referencia del servidor MCP de Make (conexión, scopes, troubleshooting).

Reglas:
- Para UI nueva o rediseño → aplicar **frontend-design** (no que parezca templated).
- Para código React/Next → seguir **vercel-react-best-practices** (routing, data fetching, Server/Client Components).
- El stack de datos es **Firebase** (Auth + Firestore), NO Supabase. Las reglas de seguridad se auditan con **firebase-security-rules-auditor**.
- Antes de agregar skills nuevas: `npx skills find <tema>` y verificar install count (preferir 1K+ installs y fuentes reputadas).
