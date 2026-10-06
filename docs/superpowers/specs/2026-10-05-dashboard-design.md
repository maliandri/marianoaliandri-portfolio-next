# Dashboard Personal — Diseño

**Fecha:** 2026-10-05  
**Autor:** Mariano Aliandri  
**Estado:** Aprobado — listo para implementación

---

## Objetivo

Dashboard personal drag-and-drop en `/dashboard` que centraliza todas las métricas que generan las automatizaciones del portfolio: posts del bot de noticias, reels, auditorías, leads, presupuestos, tráfico GA4 y GSC. Solo accesible para el admin. Incluye acción de "Publicar resumen" a redes sociales vía Make.com.

## Stack

| Librería | Uso |
|----------|-----|
| `react-grid-layout` | Grid draggable/resizable |
| `echarts-for-react` | Charts (series temporales, barras, pie) |
| `html2canvas` | Captura del grid para publicar en redes |
| TanStack Query (ya existe) | Fetching y cache por widget |
| Firebase Admin SDK (ya existe) | Leer Firestore server-side |
| GA4 Data API (`@google-analytics/data`) | Sesiones, usuarios, páginas vistas |
| GSC API (ya existe en `gscClient.js`) | Clicks, impresiones, posición |

---

## Arquitectura

### Ruta y auth

- **URL:** `/dashboard`
- **Auth:** cookie `admin_token` (mismo mecanismo que `/admin`). Si falta → redirect a `/admin`.
- `page.jsx` es server component con `force-dynamic`. Verifica la cookie. Renderiza `DashboardPage` (client component).

### Estructura de archivos

```
src/app/dashboard/
  page.jsx                        ← server component, auth check, metadata

src/views/
  DashboardPage.jsx               ← client component raíz, ReactGridLayout

src/components/dashboard/
  DashboardGrid.jsx               ← wrapper de ReactGridLayout + persistencia localStorage
  DashboardPublisher.jsx          ← modal "Publicar resumen" → Make.com
  widgets/
    NoticiasBotWidget.jsx         ← posts publicados por red/tópico (últimos 30d)
    ReelsWidget.jsx               ← contador de reels generados este mes
    AuditoriasWidget.jsx          ← reportes creados + emails enviados
    LeadsWidget.jsx               ← negocios encontrados por ciudad
    PresupuestosWidget.jsx        ← solicitudes recibidas + montos asignados
    GSCWidget.jsx                 ← clicks, impresiones, posición promedio
    GA4Widget.jsx                 ← sesiones, usuarios, páginas vistas
    VisitasWidget.jsx             ← visitas únicas + likes (Firebase)

src/hooks/
  useDashboardData.js             ← orquesta todas las queries; re-exporta hooks por widget

src/app/api/
  dashboard-stats/route.js       ← GET: agrega datos de Firestore + GA4 + GSC en un endpoint
```

### API Route `/api/dashboard-stats`

Endpoint único que el dashboard llama al cargar. Requiere cookie `admin_token`. Retorna:

```json
{
  "noticias": { "total": 0, "porRed": {}, "porTopico": {}, "serie": [] },
  "reels": { "total": 0, "esteMes": 0 },
  "auditorias": { "total": 0, "emailsEnviados": 0 },
  "leads": { "total": 0, "porCiudad": {} },
  "presupuestos": { "total": 0, "pendientes": 0, "montoTotal": 0 },
  "visitas": { "unicas": 0, "likes": 0 },
  "gsc": { "clicks": 0, "impresiones": 0, "posicion": 0, "serie": [] },
  "ga4": { "sesiones": 0, "usuarios": 0, "paginasVistas": 0, "serie": [] }
}
```

Los datos de Firestore se leen con `getDb()` directo (no self-fetch). GA4 se consulta con `@google-analytics/data` usando las credenciales de Firebase Admin ya configuradas. GSC reutiliza `gscClient.js`.

---

## Widgets — detalle

### Widgets de contador simple (número grande + ícono)
- **ReelsWidget** — total reels generados (Firestore `noticias` con `type: 'reel'` o colección separada)
- **AuditoriasWidget** — total auditorías + emails enviados
- **PresupuestosWidget** — solicitudes recibidas + pendientes + monto total asignado

### Widgets con chart ECharts
- **NoticiasBotWidget** — bar chart apilado por red (FB/IG/LinkedIn/X), últimos 30 días
- **LeadsWidget** — bar chart horizontal top 10 ciudades por cantidad de leads
- **GSCWidget** — line chart clicks + impresiones últimos 28 días (dos ejes Y)
- **GA4Widget** — line chart sesiones + usuarios últimos 28 días
- **VisitasWidget** — número grande de visitas únicas + sparkline

### Layout inicial (puede reordenarse)
```
[ GSCWidget (6 cols) ] [ GA4Widget (6 cols) ]
[ NoticiasBotWidget (4) ] [ LeadsWidget (4) ] [ AuditoriasWidget (4) ]
[ VisitasWidget (3) ] [ ReelsWidget (3) ] [ PresupuestosWidget (6) ]
```
Layout persistido en `localStorage` bajo key `dashboard_layout_v1`.

---

## Publicar resumen a redes

Botón **"Publicar resumen"** en el header del dashboard. Abre modal `DashboardPublisher`:

1. **Selector de período**: última semana / último mes
2. **Texto auto-generado** con los números reales (editable):
   > "Esta semana: 12 noticias publicadas, 3 reels generados, 47 leads encontrados, 1.200 visitas."
3. **Selector de redes**: LinkedIn / Instagram / Facebook (mismos checkboxes que `SocialPublisher`)
4. **Captura**: `html2canvas` del área del grid → sube a Cloudinary → devuelve URL
5. **Envío**: POST al webhook Make.com existente con:
   ```json
   {
     "type": "dashboard_report",
     "text": "...",
     "networks": { "linkedin": true, "instagram": false, "facebook": true },
     "imageUrl": "https://res.cloudinary.com/..."
   }
   ```

En Make.com hay que agregar una rama en el Router para `type: 'dashboard_report'` (configuración manual post-deploy).

---

## GA4 — setup necesario antes de implementar

1. **Instalar tag en `layout.jsx`**: agregar `<Script>` con `G-6ZB4P1VZJE` (gtag.js)
2. **Dar acceso a service account**: en GA4 Admin → Gestión de accesos a la propiedad → agregar el email de `FIREBASE_CLIENT_EMAIL` con rol Lector
3. **Nueva env var**: `GA4_PROPERTY_ID=499336912` (Vercel + `.env.local`)
4. **Nueva dependencia**: `npm install @google-analytics/data`

---

## Variables de entorno

| Variable | Valor | Dónde |
|----------|-------|-------|
| `GA4_PROPERTY_ID` | `499336912` | Vercel + `.env.local` |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | `G-6ZB4P1VZJE` | Vercel + `.env.local` |

Las credenciales de Google (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) ya existen y son reutilizadas por `@google-analytics/data`.

---

## Qué NO tocar

- La ruta `/stats` existente no se modifica (sigue siendo la página pública SEO)
- El modal de stats en `providers.jsx` no se modifica
- El contrato del webhook Make.com existente no cambia (solo se agrega `type: 'dashboard_report'`)
- `gscClient.js` no se modifica — se importa directo

---

## Orden de implementación sugerido

1. Instalar tag GA4 + env vars
2. `/api/dashboard-stats` route con Firestore + GSC (sin GA4 aún)
3. `DashboardPage` + `DashboardGrid` con layout básico
4. Widgets de contador simple (sin charts)
5. Widgets con ECharts
6. Agregar GA4 a la route una vez que las credenciales estén configuradas
7. `DashboardPublisher` (modal publicar a redes)
