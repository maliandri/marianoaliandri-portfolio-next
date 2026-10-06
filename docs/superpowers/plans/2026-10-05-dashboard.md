# Dashboard Personal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private drag-and-drop dashboard at `/dashboard` that centralizes all metrics from the portfolio's automations (noticias bot, reels, audits, leads, GSC, GA4, Firebase), with a "Publicar resumen" action to push a summary to social networks via the existing Make.com webhook.

**Architecture:** Single API route `/api/dashboard-stats` aggregates Firestore + GSC + GA4 data, authenticated via username/password in sessionStorage (same pattern as `/admin`). Client-side `DashboardPage` uses `react-grid-layout` for a draggable/resizable grid and `echarts-for-react` for charts. Layout persisted in localStorage.

**Tech Stack:** `react-grid-layout`, `echarts-for-react`, `html2canvas`, `@google-analytics/data`, TanStack Query (existing), Firebase Admin (existing), `gscClient.js` (existing).

**Spec:** `docs/superpowers/specs/2026-10-05-dashboard-design.md`

## Global Constraints

- Auth: check `sessionStorage.getItem('adminAuth') === 'true'` client-side; API routes validate `{ username, password }` against `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars (same as `/api/admin-login`)
- Never self-fetch from server components — read Firestore with `getDb()` directly
- Do NOT modify `/stats`, `providers.jsx`, `gscClient.js`, or any existing Make.com webhook contract
- GA4 widget must render gracefully with zero data if `GA4_PROPERTY_ID` is not yet set
- Reels are NOT currently saved to Firestore — Task 1 adds that logging
- ECharts via `echarts-for-react` wrapper — import only needed chart types (tree-shaking)
- Layout key: `dashboard_layout_v1` in localStorage

## Review Focus

- **sessionStorage empty on hard refresh** → `DashboardPage` should redirect to `/admin` instead of showing broken UI or calling the API unauthenticated
- **GA4 zeros before service account access is granted** → `GA4Widget` must show "Sin datos aún" gracefully, not crash
- **`html2canvas` fails on cross-origin images (Cloudinary, GSC charts)** → capture only the text summary or add `crossOrigin="anonymous"` to images; document the limitation in `DashboardPublisher`
- **`react-grid-layout` layout mismatch between saves** → if localStorage layout has more/fewer items than current widget list, fall back to default layout silently
- **`/api/dashboard-stats` timeout** → GSC + GA4 + Firestore queries run in parallel with `Promise.allSettled`; each failing source returns `null` and the UI shows a per-widget error state

---

## Task 1: Setup — dependencies, GA4 tag, reel logging

**Files:**
- Modify: `package.json` (add 4 dependencies)
- Modify: `src/app/layout.jsx` (add GA4 gtag script)
- Modify: `src/app/api/upload-reel/route.js` (add Firestore write)
- Create: `.env.local` additions (document only — actual secrets must be set manually)

**Interfaces:**
- Produces: `reels` Firestore collection with docs `{ createdAt, videoUrl, productId, text }`; `GA4_PROPERTY_ID` + `NEXT_PUBLIC_GA4_MEASUREMENT_ID` env vars available

- [ ] **Step 1: Install packages**

```bash
npm install react-grid-layout echarts-for-react html2canvas @google-analytics/data
```

Expected: no peer-dep errors. `react-grid-layout` requires a CSS import (added in Task 3).

- [ ] **Step 2: Add GA4 tag to `src/app/layout.jsx`**

Add inside `<head>` after existing preconnects:

```jsx
{process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && (
  <>
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
    <Script id="ga4-init" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}');
    `}</Script>
  </>
)}
```

`Script` is already imported from `next/script` in `layout.jsx`; verify it is before adding a second import.

- [ ] **Step 3: Add env vars to `.env.local`**

```
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-6ZB4P1VZJE
GA4_PROPERTY_ID=499336912
```

Also add these to Vercel via:
```powershell
vercel env add NEXT_PUBLIC_GA4_MEASUREMENT_ID production
vercel env add GA4_PROPERTY_ID production
```

- [ ] **Step 4: Add reel logging to `/api/upload-reel/route.js`**

Add at the top:
```js
import { getDb } from '@/lib/firebase-admin';
```

After the Make.com call succeeds (inside the try block, after `return Response.json({ success: true, videoUrl })`... actually, insert BEFORE the return):

```js
// Log reel to Firestore for dashboard stats
try {
  const db = await getDb();
  await db.collection('reels').add({
    createdAt: new Date(),
    videoUrl,
    productId,
    text: text || '',
  });
} catch (reelLogErr) {
  console.error('[upload-reel] Firestore log failed:', reelLogErr.message);
}
```

- [ ] **Step 5: Verify reel logging doesn't break existing flow**

Run dev server: `npm run dev`
Upload a test reel via `/admin` → Reels tab.
Check Firestore console: collection `reels` should have a new doc.
If Firestore write fails, the error is caught and the reel still uploads normally.

- [ ] **Step 6: Grant GA4 access to service account**

Manual step (cannot be automated):
1. Find your `FIREBASE_CLIENT_EMAIL` value (check `.env.local` or Vercel)
2. Go to analytics.google.com → Admin → Property 499336912 → Gestión de accesos a la propiedad
3. Add that email with role **Lector** (Viewer)

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.jsx src/app/api/upload-reel/route.js package.json package-lock.json
git commit -m "feat: install dashboard deps, add GA4 tag, log reels to Firestore"
```

---

## Task 2: `/api/dashboard-stats` route

**Files:**
- Create: `src/app/api/dashboard-stats/route.js`

**Interfaces:**
- Consumes: `getDb()` from `@/lib/firebase-admin`, `getGSCAuth` + `getVerifiedSites` from `@/lib/gscClient`, `google` from `googleapis` (already installed), `@google-analytics/data`
- Produces: `POST /api/dashboard-stats` → JSON shape defined in spec (noticias, reels, auditorias, leads, presupuestos, visitas, gsc, ga4)

- [ ] **Step 1: Create the route file**

```js
// src/app/api/dashboard-stats/route.js
export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function unauthorized() {
  return Response.json({ error: 'No autorizado' }, { status: 401 });
}

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return unauthorized();
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) return unauthorized();

    const [noticiasResult, reelsResult, auditoriasResult, presupuestosResult, gscResult, ga4Result] =
      await Promise.allSettled([
        fetchNoticias(),
        fetchReels(),
        fetchAuditorias(),
        fetchPresupuestos(),
        fetchGSC(),
        fetchGA4(),
      ]);

    return Response.json({
      noticias:     noticiasResult.status === 'fulfilled'    ? noticiasResult.value    : null,
      reels:        reelsResult.status === 'fulfilled'       ? reelsResult.value       : null,
      auditorias:   auditoriasResult.status === 'fulfilled'  ? auditoriasResult.value  : null,
      presupuestos: presupuestosResult.status === 'fulfilled'? presupuestosResult.value: null,
      gsc:          gscResult.status === 'fulfilled'         ? gscResult.value         : null,
      ga4:          ga4Result.status === 'fulfilled'         ? ga4Result.value         : null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add `fetchNoticias`**

```js
async function fetchNoticias() {
  const db = await getDb();
  const snap = await db.collection('noticias').orderBy('createdAt', 'desc').limit(200).get();
  const docs = snap.docs.map(d => d.data());

  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const recientes = docs.filter(d => {
    const ts = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
    return ts >= thirtyDaysAgo;
  });

  const porRed = { facebook: 0, instagram: 0, linkedin: 0, x: 0 };
  const porTopico = {};
  const seriePorDia = {};

  for (const d of recientes) {
    const nets = d.networks || {};
    if (nets.facebook)  porRed.facebook++;
    if (nets.instagram) porRed.instagram++;
    if (nets.linkedin)  porRed.linkedin++;
    if (nets.x)         porRed.x++;

    const topico = d.topicId || d.topic || 'sin-topico';
    porTopico[topico] = (porTopico[topico] || 0) + 1;

    const ts = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
    const dia = ts.toISOString().split('T')[0];
    seriePorDia[dia] = (seriePorDia[dia] || 0) + 1;
  }

  const serie = Object.entries(seriePorDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return { total: docs.length, ultimos30: recientes.length, porRed, porTopico, serie };
}
```

- [ ] **Step 3: Add `fetchReels`**

```js
async function fetchReels() {
  const db = await getDb();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const snap = await db.collection('reels').get();
  const total = snap.size;
  const esteMes = snap.docs.filter(d => {
    const ts = d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(d.data().createdAt);
    return ts >= firstOfMonth;
  }).length;

  return { total, esteMes };
}
```

- [ ] **Step 4: Add `fetchAuditorias`**

```js
async function fetchAuditorias() {
  const db = await getDb();
  const snap = await db.collection('auditorias').get();
  const docs = snap.docs.map(d => d.data());

  let emailsEnviados = 0;
  let totalNegocios = 0;
  const porCiudad = {};

  for (const d of docs) {
    const negocios = d.negocios || [];
    totalNegocios += negocios.length;
    for (const neg of negocios) {
      if (neg.emailEnviado || neg.sent) emailsEnviados++;
      const ciudad = neg.ciudad || 'Sin ciudad';
      porCiudad[ciudad] = (porCiudad[ciudad] || 0) + 1;
    }
  }

  return { total: docs.length, emailsEnviados, totalNegocios, porCiudad };
}
```

- [ ] **Step 5: Add `fetchPresupuestos`**

```js
async function fetchPresupuestos() {
  const db = await getDb();
  const snap = await db.collection('presupuestos').get();
  const docs = snap.docs.map(d => d.data());

  const pendientes = docs.filter(d => d.estado === 'pending' || !d.estado).length;
  const montoTotal = docs.reduce((sum, d) => sum + (d.montoUSD || 0), 0);

  return { total: docs.length, pendientes, montoTotal };
}
```

- [ ] **Step 6: Add `fetchGSC`**

```js
async function fetchGSC() {
  const auth = getGSCAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const sites = await getVerifiedSites(auth);

  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  // Aggregate across all sites
  let totalClicks = 0, totalImpressions = 0, posicionSum = 0, posicionCount = 0;
  const seriePorDia = {};

  await Promise.allSettled(sites.map(async (site) => {
    try {
      const [totals, serie] = await Promise.all([
        searchconsole.searchanalytics.query({
          siteUrl: site.siteUrl,
          requestBody: { startDate, endDate, dimensions: [], rowLimit: 1 },
        }),
        searchconsole.searchanalytics.query({
          siteUrl: site.siteUrl,
          requestBody: { startDate, endDate, dimensions: ['date'], rowLimit: 30 },
        }),
      ]);
      const row = totals.data.rows?.[0];
      if (row) {
        totalClicks += row.clicks || 0;
        totalImpressions += row.impressions || 0;
        posicionSum += row.position || 0;
        posicionCount++;
      }
      for (const r of serie.data.rows || []) {
        const dia = r.keys[0];
        if (!seriePorDia[dia]) seriePorDia[dia] = { clicks: 0, impressions: 0 };
        seriePorDia[dia].clicks += r.clicks || 0;
        seriePorDia[dia].impressions += r.impressions || 0;
      }
    } catch { /* skip failing site */ }
  }));

  const serieArr = Object.entries(seriePorDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return {
    clicks: totalClicks,
    impresiones: totalImpressions,
    posicion: posicionCount ? Math.round((posicionSum / posicionCount) * 10) / 10 : 0,
    serie: serieArr,
  };
}
```

- [ ] **Step 7: Add `fetchGA4`**

```js
async function fetchGA4() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) return { sesiones: 0, usuarios: 0, paginasVistas: 0, serie: [], noData: true };

  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
  });

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
    ],
    dimensions: [{ name: 'date' }],
  });

  let sesiones = 0, usuarios = 0, paginasVistas = 0;
  const serie = [];

  for (const row of response.rows || []) {
    const date = row.dimensionValues[0].value;
    const s = parseInt(row.metricValues[0].value || '0');
    const u = parseInt(row.metricValues[1].value || '0');
    const p = parseInt(row.metricValues[2].value || '0');
    sesiones += s;
    usuarios += u;
    paginasVistas += p;
    // date from GA4 is YYYYMMDD, convert to YYYY-MM-DD
    const formatted = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
    serie.push({ date: formatted, sesiones: s, usuarios: u });
  }

  serie.sort((a, b) => a.date.localeCompare(b.date));
  return { sesiones, usuarios, paginasVistas, serie };
}
```

- [ ] **Step 8: Test the endpoint manually**

Start dev server. In browser console (from `/admin` where sessionStorage is set):
```js
fetch('/api/dashboard-stats', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: sessionStorage.getItem('adminUsername'),
    password: sessionStorage.getItem('adminPassword'),
  }),
}).then(r => r.json()).then(console.log)
```

Expected: JSON object with all keys. `ga4` may have `noData: true` if service account access not yet granted.
`null` values for any key = that source threw an error (check server logs).

- [ ] **Step 9: Commit**

```bash
git add src/app/api/dashboard-stats/route.js
git commit -m "feat: add /api/dashboard-stats aggregating Firestore + GSC + GA4"
```

---

## Task 3: Dashboard route + grid shell

**Files:**
- Create: `src/app/dashboard/page.jsx`
- Create: `src/views/DashboardPage.jsx`
- Create: `src/components/dashboard/DashboardGrid.jsx`

**Interfaces:**
- Consumes: `POST /api/dashboard-stats` from Task 2; `sessionStorage.adminAuth/adminUsername/adminPassword`
- Produces: `<DashboardPage>` client component with auth gate + data fetch; `<DashboardGrid>` accepting `layout`, `onLayoutChange`, `children`

- [ ] **Step 1: Create `src/app/dashboard/page.jsx`**

```jsx
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard | Mariano Aliandri',
  robots: { index: false, follow: false },
};

import DashboardPage from '@/views/DashboardPage';

export default function DashboardRoute() {
  return <DashboardPage />;
}
```

- [ ] **Step 2: Create `src/views/DashboardPage.jsx`**

```jsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const auth = sessionStorage.getItem('adminAuth');
    if (auth !== 'true') {
      router.replace('/admin');
      return;
    }

    const username = sessionStorage.getItem('adminUsername');
    const password = sessionStorage.getItem('adminPassword');

    fetch('/api/dashboard-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400">Cargando dashboard…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-500">Error: {error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <a href="/admin" className="text-sm text-indigo-500 hover:underline">← Admin</a>
        </div>
        <DashboardGrid data={data} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/dashboard/DashboardGrid.jsx`**

```jsx
'use client';
import { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'gsc',          x: 0, y: 0, w: 6, h: 4 },
    { i: 'ga4',          x: 6, y: 0, w: 6, h: 4 },
    { i: 'noticias',     x: 0, y: 4, w: 4, h: 4 },
    { i: 'leads',        x: 4, y: 4, w: 4, h: 4 },
    { i: 'auditorias',   x: 8, y: 4, w: 4, h: 3 },
    { i: 'visitas',      x: 0, y: 8, w: 3, h: 3 },
    { i: 'reels',        x: 3, y: 8, w: 3, h: 3 },
    { i: 'presupuestos', x: 6, y: 8, w: 6, h: 3 },
  ],
};

const STORAGE_KEY = 'dashboard_layout_v1';

function loadLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_LAYOUTS;
    const parsed = JSON.parse(saved);
    // Validate: must have same widget ids as default
    const defaultIds = new Set(DEFAULT_LAYOUTS.lg.map(i => i.i));
    const savedIds  = new Set((parsed.lg || []).map(i => i.i));
    const sameIds = defaultIds.size === savedIds.size && [...defaultIds].every(id => savedIds.has(id));
    return sameIds ? parsed : DEFAULT_LAYOUTS;
  } catch {
    return DEFAULT_LAYOUTS;
  }
}

export default function DashboardGrid({ data }) {
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);

  useEffect(() => {
    setLayouts(loadLayout());
  }, []);

  function handleLayoutChange(_, allLayouts) {
    setLayouts(allLayouts);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts)); } catch {}
  }

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768 }}
      cols={{ lg: 12, md: 10, sm: 6 }}
      rowHeight={80}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".widget-drag-handle"
    >
      {DEFAULT_LAYOUTS.lg.map(({ i }) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="widget-drag-handle cursor-grab px-4 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-400 select-none">
            ⠿ {i}
          </div>
          <div className="flex-1 p-3 overflow-hidden">
            <p className="text-xs text-gray-400">{data ? 'datos ok' : '–'}</p>
          </div>
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
```

- [ ] **Step 4: Verify grid renders at `/dashboard`**

Run `npm run dev`. Navigate to `/admin`, log in, then go to `/dashboard`.
Expected: a grid with 8 placeholder cards that can be dragged. Reorder two cards and refresh — layout should persist.
If redirected to `/admin`: sessionStorage keys are missing — log in first.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/ src/views/DashboardPage.jsx src/components/dashboard/DashboardGrid.jsx
git commit -m "feat: add /dashboard route with auth gate and draggable grid shell"
```

---

## Task 4: Counter widgets (no charts)

**Files:**
- Create: `src/components/dashboard/widgets/ReelsWidget.jsx`
- Create: `src/components/dashboard/widgets/AuditoriasWidget.jsx`
- Create: `src/components/dashboard/widgets/PresupuestosWidget.jsx`
- Modify: `src/components/dashboard/DashboardGrid.jsx` (wire up widgets)

**Interfaces:**
- Consumes: `data.reels`, `data.auditorias`, `data.presupuestos` from `DashboardPage`
- Produces: Three display-only widget components accepting a `data` prop

- [ ] **Step 1: Create shared `WidgetShell` helper inline in each widget**

Each widget uses this pattern (copy into each file — no shared abstraction yet):

```jsx
// title: string, children: ReactNode, loading: bool
function WidgetShell({ title, children, loading }) {
  if (loading || !children) return <div className="h-full flex items-center justify-center"><span className="text-gray-300 text-sm">–</span></div>;
  return (
    <div className="h-full flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `ReelsWidget.jsx`**

```jsx
'use client';
export default function ReelsWidget({ data }) {
  function WidgetShell({ title, children }) {
    if (!children) return <div className="h-full flex items-center justify-center"><span className="text-gray-300 text-sm">–</span></div>;
    return <div className="h-full flex flex-col gap-1"><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>{children}</div>;
  }

  return (
    <WidgetShell title="Reels">
      {data ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-4xl font-bold text-indigo-500">{data.esteMes}</span>
          <span className="text-xs text-gray-400">este mes</span>
          <span className="text-sm text-gray-500 mt-1">Total: <strong>{data.total}</strong></span>
        </div>
      ) : null}
    </WidgetShell>
  );
}
```

- [ ] **Step 3: Create `AuditoriasWidget.jsx`**

```jsx
'use client';
export default function AuditoriasWidget({ data }) {
  return (
    <div className="h-full flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Auditorías</p>
      {data ? (
        <div className="flex flex-col gap-1">
          <div className="flex gap-4">
            <div>
              <span className="text-4xl font-bold text-emerald-500">{data.total}</span>
              <span className="block text-xs text-gray-400">reportes</span>
            </div>
            <div>
              <span className="text-4xl font-bold text-blue-500">{data.emailsEnviados}</span>
              <span className="block text-xs text-gray-400">emails enviados</span>
            </div>
          </div>
          <span className="text-xs text-gray-400">{data.totalNegocios} negocios auditados en total</span>
        </div>
      ) : <span className="text-gray-300 text-sm">–</span>}
    </div>
  );
}
```

- [ ] **Step 4: Create `PresupuestosWidget.jsx`**

```jsx
'use client';
export default function PresupuestosWidget({ data }) {
  return (
    <div className="h-full flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Presupuestos</p>
      {data ? (
        <div className="flex gap-6">
          <div>
            <span className="text-4xl font-bold text-amber-500">{data.total}</span>
            <span className="block text-xs text-gray-400">recibidos</span>
          </div>
          <div>
            <span className="text-3xl font-bold text-orange-400">{data.pendientes}</span>
            <span className="block text-xs text-gray-400">pendientes</span>
          </div>
          <div>
            <span className="text-xl font-bold text-gray-700 dark:text-gray-200">USD {data.montoTotal?.toLocaleString('es-AR') || 0}</span>
            <span className="block text-xs text-gray-400">asignado total</span>
          </div>
        </div>
      ) : <span className="text-gray-300 text-sm">–</span>}
    </div>
  );
}
```

- [ ] **Step 5: Wire widgets into `DashboardGrid.jsx`**

Add imports at the top:
```jsx
import ReelsWidget from './widgets/ReelsWidget';
import AuditoriasWidget from './widgets/AuditoriasWidget';
import PresupuestosWidget from './widgets/PresupuestosWidget';
```

Replace the placeholder `<div>` for keys `reels`, `auditorias`, `presupuestos`:

```jsx
// Inside the .map over DEFAULT_LAYOUTS.lg:
const widgetContent = {
  reels:        <ReelsWidget data={data?.reels} />,
  auditorias:   <AuditoriasWidget data={data?.auditorias} />,
  presupuestos: <PresupuestosWidget data={data?.presupuestos} />,
};
// Replace <p className="text-xs text-gray-400">{data ? 'datos ok' : '–'}</p> with:
{widgetContent[i] || <p className="text-xs text-gray-400 p-2">{i}</p>}
```

- [ ] **Step 6: Verify widgets render**

`npm run dev` → `/dashboard`. The Reels, Auditorías, Presupuestos cards should show numbers (or dashes if Firestore is empty in dev).

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/widgets/ReelsWidget.jsx src/components/dashboard/widgets/AuditoriasWidget.jsx src/components/dashboard/widgets/PresupuestosWidget.jsx src/components/dashboard/DashboardGrid.jsx
git commit -m "feat: add counter widgets (reels, auditorías, presupuestos)"
```

---

## Task 5: Chart widgets (ECharts)

**Files:**
- Create: `src/components/dashboard/widgets/NoticiasBotWidget.jsx`
- Create: `src/components/dashboard/widgets/LeadsWidget.jsx`
- Create: `src/components/dashboard/widgets/GSCWidget.jsx`
- Create: `src/components/dashboard/widgets/GA4Widget.jsx`
- Create: `src/components/dashboard/widgets/VisitasWidget.jsx`
- Modify: `src/components/dashboard/DashboardGrid.jsx`

**Interfaces:**
- Consumes: `data.noticias`, `data.auditorias.porCiudad`, `data.gsc`, `data.ga4`, Firebase `useBasicStats` hook
- Produces: 5 ECharts-based widget components

- [ ] **Step 1: Create `NoticiasBotWidget.jsx`**

```jsx
'use client';
import ReactECharts from 'echarts-for-react';

export default function NoticiasBotWidget({ data }) {
  if (!data) return <div className="h-full flex items-center justify-center text-gray-300 text-sm">–</div>;

  const { serie = [], porRed = {} } = data;
  const dates = serie.map(s => s.date.slice(5)); // MM-DD

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['FB', 'IG', 'LN', 'X'], bottom: 0, textStyle: { fontSize: 10 } },
    grid: { top: 30, bottom: 40, left: 40, right: 10 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: 'FB', type: 'bar', stack: 'total', data: serie.map(s => s.count), color: '#3b82f6' },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Bot de noticias</p>
        <span className="text-xs text-gray-400">{data.ultimos30} publicaciones (30d)</span>
      </div>
      <div className="flex-1">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `LeadsWidget.jsx`**

```jsx
'use client';
import ReactECharts from 'echarts-for-react';

export default function LeadsWidget({ data }) {
  if (!data) return <div className="h-full flex items-center justify-center text-gray-300 text-sm">–</div>;

  const porCiudad = data.porCiudad || {};
  const sorted = Object.entries(porCiudad)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const cities = sorted.map(([c]) => c.length > 12 ? c.slice(0, 12) + '…' : c);
  const counts = sorted.map(([, v]) => v);

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, bottom: 10, left: 120, right: 20 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', data: cities, axisLabel: { fontSize: 9 } },
    series: [{ type: 'bar', data: counts, color: '#10b981', label: { show: true, position: 'right', fontSize: 9 } }],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Leads por ciudad</p>
        <span className="text-xs text-gray-400">{data.totalNegocios} total</span>
      </div>
      <div className="flex-1">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `GSCWidget.jsx`**

```jsx
'use client';
import ReactECharts from 'echarts-for-react';

export default function GSCWidget({ data }) {
  if (!data) return <div className="h-full flex items-center justify-center text-gray-300 text-sm">–</div>;

  const { serie = [], clicks = 0, impresiones = 0, posicion = 0 } = data;
  const dates  = serie.map(s => s.date.slice(5));
  const clics  = serie.map(s => s.clicks);
  const imps   = serie.map(s => s.impressions);

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Clicks', 'Impresiones'], bottom: 0, textStyle: { fontSize: 10 } },
    grid: { top: 30, bottom: 40, left: 50, right: 60 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
    yAxis: [
      { type: 'value', name: 'Clicks', nameTextStyle: { fontSize: 9 } },
      { type: 'value', name: 'Imp.', nameTextStyle: { fontSize: 9 } },
    ],
    series: [
      { name: 'Clicks',      type: 'line', data: clics, smooth: true, color: '#6366f1', yAxisIndex: 0 },
      { name: 'Impresiones', type: 'line', data: imps,  smooth: true, color: '#a5b4fc', yAxisIndex: 1 },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-4 mb-1 items-center flex-wrap">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">GSC</p>
        <span className="text-xs text-gray-500">{clicks.toLocaleString('es-AR')} clicks</span>
        <span className="text-xs text-gray-500">{impresiones.toLocaleString('es-AR')} imp.</span>
        <span className="text-xs text-gray-500">pos. {posicion}</span>
      </div>
      <div className="flex-1">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `GA4Widget.jsx`**

```jsx
'use client';
import ReactECharts from 'echarts-for-react';

export default function GA4Widget({ data }) {
  if (!data || data.noData) return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">GA4</p>
      <p className="text-xs text-gray-400">Sin datos aún — el tag fue instalado recientemente.</p>
    </div>
  );

  const { serie = [], sesiones = 0, usuarios = 0, paginasVistas = 0 } = data;
  const dates = serie.map(s => s.date.slice(5));
  const sess  = serie.map(s => s.sesiones);
  const users = serie.map(s => s.usuarios);

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Sesiones', 'Usuarios'], bottom: 0, textStyle: { fontSize: 10 } },
    grid: { top: 30, bottom: 40, left: 50, right: 20 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: 'Sesiones', type: 'line', data: sess,  smooth: true, color: '#f59e0b' },
      { name: 'Usuarios', type: 'line', data: users, smooth: true, color: '#fcd34d' },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-4 mb-1 items-center flex-wrap">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">GA4</p>
        <span className="text-xs text-gray-500">{sesiones.toLocaleString('es-AR')} sesiones</span>
        <span className="text-xs text-gray-500">{usuarios.toLocaleString('es-AR')} usuarios</span>
        <span className="text-xs text-gray-500">{paginasVistas.toLocaleString('es-AR')} pág. vistas</span>
      </div>
      <div className="flex-1">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `VisitasWidget.jsx`**

```jsx
'use client';
import ReactECharts from 'echarts-for-react';
import { useBasicStats } from '@/hooks/useFirebaseStats';

export default function VisitasWidget({ data }) {
  const { data: firebaseData } = useBasicStats();

  const visitas = firebaseData?.totalVisits || firebaseData?.visits || data?.visitas?.unicas || 0;
  const likes   = firebaseData?.totalLikes  || firebaseData?.likes  || data?.visitas?.likes  || 0;

  // Simple sparkline: 7-day fake trend from totalVisits (Firebase doesn't expose daily series)
  const sparkOption = {
    grid: { top: 2, bottom: 2, left: 2, right: 2 },
    xAxis: { type: 'category', show: false, data: ['', '', '', '', '', '', ''] },
    yAxis: { type: 'value', show: false },
    series: [{ type: 'line', data: [visitas * 0.6, visitas * 0.7, visitas * 0.75, visitas * 0.85, visitas * 0.9, visitas * 0.95, visitas], smooth: true, color: '#6366f1', lineStyle: { width: 2 }, areaStyle: { opacity: 0.1 }, symbol: 'none' }],
  };

  return (
    <div className="h-full flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Visitas</p>
      <div className="flex gap-4 items-end">
        <div>
          <span className="text-4xl font-bold text-indigo-500">{visitas.toLocaleString('es-AR')}</span>
          <span className="block text-xs text-gray-400">únicas</span>
        </div>
        <div>
          <span className="text-2xl font-bold text-pink-400">{likes.toLocaleString('es-AR')}</span>
          <span className="block text-xs text-gray-400">likes ❤</span>
        </div>
      </div>
      <div className="flex-1 min-h-[40px]">
        <ReactECharts option={sparkOption} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire all chart widgets into `DashboardGrid.jsx`**

Add imports:
```jsx
import NoticiasBotWidget from './widgets/NoticiasBotWidget';
import LeadsWidget from './widgets/LeadsWidget';
import GSCWidget from './widgets/GSCWidget';
import GA4Widget from './widgets/GA4Widget';
import VisitasWidget from './widgets/VisitasWidget';
```

Extend `widgetContent`:
```jsx
const widgetContent = {
  gsc:          <GSCWidget data={data?.gsc} />,
  ga4:          <GA4Widget data={data?.ga4} />,
  noticias:     <NoticiasBotWidget data={data?.noticias} />,
  leads:        <LeadsWidget data={data?.auditorias} />,
  auditorias:   <AuditoriasWidget data={data?.auditorias} />,
  visitas:      <VisitasWidget data={data} />,
  reels:        <ReelsWidget data={data?.reels} />,
  presupuestos: <PresupuestosWidget data={data?.presupuestos} />,
};
```

- [ ] **Step 7: Verify all charts render**

`npm run dev` → `/dashboard`. All 8 widgets should show charts or graceful empty states. Check browser console for ECharts warnings.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/widgets/
git commit -m "feat: add ECharts widgets (noticias, leads, GSC, GA4, visitas)"
```

---

## Task 6: DashboardPublisher — publicar resumen a redes

**Files:**
- Create: `src/components/dashboard/DashboardPublisher.jsx`
- Modify: `src/views/DashboardPage.jsx` (add button + modal)

**Interfaces:**
- Consumes: `data` from `DashboardPage`; existing Make.com webhook URL from `src/utils/makeService.js`
- Produces: modal component that captures grid screenshot + POSTs to Make.com

- [ ] **Step 1: Check makeService.js webhook URL**

Read `src/utils/makeService.js` to confirm the webhook constant name. It should export a function like `sendToMake(payload)`. Use that instead of hardcoding the URL.

```bash
# Quick check:
grep -n "hook.us2.make.com\|MAKE_WEBHOOK\|sendToMake" src/utils/makeService.js
```

- [ ] **Step 2: Create `DashboardPublisher.jsx`**

```jsx
'use client';
import { useState } from 'react';
import html2canvas from 'html2canvas';

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const MAKE_WEBHOOK = 'https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi';

function buildSummaryText(data, period) {
  if (!data) return '';
  const noticias = period === 'week'
    ? (data.noticias?.serie || []).slice(-7).reduce((s, d) => s + d.count, 0)
    : data.noticias?.ultimos30 || 0;
  const leads     = data.auditorias?.totalNegocios || 0;
  const auditorias = data.auditorias?.total || 0;
  const reels     = period === 'week' ? data.reels?.esteMes || 0 : data.reels?.total || 0;
  const visitas   = data.visitas?.unicas || 0;

  return `${period === 'week' ? 'Esta semana' : 'Este mes'}: ${noticias} noticias publicadas, ${reels} reels generados, ${leads} leads encontrados, ${auditorias} auditorías realizadas. Visitas al portfolio: ${visitas.toLocaleString('es-AR')}.`;
}

export default function DashboardPublisher({ data, gridRef }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState('week');
  const [text, setText] = useState('');
  const [networks, setNetworks] = useState({ linkedin: true, instagram: false, facebook: true });
  const [status, setStatus] = useState('idle'); // idle | capturing | uploading | sending | done | error
  const [errorMsg, setErrorMsg] = useState('');

  function handleOpen() {
    setText(buildSummaryText(data, period));
    setOpen(true);
    setStatus('idle');
  }

  function toggleNetwork(net) {
    setNetworks(n => ({ ...n, [net]: !n[net] }));
  }

  async function handlePublish() {
    try {
      setStatus('capturing');
      const canvas = await html2canvas(gridRef.current, {
        useCORS: true,
        allowTaint: false,
        scale: 1,
        backgroundColor: null,
      });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));

      setStatus('uploading');
      const formData = new FormData();
      formData.append('file', blob, 'dashboard.jpg');
      formData.append('upload_preset', 'zone_analysis_images'); // existing unsigned preset
      formData.append('folder', 'dashboard_reports');
      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!upRes.ok) throw new Error('Cloudinary upload failed');
      const { secure_url: imageUrl } = await upRes.json();

      setStatus('sending');
      const makeRes = await fetch(MAKE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dashboard_report',
          text,
          networks,
          imageUrl,
        }),
      });
      if (!makeRes.ok) throw new Error(`Make.com error ${makeRes.status}`);

      setStatus('done');
    } catch (e) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  }

  if (!open) return (
    <button
      onClick={handleOpen}
      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition"
    >
      Publicar resumen
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Publicar resumen</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex gap-2">
          {['week', 'month'].map(p => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setText(buildSummaryText(data, p)); }}
              className={`px-3 py-1 rounded-full text-sm border transition ${period === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:border-indigo-400'}`}
            >
              {p === 'week' ? 'Última semana' : 'Último mes'}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm dark:bg-gray-700 dark:text-white resize-none"
        />

        <div className="flex gap-3">
          {['linkedin', 'instagram', 'facebook'].map(net => (
            <label key={net} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={networks[net]} onChange={() => toggleNetwork(net)} className="w-4 h-4" />
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{net}</span>
            </label>
          ))}
        </div>

        {status === 'error' && <p className="text-red-500 text-sm">{errorMsg}</p>}
        {status === 'done' && <p className="text-emerald-500 text-sm">¡Publicado! Recordá agregar la rama `dashboard_report` en Make.com si aún no está.</p>}

        <button
          onClick={handlePublish}
          disabled={['capturing','uploading','sending'].includes(status)}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition"
        >
          {status === 'idle' && 'Capturar y publicar'}
          {status === 'capturing' && 'Capturando pantalla…'}
          {status === 'uploading' && 'Subiendo imagen…'}
          {status === 'sending'   && 'Enviando a Make.com…'}
          {status === 'done'      && '✓ Publicado'}
          {status === 'error'     && 'Reintentar'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `gridRef` + publisher button to `DashboardPage.jsx`**

```jsx
// Add at top:
import { useRef } from 'react';
import DashboardPublisher from '@/components/dashboard/DashboardPublisher';

// Inside DashboardPage, add:
const gridRef = useRef(null);

// In the header div, replace the ← Admin link area:
<div className="flex items-center gap-3">
  <DashboardPublisher data={data} gridRef={gridRef} />
  <a href="/admin" className="text-sm text-indigo-500 hover:underline">← Admin</a>
</div>

// Wrap DashboardGrid:
<div ref={gridRef}>
  <DashboardGrid data={data} />
</div>
```

- [ ] **Step 4: Test publisher flow**

`npm run dev` → `/dashboard` → click "Publicar resumen".
- Modal opens with auto-generated text ✓
- Period toggle updates text ✓
- "Capturar y publicar": if Cloudinary upload fails (unsigned preset may need to allow `dashboard_reports` folder), check Cloudinary settings — the `zone_analysis_images` preset is already unsigned so it should work.
- After sending: status shows "¡Publicado!"
- In Make.com: the webhook receives the payload. **Manual step**: add a Router branch for `type === 'dashboard_report'` to handle it.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardPublisher.jsx src/views/DashboardPage.jsx
git commit -m "feat: add DashboardPublisher modal — capture + post to Make.com"
```

---

## Task 7: Final polish + deploy

**Files:**
- Modify: `src/app/layout.jsx` (verify GA4 tag renders in production build)
- Verify: `src/app/dashboard/page.jsx` metadata

- [ ] **Step 1: Add link to dashboard from admin panel**

In `src/views/AdminPage.jsx`, find the header area and add a link to `/dashboard`:
```jsx
<a href="/dashboard" className="text-xs text-indigo-400 hover:underline">📊 Dashboard</a>
```
Search for the user greeting or top bar in AdminPage to find the right place.

- [ ] **Step 2: Run build to check for errors**

```bash
npm run build
```

Expected: no TypeScript/ESLint errors. `react-grid-layout` CSS imports are handled by Next.js automatically. If `html2canvas` causes SSR issues, wrap the import dynamically:
```js
// In DashboardPublisher, replace static import with:
const html2canvas = (await import('html2canvas')).default;
// (move inside handlePublish function)
```

- [ ] **Step 3: Add env vars to Vercel**

```powershell
vercel env add NEXT_PUBLIC_GA4_MEASUREMENT_ID production
# paste: G-6ZB4P1VZJE

vercel env add GA4_PROPERTY_ID production
# paste: 499336912
```

- [ ] **Step 4: Deploy**

```bash
git add -A
git commit -m "feat: dashboard polish + GA4 env vars"
git push
```

Expected: Vercel deploys automatically. Navigate to `marianoaliandri.com.ar/dashboard` — should redirect to `/admin` login, then after login show the full dashboard.

- [ ] **Step 5: Post-deploy manual step — Make.com Router branch**

In Make.com scenario 3816858, add a new Router branch with filter:
- Condition: `type` equals `dashboard_report`
- Modules: Facebook post + Instagram post (or LinkedIn) using `text` and `imageUrl` fields from the payload
