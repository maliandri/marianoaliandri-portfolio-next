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
| Framework | Next.js 15 (App Router) |
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
    auditorias/         # Paginas publicas de auditorias SEO (server components, force-dynamic)
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
    LeadFinderPanel.jsx # Lead finder multi-ciudad con progreso, log, CSV, publicar a Firestore
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
  schemas/              # firebaseSchemas.js
  data/
    products.js         # Catalogo estatico de productos (IDs canonicos, fallback)
    localidadesAR.js    # PROVINCIAS_AR: 24 provincias con localidades para el Lead Finder
    linkedinPosts.js    # Posts de LinkedIn hardcodeados
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

# LinkedIn OAuth
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

# Email outreach
RESEND_API_KEY                      ← Para /api/auditorias/send-biz-email
                                       From: notificaciones@marianoaliandri.com.ar (DKIM verificado)
                                       Reply-To: marianoaliandri@gmail.com

# Terceros
PEXELS_API_KEY
SHOTSTACK_API_KEY
MUBERT_API_KEY                      ← Opcional. Sin esta var usa fallback de Cloudinary

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
- **Lead Finder** (admin — multi-ciudad):
  - Selector provincia → localidad con tags (agregar/quitar ciudades)
  - Itera cada ciudad secuencialmente via Google Places API + scraping de emails
  - Cada negocio tiene campo `ciudad`; `seenIds` evita duplicados entre ciudades
  - Barra de progreso muestra ciudad actual
  - Exporta CSV con columna Ciudad
  - Boton "Publicar Reporte": guarda en Firestore coleccion `auditorias` + llama a Gemini para resumen
- **Auditorias** (`/auditorias`):
  - Listado publico de reportes SEO (`/auditorias`) — server component, lee Firestore directo
  - Detalle de reporte (`/auditorias/[id]`) — full width, tabla ordenable por columna
  - Tabla publica NO muestra email/telefono/direccion (privacidad)
  - Admin tab "Auditorias": lista/elimina, expande detalle con email visible
  - Boton "✉ Enviar" por negocio: Gemini genera email personalizado → Resend lo envia
    - From: `Mariano Aliandri <notificaciones@marianoaliandri.com.ar>`
    - Incluye screenshot del sitio via Microlink + score SEO badge
    - Texto generado es editable (se muestra en <details> tras envio)
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
- **Admin** (`/admin`): Panel interno con tabs: Stats, Productos, Publicar Redes, Reels, Proyectos GSC, Auditorias, Presupuestos
- **Publicador de redes** (admin): envia POST a Make.com → Make llama a Gemini y publica en LinkedIn/Instagram/Facebook. Logos de servicios en Cloudinary (`service-logos/`)
- **Generador de reels Canvas** (admin): flujo de 5 pasos:
  1. Seleccion de contenido (Producto / Tecnologia / Proyecto)
  2. Script generado por Gemini 2.5 Flash (`/api/reel-script`) — editable, max 60 palabras
  3. Audio: musica por mood via Mubert o fallback Cloudinary (`/api/reel-music`) + voz Google TTS (`/api/reel-tts`, voz `es-AR-Standard-B`)
  4. Visual: fondo degradado (5 temas), efecto de texto (6 opciones), duracion 15/30s
  5. Grabacion: canvas 1080x1920 → WebM → Cloudinary (transformacion f_mp4,vc_h264,ac_aac) → Make.com webhook
  - Subtitle muestra CTA a la tienda (no precios) para productos
  - Mezcla de audio: voz volumen 1.0 + musica volumen 0.25 via Web Audio API
- **Auth**: Firebase Auth (Google login)
- **Likes + Visitas**: Contadores en Firestore, anonimos con localStorage
- **AI Chatbot**: Integrado en header (Gemini 2.5 Flash)
- **LinkedIn Sidebar**: Feed de posts de LinkedIn
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

**IMPORTANTE `entitlements/{uid}`**: el cliente NO puede escribirla (regla `write: if false`).
El plan y el contador de busquedas solo los escribe el Admin SDK desde el server. Esto evita que
un usuario se auto-asigne un plan o resetee su cuota. Ver `src/lib/entitlements.js`.

---

## Decisiones de arquitectura importantes

### Carga diferida de Firebase (providers.jsx)
`AuthButton`, `LikeSystem`, `VisitorCounter`, `AIChatBot`, `LinkedInSidebar` usan
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
Reply-to siempre apunta a `marianoaliandri@gmail.com`.

---

## Que NO tocar o romper

- **`trailingSlash: true` en `next.config.mjs` + WEBHOOKS**: Next.js responde **308 redirect**
  a cualquier POST sin barra final (`/api/x` → `/api/x/`). Los webhooks externos NO reenvian el
  POST al seguir el redirect → quedan como Failed con body `Redirecting...`. **Regla: toda URL de
  webhook registrada en un servicio externo (Resend, MercadoPago, Make.com) DEBE terminar en `/`.**
  Ya paso con Resend (`/api/resend-webhook/`). Aplica igual a `/api/subscription-webhook/`.

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

- **Modelo Gemini**: usar `gemini-2.5-flash` en todas las rutas. `gemini-2.0-flash`
  ya no esta disponible para nuevos usuarios.

- **No hay contraseñas hardcodeadas**: las API routes que antes tenian
  `process.env.ADMIN_PASSWORD || 'hardcoded'` fueron corregidas. Solo usar env vars.

- **Lead Finder — campo `ciudad`**: cada resultado del scraping tiene `neg.ciudad`.
  El CSV exportado tiene columna Ciudad. El `seenIds` Set persiste entre ciudades para
  evitar duplicados. No quitar el campo `ciudad` del objeto `neg`.

---

## Oracle Cloud VM — OpenWA (WhatsApp gateway)

### VM Oracle Cloud Always Free
- **Instancia**: `instance-20260526-1004`
- **IP publica**: `146.235.244.218` (Efimera — si se pierde, reasignar desde VNIC → Administracion de IP)
- **IP privada**: `10.0.0.9`
- **Region**: Chile Central (Santiago) — `sa-santiago-1`
- **Shape**: VM.Standard.E2.1.Micro (1 OCPU, 1 GB RAM) — Always Free
- **OS**: Oracle Linux 9
- **SSH key**: ⚠️ ACTUALIZAR RUTA — cambio de PC. Nombre del archivo: `ssh-key-2026-05-26.key`
- **Usuario SSH**: `opc`

**Comando SSH** (actualizar ruta de la key segun nueva PC):
```powershell
ssh -i "RUTA_A_LA_KEY\ssh-key-2026-05-26.key" opc@146.235.244.218
```

### Plan de instalacion OpenWA
OpenWA es un gateway HTTP self-hosted de WhatsApp Web (NestJS + PostgreSQL + Docker).
Permite enviar mensajes de WhatsApp desde el portfolio/admin via HTTP, sin riesgo de ban
porque usa la sesion real del browser (no API oficial).

**Stack decidido**:
- Oracle Cloud VM (arriba) → corre OpenWA via Docker Compose
- Supabase PostgreSQL → base de datos de OpenWA (free tier, sin sleep)
- Next.js `/api/whatsapp-notify` → ruta para enviar mensajes desde el admin
- Vercel cron job → ping keep-alive cada 14 minutos para evitar sleep de Supabase

**Estado actual**: VM creada y con IP publica. Instalando Docker.

**Pasos pendientes**:
1. Instalar Docker en Oracle VM: `sudo dnf install -y docker`
2. Habilitar Docker: `sudo systemctl enable --now docker`
3. Instalar Docker Compose
4. Crear proyecto `openwa` en Supabase, obtener PostgreSQL connection string
5. Clonar OpenWA, configurar `.env` con DATABASE_URL de Supabase
6. `docker-compose up -d`
7. Escanear QR con WhatsApp
8. Crear `/api/whatsapp-notify` en Next.js
9. Agregar cron keep-alive en Vercel

### Firewall Oracle Cloud
**IMPORTANTE**: Oracle Cloud bloquea puertos por defecto. Para exponer OpenWA (puerto 3000):
1. Oracle Console → VCN → Security Lists → Ingress Rules → Add rule TCP port 3000
2. Tambien en Oracle Linux: `sudo firewall-cmd --add-port=3000/tcp --permanent && sudo firewall-cmd --reload`

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

Reglas:
- Para UI nueva o rediseño → aplicar **frontend-design** (no que parezca templated).
- Para código React/Next → seguir **vercel-react-best-practices** (routing, data fetching, Server/Client Components).
- El stack de datos es **Firebase** (Auth + Firestore), NO Supabase. Las reglas de seguridad se auditan con **firebase-security-rules-auditor**.
- Supabase solo aparece en el plan futuro de OpenWA (Oracle VM). Si se implementa, recién ahí agregar `supabase/agent-skills@supabase`.
- Antes de agregar skills nuevas: `npx skills find <tema>` y verificar install count (preferir 1K+ installs y fuentes reputadas).
