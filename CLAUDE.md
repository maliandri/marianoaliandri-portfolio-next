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
    page.jsx            # Home: HeroBuild + Servicios + Skills + Carrousel + Contact
    layout.jsx          # Root layout: metadata, preconnects, dark mode script
    providers.jsx       # QueryClient, CartProvider, AppChrome (header, footer, tools)
    api/                # API Routes (server-side)
      analyze-cv/       # Gemini ATS — analiza PDF de CV
      chat/             # AI chatbot
      create-payment/   # MercadoPago
      cv-payment/       # Pago por analisis de CV
      lead-finder/      # Google Places + scraping de emails
      publish-social/   # Make.com webhook para redes sociales
      search-console/   # Google Search Console via Firebase Admin
      send-email/       # Envio de emails
      admin-login/      # Login del panel admin
      ...otros          # Webhooks de pago, LinkedIn, reels, productos
    admin/              # Panel de administracion
    tienda/             # E-commerce de servicios
    ats/ roi/ kpi/ web/ radarweb/ stats/  # Herramientas interactivas (cada una = ruta propia)
  components/           # Componentes React reutilizables
  views/                # Vistas completas (StorePage, AdminPage, ProfilePage, etc.)
  context/              # CartContext
  hooks/                # useAnalytics, useFirebaseStats, useSearchConsole, etc.
  utils/                # Servicios: cloudinary, firebase, mercadopago, gemini, etc.
  lib/                  # firebase-admin.js (servidor)
  schemas/              # firebaseSchemas.js
  data/                 # linkedinPosts.js, products.js
```

---

## Deploy y entorno

- **Deploy**: `vercel --prod` desde la raiz del proyecto
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

- **Home**: Hero animado con editor de codigo en vivo, carrusel de servicios, skills, galeria, contacto
- **Tienda**: E-commerce de servicios con MercadoPago, carrito, detalle de producto, Q&A
- **Herramientas** (modales / rutas dedicadas):
  - `/ats` — Analizador de CV con Gemini AI (PDF upload)
  - `/roi` — Calculadora de ROI
  - `/web` — Cotizador de sitios web
  - `/kpi` — Radar KPI
  - `/radarweb` — Radar Web
  - `/stats` — Dashboard de estadisticas (GSC, Firebase, visitas)
- **Admin** (`/admin`): Panel interno con stats, gestion de productos, publicacion en redes
- **Auth**: Firebase Auth (Google login)
- **Likes + Visitas**: Contadores en Firestore, anonimos con localStorage
- **AI Chatbot**: Integrado en header
- **LinkedIn Sidebar**: Feed de posts de LinkedIn
- **WhatsApp Button**: Flotante en todas las paginas
- **Dark mode**: Persistido en localStorage, aplicado antes del primer render (sin flash)
- **Service Worker**: Desregistra el SW viejo de Netlify en cada visita

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

### Cloudinary con srcSet responsive
`CloudinaryImage` genera srcset con [400, 800, 1200, 1920]w. Las imagenes del
Carrousel son las que mas pesan — si se reemplazan, usar el componente
`CloudinaryImage` con `responsive={true}`.

---

## Que NO tocar o romper

- **`src/app/layout.jsx` — dark mode script**: el script inline en `<head>` es
  intencional para evitar FOUC (flash of unstyled content). No moverlo ni eliminarlo.

- **`src/app/providers.jsx` — dynamic imports**: los componentes Firebase como
  `AuthButton`, `LikeSystem`, etc. DEBEN ser `dynamic()`. Si se vuelven a importar
  estaticamente, Firebase vuelve al critical path y el LCP empeora ~2 segundos.

- **Firebase inicializado en handlers**: no mover la inicializacion de Firebase Admin
  al nivel del modulo en las API routes.

- **DNS de Zoho Mail en Vercel**: hay 3 registros MX (mx.zoho.com prio 10/20/50) y
  un SPF record. No eliminarlos o los emails del dominio dejan de funcionar.

- **`MERCADOPAGO_ACCESS_TOKEN` y `GOOGLE_PLACES_API_KEY`**: fueron corregidos para
  no tener `\n` al final. Si se re-setean, usar `printf`, no `echo`.

- **Rutas de herramientas**: `/ats`, `/roi`, `/web`, `/kpi`, `/radarweb`, `/stats`
  son paginas reales (no solo modales). Los modales se abren desde el home pero
  cada herramienta tiene su propia URL compartible.

---

## Comandos utiles

```bash
# Desarrollo local
npm run dev

# Deploy a produccion
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
