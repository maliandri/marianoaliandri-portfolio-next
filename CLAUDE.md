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
| Framework | Next.js 16.1.6 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Animaciones | Framer Motion 12 |
| Estado servidor | TanStack Query 5 |
| Auth + DB | Firebase 12 (Auth + Firestore) |
| Imagenes | Cloudinary |
| Pagos | MercadoPago |
| AI | Google Gemini 2.0 Flash |
| Email | Zoho Mail (dominio propio) + Nodemailer |
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
      chat/             # AI chatbot (Gemini)
      create-payment/   # MercadoPago — crea preferencia de pago
      cv-payment/       # Pago por analisis de CV
      lead-finder/      # Google Places + scraping de emails
      publish-social/   # Proxy a Make.com webhook para publicar en redes sociales
      search-console/   # GSC stats — dinamico via gscClient (sin SITES hardcodeado)
      proyectos/        # GET: GSC sites.list() + clicks/imp + Firestore desc + Microlink URLs
      send-email/       # Envio de emails via Nodemailer + Zoho
      admin-login/      # Login del panel admin (ADMIN_USERNAME + ADMIN_PASSWORD_HASH)
      reset-products/   # Resetea coleccion products en Firestore (requiere password)
      seed-rental/      # Seedea coleccion productos_alquiler en Firestore (POST, una vez)
      rental-data/      # GET /api/rental-data → todos los docs activos de productos_alquiler
                        # GET /api/rental-data/[productId] → doc individual (usa Firebase Admin)
      generate-reel/    # Genera video con Shotstack sandbox (/stage/render) + Pexels bg
      check-reel-status/# Consulta estado de render en Shotstack
      payment-webhook/  # Webhook de MercadoPago (notificaciones de pago)
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
    ...otros componentes reutilizables
  views/
    StorePage.jsx       # Wrapper de /tienda con SEO, pasa asPage={true} a Store
    ProductDetailPage.jsx # Detalle de producto: toggle Compra/Alquiler con framer-motion,
                          # fetch desde /api/rental-data/[id], precios en USD+ARS, WA dinámico
    AdminPage.jsx       # Panel admin completo
    ...otras vistas
  context/              # CartContext
  hooks/                # useAnalytics, useFirebaseStats, useSearchConsole, useProyectos, etc.
  utils/
    priceService.js     # Carga productos desde Firestore (coleccion products), con cache 5min
    exchangeService.js  # Tipo de cambio USD→ARS, formatARS, formatUSD
    firebaseservice.js  # Firebase client SDK (db, auth, analytics)
    makeService.js      # Envia payload a Make.com webhook
    ...otros servicios
  lib/
    firebase-admin.js   # Firebase Admin SDK (server-side, usa FIREBASE_SERVICE_ACCOUNT_JSON)
    gscClient.js        # Google Search Console client + getVerifiedSites()
  schemas/              # firebaseSchemas.js
  data/
    products.js         # Catalogo estatico de productos (IDs canonicos, fallback)
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
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# Firebase Admin (Search Console)
FIREBASE_SERVICE_ACCOUNT_JSON

# Google APIs
GOOGLE_PLACES_API_KEY
GEMINI_API_KEY

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN

# LinkedIn OAuth
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

# Terceros
PEXELS_API_KEY
SHOTSTACK_API_KEY

# Admin
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
```

**ADVERTENCIA**: Nunca usar `echo` para setear vars en Vercel — agrega `\n` al final
que rompe headers HTTP. Siempre usar: `printf "VALUE" | vercel env add VAR production`

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
- **Herramientas** (modales desde home + rutas propias con metadata SEO):
  - `/ats` — Analizador de CV con Gemini AI (PDF upload, analisis ATS)
  - `/roi` — Calculadora de ROI digital
  - `/web` — Cotizador de sitios web
  - `/kpi` — Radar KPI interactivo
  - `/radarweb` — Radar Web
  - `/stats` — Dashboard de estadisticas (GSC, Firebase, visitas)
- **Admin** (`/admin`): Panel interno — stats, gestion de productos, publicacion en redes sociales, generacion de reels con Shotstack, gestion de proyectos GSC
- **Publicador de redes** (admin): envia POST a Make.com → Make llama a Gemini y publica en LinkedIn/Instagram/Facebook. Logos de servicios en Cloudinary (`service-logos/`)
- **Generador de reels** (admin): Shotstack sandbox (`/stage/render`) + videos de Pexels como fondo + musica en Cloudinary. Callback a Make.com con el video renderizado
- **Auth**: Firebase Auth (Google login)
- **Likes + Visitas**: Contadores en Firestore, anonimos con localStorage
- **AI Chatbot**: Integrado en header (Gemini)
- **LinkedIn Sidebar**: Feed de posts de LinkedIn
- **WhatsApp Button**: Flotante en todas las paginas
- **Favicon dinamico**: Emoji segun dia de la semana (Dom😴 Lun😊 Mar😄 Mie🥳 Jue😎 Vie🤩 Sab😁) — script inline en `<head>`, sin archivos ni requests
- **Dark mode**: Persistido en localStorage, aplicado antes del primer render (sin flash)
- **Redirect www → apex**: `next.config.mjs` redirige 301 `www.marianoaliandri.com.ar` → `marianoaliandri.com.ar`
- **SEO**: sitemap.xml con todas las rutas, robots.txt optimizado para Google e IAs, metadata por pagina con canonical, OG y JSON-LD

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
El proyecto migrO de Netlify a Vercel. Todas las funciones serverless viven en
`src/app/api/` como Route Handlers de Next.js. **No crear Netlify Functions.**

### SDKs inicializados dentro de handlers
Firebase Admin, MercadoPago SDK y otros se inicializan dentro de cada handler,
no al nivel del modulo. Esto evita errores en pre-render del servidor.

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

---

## Que NO tocar o romper

- **`src/app/layout.jsx` — dark mode script**: el script inline en `<head>` es
  intencional para evitar FOUC. No moverlo ni eliminarlo. Tambien contiene el favicon
  dinamico por dia de semana (script inline, sin archivos).

- **`src/app/providers.jsx` — dynamic imports**: los componentes Firebase como
  `AuthButton`, `LikeSystem`, etc. DEBEN ser `dynamic()`. Si se vuelven a importar
  estaticamente, Firebase vuelve al critical path y el LCP empeora ~2 segundos.

- **Firebase inicializado en handlers**: no mover la inicializacion de Firebase Admin
  al nivel del modulo en las API routes.

- **DNS de Zoho Mail en Vercel**: hay 3 registros MX (mx.zoho.com prio 10/20/50) y
  un SPF record. No eliminarlos o los emails del dominio dejan de funcionar.

- **Variables de entorno con `\n`**: `MERCADOPAGO_ACCESS_TOKEN`, `GOOGLE_PLACES_API_KEY`
  y `SHOTSTACK_API_KEY` fueron corregidos con `printf`. Si se re-setean, SIEMPRE usar
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

- **Shotstack**: usa endpoint sandbox `/stage/render` (no `/v1/render`). La key
  es la sandbox key. Los videos tienen watermark, es esperado y gratis.

- **SocialPublisher → Make.com**: el webhook es `https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi`.
  El payload usa campos `text`, `networks`, `type`, `useAI`, `aiProvider`, `imageUrl`.
  NO cambiar nombres de campos — el router de Make.com depende de ellos.
  La ruta `/api/generate-social-caption` NO existe (fue creada y eliminada).

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

# Variables de entorno (SIEMPRE con printf, nunca echo)
printf "VALUE" | vercel env add VAR_NAME production
vercel env ls
```
