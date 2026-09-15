# Páginas de detalle por proyecto + medios subibles/publicables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada proyecto del portfolio consigue una página pública de detalle (`/proyectos/{domain}/`) con stack, funcionalidades, impacto y una galería de fotos/videos que Mariano puede subir y marcar como publicables desde el admin.

**Architecture:** Un nuevo campo `media` (array) en el doc Firestore `proyectos/{domain}` que ya existe, escrito por una ruta nueva `/api/proyectos/media`. El admin sube archivos directo a Cloudinary (reusando `cloudinaryService.js` ya existente) y llama a esa ruta para guardar la referencia. La página nueva `/proyectos/[domain]/page.jsx` lee Firestore y GSC directo (mismo patrón que `/auditorias/[id]/page.jsx`) y solo muestra los `media` marcados `publicable`. La grilla del home enlaza cada card a esa página nueva.

**Tech Stack:** Next.js App Router (Route Handlers + Server Components), Firebase Admin (`getDb()`), `googleapis` (GSC), Cloudinary (unsigned upload ya existente).

**Spec:** `docs/superpowers/specs/2026-09-15-project-detail-pages-and-media.md`

## Global Constraints

- Reusar `cloudinaryService.uploadBase64Image` / `uploadBase64Video` de `src/utils/cloudinaryService.js` tal cual existen hoy — no crear un preset nuevo ni un flujo de subida distinto.
- Forma exacta de cada item de `media`: `{ id: string, url: string, type: 'image'|'video', publicable: boolean, uploadedAt: number }`. `id` se genera con `crypto.randomUUID()` (Node `crypto`, mismo import que ya usa `capture-projects/route.js`).
- Sin endpoint de borrado de medios — explícitamente fuera de alcance.
- `/proyectos/[domain]/page.jsx` lee Firestore (`getDb()`) y GSC (`getGSCAuth()`/`getVerifiedSites()`) **directo**, nunca con `fetch()` a la propia API — regla ya establecida en el CLAUDE.md de este proyecto (el self-fetch causaba 404 intermitentes en `/auditorias`).
- Sin schema.org más allá de `BreadcrumbList` en la página nueva.
- Este proyecto no tiene test framework (cero tests/CI). La verificación de cada tarea es contra el servidor de desarrollo real (curl / build), no unit tests con mocks.

---

## Task 1: Backend — ruta de medios + `GET /api/proyectos` extendido

**Files:**
- Create: `src/app/api/proyectos/media/route.js`
- Modify: `src/app/api/proyectos/route.js:89-94`

**Interfaces:**
- Produces: `POST /api/proyectos/media` con body `{ domain, url, type }` → `{ success: true, media: Array<MediaItem> }`. `PATCH /api/proyectos/media` con body `{ domain, mediaId, publicable }` → `{ success: true, media: Array<MediaItem> }`. `GET /api/proyectos` (ya existente) ahora incluye `media: Array<MediaItem>` por proyecto. `MediaItem = { id, url, type, publicable, uploadedAt }` — Task 2 y Task 3 consumen esta forma exacta.

- [ ] **Step 1: Crear `src/app/api/proyectos/media/route.js`**

```js
export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { getDb } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    const { domain, url, type } = await request.json();
    if (!domain || !url || !type) {
      return Response.json({ error: 'domain, url y type son requeridos' }, { status: 400 });
    }
    if (type !== 'image' && type !== 'video') {
      return Response.json({ error: 'type debe ser "image" o "video"' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'Firestore no disponible' }, { status: 500 });

    const docRef = db.collection('proyectos').doc(domain);
    const snap = await docRef.get();
    const existingMedia = snap.data()?.media || [];

    const item = {
      id: crypto.randomUUID(),
      url,
      type,
      publicable: true,
      uploadedAt: Date.now(),
    };
    const media = [...existingMedia, item];

    await docRef.set({ media }, { merge: true });

    return Response.json({ success: true, media });
  } catch (error) {
    return Response.json({ error: 'Error subiendo medio', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { domain, mediaId, publicable } = await request.json();
    if (!domain || !mediaId || typeof publicable !== 'boolean') {
      return Response.json({ error: 'domain, mediaId y publicable (boolean) son requeridos' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'Firestore no disponible' }, { status: 500 });

    const docRef = db.collection('proyectos').doc(domain);
    const snap = await docRef.get();
    const existingMedia = snap.data()?.media || [];

    if (!existingMedia.some(m => m.id === mediaId)) {
      return Response.json({ error: `No se encontró el medio ${mediaId}` }, { status: 400 });
    }

    const media = existingMedia.map(m => (m.id === mediaId ? { ...m, publicable } : m));
    await docRef.set({ media }, { merge: true });

    return Response.json({ success: true, media });
  } catch (error) {
    return Response.json({ error: 'Error actualizando medio', details: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Extender `GET` en `src/app/api/proyectos/route.js`**

En el `.map()` que arma cada proyecto, reemplazar:

```js
          descripcionCorta: fs.descripcionCorta || '',
          stack: fs.stack || '',
          funcionalidades: fs.funcionalidades || '',
          impacto: fs.impacto || '',
          orden: fs.orden ?? 99,
```

por:

```js
          descripcionCorta: fs.descripcionCorta || '',
          stack: fs.stack || '',
          funcionalidades: fs.funcionalidades || '',
          impacto: fs.impacto || '',
          media: fs.media || [],
          orden: fs.orden ?? 99,
```

- [ ] **Step 3: Verificar contra el servidor real**

Levantar `npm run dev` en background y esperar `✓ Ready`.

Usar un dominio real ya verificado en GSC, por ejemplo `marianoaliandri.com.ar`, y la imagen pública de demo de Cloudinary como URL de prueba (no hace falta subir nada de verdad para probar esta ruta — ya recibe una `url` hecha):

```bash
curl -s -X POST http://localhost:3000/api/proyectos/media \
  -H "Content-Type: application/json" \
  -d '{"domain":"marianoaliandri.com.ar","url":"https://res.cloudinary.com/demo/image/upload/sample.jpg","type":"image"}'
```

Expected: `{"success":true,"media":[{"id":"...","url":"https://res.cloudinary.com/demo/image/upload/sample.jpg","type":"image","publicable":true,"uploadedAt":...}]}`. Guardar el `id` devuelto.

```bash
curl -s -X PATCH http://localhost:3000/api/proyectos/media \
  -H "Content-Type: application/json" \
  -d '{"domain":"marianoaliandri.com.ar","mediaId":"<EL_ID_DE_ARRIBA>","publicable":false}'
```

Expected: mismo item con `"publicable":false`.

```bash
curl -s "http://localhost:3000/api/proyectos?all=1" | grep -o '"marianoaliandri.com.ar"[^}]*"media":\[[^]]*\]'
```

Expected: confirma que `media` aparece en la respuesta de `GET /api/proyectos` con el item recién creado.

- [ ] **Step 4: Limpiar el item de prueba de Firestore**

Este item de prueba quedaría para siempre porque no hay endpoint de borrado (fuera de alcance). Borrarlo con un script temporal usando el mismo patrón que ya se usó en la sesión anterior para probar Drive (Admin SDK directo, se borra al terminar):

Crear `/tmp-cleanup-media-test.mjs` en la raíz del proyecto:

```js
import fs from 'fs';
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
  const idx = line.indexOf('=');
  if (idx === -1) return;
  const key = line.slice(0, idx).trim();
  let val = line.slice(idx + 1);
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  process.env[key] = val;
});

const admin = (await import('firebase-admin')).default;
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const ref = db.collection('proyectos').doc('marianoaliandri.com.ar');
const snap = await ref.get();
const media = (snap.data()?.media || []).filter(m => m.url !== 'https://res.cloudinary.com/demo/image/upload/sample.jpg');
await ref.set({ media }, { merge: true });
console.log('Limpio. Items de media restantes:', media.length);
```

Run: `node --input-type=module /tmp-cleanup-media-test.mjs` (o guardarlo con extensión `.mjs`).

Expected: `Limpio. Items de media restantes: <lo que ya hubiera antes, sin el de prueba>`.

- [ ] **Step 5: Borrar el script de limpieza**

```bash
rm /tmp-cleanup-media-test.mjs
```

Frenar el dev server.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/proyectos/media/route.js src/app/api/proyectos/route.js
git commit -m "feat: agrega API para subir y publicar medios por proyecto"
```

---

## Task 2: Admin — subir, ver, publicar y descargar medios

**Files:**
- Modify: `src/views/AdminPage.jsx`

**Interfaces:**
- Consumes: `POST /api/proyectos/media`, `PATCH /api/proyectos/media`, y `p.media` (viene de `GET /api/proyectos`) de Task 1.

- [ ] **Step 1: Agregar el import de `cloudinaryService`**

Cerca de la línea 6 (`import { db, firebaseQA } from '../utils/firebaseservice';`), agregar:

```js
import cloudinaryService from '../utils/cloudinaryService';
```

- [ ] **Step 2: Agregar estado nuevo en `AdminProyectosPanel`**

Junto a los `useState` que ya existen (cerca de la línea 997, después de `const [lightbox, setLightbox] = useState(null);`):

```js
const [uploadingMedia, setUploadingMedia] = useState(null); // domain en curso, o null
```

- [ ] **Step 3: Agregar los tres handlers**

Cerca de `handleSave` (después de su cierre, alrededor de la línea 1064), agregar:

```js
  const handleMediaUpload = async (domain, file) => {
    setUploadingMedia(domain);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const isVideo = file.type.startsWith('video/');
      const url = isVideo
        ? await cloudinaryService.uploadBase64Video(base64, `proyectos-media/${domain}`)
        : await cloudinaryService.uploadBase64Image(base64, `proyectos-media/${domain}`);

      const res = await fetch('/api/proyectos/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, url, type: isVideo ? 'video' : 'image' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error guardando el medio');
      await loadProyectos();
    } catch (err) {
      alert('❌ Error subiendo archivo: ' + err.message);
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleTogglePublicable = async (domain, mediaId, publicable) => {
    try {
      const res = await fetch('/api/proyectos/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, mediaId, publicable }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error actualizando');
      await loadProyectos();
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };

  const handleDownloadMedia = async (url, filename) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert('❌ Error descargando: ' + err.message);
    }
  };
```

- [ ] **Step 4: Insertar el bloque "Fotos y videos" en el JSX**

Entre el cierre del campo "Dato de impacto" y la fila de "Orden/Visible/Guardar" (reemplazar este fragmento — la parte antes y después queda igual, solo se inserta el bloque nuevo en el medio):

Reemplazar:

```jsx
                <div>
                  <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Dato de impacto</label>
                  <textarea
                    rows={2}
                    value={e.impacto}
                    onChange={ev => setField(p.domain, 'impacto', ev.target.value)}
                    placeholder="→ 97/100 de salud SEO en Ahrefs, indexado en GSC con presencia en búsquedas de..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-4 pt-1">
```

por:

```jsx
                <div>
                  <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Dato de impacto</label>
                  <textarea
                    rows={2}
                    value={e.impacto}
                    onChange={ev => setField(p.domain, 'impacto', ev.target.value)}
                    placeholder="→ 97/100 de salud SEO en Ahrefs, indexado en GSC con presencia en búsquedas de..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Fotos y videos</label>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      disabled={uploadingMedia === p.domain}
                      onChange={ev => {
                        const file = ev.target.files?.[0];
                        if (file) handleMediaUpload(p.domain, file);
                        ev.target.value = '';
                      }}
                      className="text-xs text-gray-500 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
                    />
                    {uploadingMedia === p.domain && <span className="text-xs text-indigo-500">Subiendo...</span>}
                  </div>
                  {p.media?.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {p.media.map(m => (
                        <div key={m.id} className="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                          {m.type === 'video' ? (
                            <video src={m.url} muted className="w-full h-20 object-cover bg-black" />
                          ) : (
                            <img src={m.url} alt="" className="w-full h-20 object-cover" />
                          )}
                          <div className="p-1.5 space-y-1">
                            <label className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                              <input
                                type="checkbox"
                                checked={m.publicable}
                                onChange={ev => handleTogglePublicable(p.domain, m.id, ev.target.checked)}
                                className="w-3 h-3"
                              />
                              Publicable
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDownloadMedia(m.url, `${p.domain}-${m.id}.${m.type === 'video' ? 'mp4' : 'jpg'}`)}
                              className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700"
                            >
                              Descargar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-1">
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: build exitoso, sin errores en `src/views/AdminPage.jsx`.

- [ ] **Step 6: Verificación visual (si hay credenciales de admin disponibles)**

Si quien ejecuta este plan tiene login de admin disponible, entrar a `/admin` → tab Proyectos → expandir un proyecto → subir una foto real → confirmar que aparece la miniatura con el toggle "Publicable" prendido → apagarlo → recargar y confirmar que quedó apagado → tocar "Descargar" y confirmar que se descarga el archivo real (no que abre una pestaña). Repetir subiendo un archivo de video corto (cualquier `.mp4` chico sirve) para confirmar que la rama `isVideo` también sube y guarda bien — es la única parte de este componente que el build no puede verificar por sí solo, porque decide `uploadBase64Video` vs `uploadBase64Image` según `file.type` en tiempo de ejecución. Si no hay credenciales en la sesión, saltar todo este Step — el build limpio del Step 5 más la verificación de la API real del Task 1 ya cubren el resto de la lógica, pero la rama de video queda sin verificación real en ese caso; anotarlo como concern en el reporte.

- [ ] **Step 7: Commit**

```bash
git add src/views/AdminPage.jsx
git commit -m "feat: admin puede subir fotos/videos por proyecto y marcarlos publicables"
```

---

## Task 3: Página pública `/proyectos/[domain]/`

**Files:**
- Create: `src/app/proyectos/[domain]/page.jsx`

**Interfaces:**
- Consumes: doc Firestore `proyectos/{domain}` (campo `media`, forma `MediaItem` de Task 1) y `getGSCAuth()`/`getVerifiedSites()` de `@/lib/gscClient`, `getDb()` de `@/lib/firebase-admin` — ambos ya existen, sin cambios.
- Produces: la ruta `/proyectos/{domain}/` — Task 4 la consume como destino del link.

- [ ] **Step 1: Crear `src/app/proyectos/[domain]/page.jsx`**

```jsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { google } from 'googleapis';
import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

function getDateRange(days = 28, lag = 3) {
  const end = new Date();
  end.setDate(end.getDate() - lag);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

async function getProyecto(domain) {
  const auth = getGSCAuth();
  const sites = await getVerifiedSites(auth);
  const site = sites.find(s => s.domain === domain);
  if (!site) return null;

  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const dateRange = getDateRange();
  let clicks = 0;
  let impressions = 0;
  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: site.siteUrl,
      requestBody: { startDate: dateRange.startDate, endDate: dateRange.endDate, dimensions: [], rowLimit: 1 },
    });
    const row = res.data.rows?.[0] || {};
    clicks = row.clicks || 0;
    impressions = row.impressions || 0;
  } catch {
    // Sin stats disponibles, se muestran en 0 — no debe romper la página.
  }

  const db = getDb();
  const fsDoc = db ? (await db.collection('proyectos').doc(domain).get()).data() || {} : {};

  return {
    domain: site.domain,
    url: site.url,
    screenshotUrl: CLOUD_NAME
      ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200/MarianWeb/${site.domain}?v=${fsDoc.screenshotUpdatedAt || 0}`
      : null,
    descripcionCorta: fsDoc.descripcionCorta || '',
    stack: fsDoc.stack || '',
    funcionalidades: fsDoc.funcionalidades || '',
    impacto: fsDoc.impacto || '',
    media: (fsDoc.media || []).filter(m => m.publicable),
    clicks,
    impressions,
  };
}

export async function generateMetadata({ params }) {
  const { domain } = await params;
  const p = await getProyecto(domain);
  if (!p) return { title: 'Proyecto no encontrado' };
  const url = `https://marianoaliandri.com.ar/proyectos/${domain}/`;
  const nombre = p.descripcionCorta?.split('·')[0]?.trim() || domain;
  const description = `${p.descripcionCorta} ${p.impacto}`.trim().slice(0, 160) || `Proyecto realizado por Mariano Aliandri: ${domain}`;
  return {
    title: `${nombre} | Proyectos | Mariano Aliandri`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: `${nombre} | Proyectos`,
      description,
      images: p.screenshotUrl ? [{ url: p.screenshotUrl, width: 1200, height: 630, alt: nombre }] : undefined,
    },
  };
}

export default async function ProyectoDetailPage({ params }) {
  const { domain } = await params;
  const p = await getProyecto(domain);
  if (!p) notFound();

  const nombre = p.descripcionCorta?.split('·')[0]?.trim() || domain;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://marianoaliandri.com.ar/' },
      { '@type': 'ListItem', position: 2, name: 'Proyectos', item: 'https://marianoaliandri.com.ar/#proyectos' },
      { '@type': 'ListItem', position: 3, name: nombre, item: `https://marianoaliandri.com.ar/proyectos/${domain}/` },
    ],
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20 px-4 md:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="max-w-4xl mx-auto">
        <Link href="/#proyectos" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 inline-block">
          ← Todos los proyectos
        </Link>

        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{nombre}</h1>
        {p.descripcionCorta && <p className="text-gray-400 text-base mb-8">{p.descripcionCorta}</p>}

        {p.screenshotUrl && (
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-8">
            <img src={p.screenshotUrl} alt={nombre} className="w-full object-cover" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-[#111] border border-white/10 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-white">{p.clicks}</div>
            <div className="text-xs text-gray-500 mt-1">Clicks (28 días)</div>
          </div>
          <div className="bg-[#111] border border-white/10 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-white">{p.impressions}</div>
            <div className="text-xs text-gray-500 mt-1">Impresiones (28 días)</div>
          </div>
        </div>

        {p.stack && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Stack técnico</p>
            <p className="text-gray-300 text-sm leading-relaxed">{p.stack}</p>
          </div>
        )}

        {p.funcionalidades && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Funcionalidades destacadas</p>
            <ul className="text-gray-300 text-sm leading-relaxed space-y-1 list-disc list-inside">
              {p.funcionalidades.split('\n').filter(Boolean).map((linea, i) => (
                <li key={i}>{linea.replace(/^→\s*/, '')}</li>
              ))}
            </ul>
          </div>
        )}

        {p.impacto && (
          <div className="mb-8 bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-5">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Impacto</p>
            <p className="text-gray-300 text-sm leading-relaxed">{p.impacto}</p>
          </div>
        )}

        {p.media.length > 0 && (
          <div className="mb-10">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Galería</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {p.media.map(m => (
                <div key={m.id} className="rounded-xl overflow-hidden border border-white/10">
                  {m.type === 'video' ? (
                    <video src={m.url} controls className="w-full h-40 object-cover bg-black" />
                  ) : (
                    <img src={m.url} alt={nombre} className="w-full h-40 object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[#111] border border-white/10 rounded-2xl px-8 py-6">
          <div>
            <p className="text-white font-bold text-lg">¿Querés algo parecido para tu negocio?</p>
            <p className="text-gray-500 text-sm mt-1">Hablemos. Primera consulta sin cargo.</p>
          </div>
          <Link
            href="/presupuesto"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
          >
            Pedir presupuesto <span aria-hidden>→</span>
          </Link>
        </div>

        <p className="text-center text-xs text-gray-700 mt-8">
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors">
            Ver sitio en vivo ↗
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verificar contra el servidor real**

Levantar `npm run dev` en background, esperar `✓ Ready`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/proyectos/marianoaliandri.com.ar/
```

Expected: `200`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/proyectos/dominio-que-no-existe-123/
```

Expected: `404`.

```bash
curl -s http://localhost:3000/proyectos/marianoaliandri.com.ar/ | grep -o '<title[^>]*>[^<]*</title>'
```

Expected: un `<title>` con el nombre del proyecto, no genérico.

Ahora verificar que la galería respeta `publicable` de verdad (no solo que el campo existe). Con el dev server todavía arriba, crear un item de prueba vía la API que ya construyó Task 1, publicable por defecto:

```bash
curl -s -X POST http://localhost:3000/api/proyectos/media \
  -H "Content-Type: application/json" \
  -d '{"domain":"marianoaliandri.com.ar","url":"https://res.cloudinary.com/demo/image/upload/sample.jpg","type":"image"}'
```

Guardar el `id` devuelto, y confirmar que la página lo muestra:

```bash
curl -s http://localhost:3000/proyectos/marianoaliandri.com.ar/ | grep -c "res.cloudinary.com/demo/image/upload/sample.jpg"
```

Expected: `1` (aparece en la galería).

Apagar `publicable` y confirmar que desaparece:

```bash
curl -s -X PATCH http://localhost:3000/api/proyectos/media \
  -H "Content-Type: application/json" \
  -d '{"domain":"marianoaliandri.com.ar","mediaId":"<EL_ID>","publicable":false}'

curl -s http://localhost:3000/proyectos/marianoaliandri.com.ar/ | grep -c "res.cloudinary.com/demo/image/upload/sample.jpg"
```

Expected: `0` (ya no aparece — la página solo muestra medios `publicable: true`, confirmando el filtro de `getProyecto`).

Limpiar este item de prueba con el mismo script temporal del Task 1 Step 4 (recrearlo, correrlo, borrarlo — no debe quedar en el repo ni el item de prueba en Firestore).

Frenar el dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/proyectos/
git commit -m "feat: página de detalle pública por proyecto"
```

---

## Task 4: Enlazar la grilla del home a la página de detalle

**Files:**
- Modify: `src/components/home/ProyectosGrid.jsx:1-137`

**Interfaces:**
- Consumes: la ruta `/proyectos/{domain}/` de Task 3.

- [ ] **Step 1: Agregar el import de `Link`**

Al principio del archivo (línea 1-6), agregar junto a los demás imports:

```js
import Link from 'next/link';
```

- [ ] **Step 2: Envolver el contenido clickeable de la card en un `Link`**

Reemplazar la función `ProyectoCard` completa:

```jsx
function ProyectoCard({ proyecto, index }) {
  const tag = getTag(proyecto);
  const domainClean = proyecto.domain.replace(/^sc-domain:/, '');

  return (
    <motion.div
      className="group rounded-2xl bg-[#111] border border-white/10 overflow-hidden hover:border-indigo-500/40 transition-colors duration-300"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      {/* Screenshot with tag */}
      <div className="relative">
        <ScreenshotImage src={proyecto.screenshotUrl} fallbackSrc={proyecto.screenshotFallbackUrl} domain={domainClean} />
        <span className="absolute top-3 right-3 bg-black/70 border border-white/10 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
          {tag}
        </span>
      </div>

      <div className="p-5">
        {/* Name + description */}
        <h3 className="font-bold text-white text-base truncate">
          {proyecto.descripcionCorta?.split('·')[0]?.trim() || domainClean}
        </h3>
        <p className="text-gray-500 text-sm mt-0.5 truncate">
          {proyecto.descripcionCorta || domainClean}
        </p>

        {/* GSC Metrics */}
        <div className="flex items-center gap-5 mt-4">
          <div className="flex flex-col items-start">
            <span className="text-white font-bold text-sm">{formatNum(proyecto.clicks)}</span>
            <span className="text-gray-600 text-xs">Clicks</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-white font-bold text-sm">{formatNum(proyecto.impressions)}</span>
            <span className="text-gray-600 text-xs">Impresiones</span>
          </div>
          {proyecto.position && (
            <div className="flex flex-col items-start">
              <span className="text-white font-bold text-sm">{Number(proyecto.position).toFixed(1)}</span>
              <span className="text-gray-600 text-xs">Posición</span>
            </div>
          )}
        </div>

        {/* Domain + link */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <span className="text-gray-600 text-xs truncate">{domainClean}</span>
          <a
            href={proyecto.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-white transition-colors ml-2 flex-shrink-0"
            aria-label={`Ver ${domainClean}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </motion.div>
  );
}
```

por:

```jsx
function ProyectoCard({ proyecto, index }) {
  const tag = getTag(proyecto);
  const domainClean = proyecto.domain.replace(/^sc-domain:/, '');
  const detailHref = `/proyectos/${domainClean}/`;

  return (
    <motion.div
      className="group rounded-2xl bg-[#111] border border-white/10 overflow-hidden hover:border-indigo-500/40 transition-colors duration-300"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <Link href={detailHref} className="block">
        {/* Screenshot with tag */}
        <div className="relative">
          <ScreenshotImage src={proyecto.screenshotUrl} fallbackSrc={proyecto.screenshotFallbackUrl} domain={domainClean} />
          <span className="absolute top-3 right-3 bg-black/70 border border-white/10 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
            {tag}
          </span>
        </div>

        <div className="px-5 pt-5">
          {/* Name + description */}
          <h3 className="font-bold text-white text-base truncate">
            {proyecto.descripcionCorta?.split('·')[0]?.trim() || domainClean}
          </h3>
          <p className="text-gray-500 text-sm mt-0.5 truncate">
            {proyecto.descripcionCorta || domainClean}
          </p>

          {/* GSC Metrics */}
          <div className="flex items-center gap-5 mt-4">
            <div className="flex flex-col items-start">
              <span className="text-white font-bold text-sm">{formatNum(proyecto.clicks)}</span>
              <span className="text-gray-600 text-xs">Clicks</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-white font-bold text-sm">{formatNum(proyecto.impressions)}</span>
              <span className="text-gray-600 text-xs">Impresiones</span>
            </div>
            {proyecto.position && (
              <div className="flex flex-col items-start">
                <span className="text-white font-bold text-sm">{Number(proyecto.position).toFixed(1)}</span>
                <span className="text-gray-600 text-xs">Posición</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Domain + external link — fuera del Link de arriba: un <a> no puede anidarse dentro de otro <a> */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <span className="text-gray-600 text-xs truncate">{domainClean}</span>
          <a
            href={proyecto.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-white transition-colors ml-2 flex-shrink-0"
            aria-label={`Ver ${domainClean}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Verificar en el navegador**

Levantar `npm run dev`, abrir `http://localhost:3000/` en un browser real (o con `agent-browser` si está disponible en la sesión que ejecuta esto), scrollear a la sección Proyectos, click en el cuerpo de una card → debe navegar a `/proyectos/{ese-dominio}/`. Volver atrás, click en la flechita de la esquina de una card → debe abrir el sitio real en pestaña nueva, **no** la página de detalle.

Frenar el dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/ProyectosGrid.jsx
git commit -m "feat: las cards de proyectos enlazan a su página de detalle"
```
