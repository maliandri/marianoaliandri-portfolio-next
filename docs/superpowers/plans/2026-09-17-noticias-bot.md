# Bot de noticias autónomo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un bot que cada hora busca noticias de tópicos configurables desde el admin, las redacta con Gemini, las publica en `/noticias` del sitio y las manda a Facebook/LinkedIn/Instagram vía el webhook de Make ya existente — corriendo entero en GitHub Actions, sin tocar Vercel.

**Architecture:** Un script Node autocontenido (`scripts/noticias-bot.mjs`) que un workflow de GitHub Actions dispara cada hora. El script habla directo con Firestore (Admin SDK), Google News RSS, Gemini, Cloudinary y el webhook de Make — nunca le pega a una ruta `/api/` del sitio. El sitio (Vercel) solo lee lo que el bot ya escribió en Firestore, igual que `/auditorias`. El admin gestiona tópicos y el interruptor on/off a través de rutas `/api/noticias/*` normales de Next.js.

**Tech Stack:** Next.js App Router (Server Components + Route Handlers), Firebase Admin SDK, GitHub Actions (`schedule` cron), Google News RSS, Gemini 2.5 Flash (REST, sin SDK), Cloudinary (unsigned upload), `fast-xml-parser` (dependencia nueva).

**Spec:** `docs/superpowers/specs/2026-09-17-noticias-bot-design.md`

## Global Constraints

- El bot **nunca** llama a una ruta `/api/` del propio sitio — todo el pipeline (RSS, Gemini, imagen, Firestore, Make) corre dentro de `scripts/noticias-bot.mjs`, ejecutado por GitHub Actions, no por Vercel.
- El script no puede importar archivos de `src/` (son `.js` sin `"type":"module"` en `package.json`, tratados como CommonJS por Node — no se puede `import` sintaxis ESM desde un `.mjs` externo a Next). Duplica lo mínimo que necesita (init de Firebase Admin, `getScreenshot`) en vez de compartir código con `src/lib`. Esto es una desviación intencional de la spec §6 (que proponía un `src/lib/microlink.js` compartido) — se documenta acá porque técnicamente no funciona con este runtime.
- Frecuencia: 1 vez por hora. Sin tope diario por defecto (`dailyCap: null` = sin límite); el tope es opcional y configurable desde el admin.
- La imagen que se manda a Make **siempre** es la URL de Cloudinary, nunca la de Microlink directamente.
- Caption única (un solo texto) para Facebook, LinkedIn e Instagram — sin redacción distinta por red en esta versión.
- Sin cola de aprobación — publica de punta a punta. El único control humano es `noticias_config.active`.
- Payload a Make: mismos nombres de campo que ya usan `SocialPublisher`/`CanvasReelGenerator` — `text`, `networks`, `type`, `useAI`, `imageUrl`. No se inventan campos nuevos.
- `trailingSlash: true` está activo en `next.config.mjs` — todas las rutas y links nuevos llevan barra final.
- Este proyecto no tiene framework de tests (cero tests/CI existente). La verificación de cada tarea es contra el servidor de desarrollo real y, para el script, contra Firestore/Gemini/Make reales — no unit tests con mocks.
- Firestore: evitar queries que necesiten un índice compuesto (equality + range en campos distintos) — no hay forma de crear el índice como parte de este plan. Donde haga falta filtrar por dos campos, se trae por un solo campo (`orderBy` o `where` simple) y se filtra el resto en memoria.

---

## Task 1: Datos + API de administración (`noticias_topics`, `noticias_config`, log de `noticias`)

**Files:**
- Create: `src/app/api/noticias/topics/route.js`
- Create: `src/app/api/noticias/config/route.js`
- Create: `src/app/api/noticias/route.js`

**Interfaces:**
- Produces:
  - `GET /api/noticias/topics` → `{ topics: Array<{ id, label, query, activo, createdAt }> }`
  - `POST /api/noticias/topics` body `{ label: string, query?: string }` → `{ success: true, topic: {...} }`
  - `PATCH /api/noticias/topics` body `{ id: string, activo: boolean }` → `{ success: true }`
  - `GET /api/noticias/config` → `{ active: boolean, dailyCap: number|null }` (default `{active:true, dailyCap:null}` si el doc no existe)
  - `PATCH /api/noticias/config` body `{ active?: boolean, dailyCap?: number|null }` → `{ success: true, active, dailyCap }`
  - `GET /api/noticias` → `{ noticias: Array<{ id, topicLabel, title, sourceUrl, imageUrl, status, makeError, publishedAt }> }` (últimas 50, para el log del admin — incluye `status:'error'`, no filtra)
- Consumidores futuros: Task 2 (admin UI) consume las 5 rutas de arriba. Task 4/5 (el bot) NO usa estas rutas — habla con Firestore directo, pero escribe con la misma forma de doc que `GET /api/noticias` lee.

- [ ] **Step 1: Crear `src/app/api/noticias/topics/route.js`**

```js
export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const snap = await db.collection('noticias_topics').orderBy('createdAt', 'desc').get();
    const topics = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        label: data.label,
        query: data.query || data.label,
        activo: data.activo !== false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    return Response.json({ topics });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { label, query } = await request.json();
    if (!label || !label.trim()) {
      return Response.json({ error: 'label es requerido' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const docRef = await db.collection('noticias_topics').add({
      label: label.trim(),
      query: (query && query.trim()) || label.trim(),
      activo: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,
      topic: { id: docRef.id, label: label.trim(), query: (query && query.trim()) || label.trim(), activo: true },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, activo } = await request.json();
    if (!id || typeof activo !== 'boolean') {
      return Response.json({ error: 'id y activo (boolean) son requeridos' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    await db.collection('noticias_topics').doc(id).update({ activo });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Crear `src/app/api/noticias/config/route.js`**

```js
export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';

const DEFAULTS = { active: true, dailyCap: null };

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const doc = await db.collection('noticias_config').doc('settings').get();
    if (!doc.exists) return Response.json(DEFAULTS);

    const data = doc.data();
    return Response.json({
      active: data.active !== false,
      dailyCap: data.dailyCap ?? null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const update = {};
    if ('active' in body) {
      if (typeof body.active !== 'boolean') return Response.json({ error: 'active debe ser boolean' }, { status: 400 });
      update.active = body.active;
    }
    if ('dailyCap' in body) {
      if (body.dailyCap !== null && (typeof body.dailyCap !== 'number' || body.dailyCap < 1)) {
        return Response.json({ error: 'dailyCap debe ser null o un número >= 1' }, { status: 400 });
      }
      update.dailyCap = body.dailyCap;
    }
    if (!Object.keys(update).length) {
      return Response.json({ error: 'Nada para actualizar (active o dailyCap)' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    await db.collection('noticias_config').doc('settings').set(update, { merge: true });

    const doc = await db.collection('noticias_config').doc('settings').get();
    const data = doc.data();
    return Response.json({ success: true, active: data.active !== false, dailyCap: data.dailyCap ?? null });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Crear `src/app/api/noticias/route.js`**

```js
export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const snap = await db.collection('noticias').orderBy('publishedAt', 'desc').limit(50).get();
    const noticias = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        topicLabel: data.topicLabel || null,
        title: data.title || null,
        sourceUrl: data.sourceUrl || null,
        imageUrl: data.imageUrl || null,
        status: data.status || null,
        makeError: data.makeError || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      };
    });
    return Response.json({ noticias });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verificar contra el servidor real**

Levantar `npm run dev` en background y esperar `✓ Ready`.

```bash
curl -s -X POST http://localhost:3000/api/noticias/topics \
  -H "Content-Type: application/json" \
  -d '{"label":"inteligencia artificial"}'
```

Expected: `{"success":true,"topic":{"id":"...","label":"inteligencia artificial","query":"inteligencia artificial","activo":true}}`. Guardar el `id`.

```bash
curl -s http://localhost:3000/api/noticias/topics
```

Expected: `{"topics":[{"id":"...","label":"inteligencia artificial","query":"inteligencia artificial","activo":true,"createdAt":"..."}]}`.

```bash
curl -s -X PATCH http://localhost:3000/api/noticias/topics \
  -H "Content-Type: application/json" \
  -d '{"id":"<EL_ID>","activo":false}'

curl -s http://localhost:3000/api/noticias/topics
```

Expected: el mismo tópico ahora con `"activo":false`.

```bash
curl -s http://localhost:3000/api/noticias/config
```

Expected: `{"active":true,"dailyCap":null}` (default, todavía no existe el doc).

```bash
curl -s -X PATCH http://localhost:3000/api/noticias/config \
  -H "Content-Type: application/json" \
  -d '{"dailyCap":3}'

curl -s http://localhost:3000/api/noticias/config
```

Expected: `{"active":true,"dailyCap":3}` en ambas respuestas.

```bash
curl -s -X PATCH http://localhost:3000/api/noticias/config \
  -H "Content-Type: application/json" \
  -d '{"active":false}'

curl -s http://localhost:3000/api/noticias/config
```

Expected: `{"active":false,"dailyCap":3}` (confirma que `PATCH` con un solo campo no borra el otro).

```bash
curl -s http://localhost:3000/api/noticias
```

Expected: `{"noticias":[]}` (todavía no publicó nada el bot).

- [ ] **Step 5: Dejar `noticias_config.active` en `true` para las próximas tareas**

```bash
curl -s -X PATCH http://localhost:3000/api/noticias/config \
  -H "Content-Type: application/json" \
  -d '{"active":true}'
```

Frenar el dev server.

- [ ] **Step 6: Correr eslint**

Run: `npx eslint src/app/api/noticias`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/noticias
git commit -m "feat: API de admin para tópicos y config del bot de noticias"
```

---

## Task 2: Admin — tab "Noticias (Bot)"

**Files:**
- Create: `src/components/admin/NoticiasBotManager.jsx`
- Modify: `src/data/adminNav.js`
- Modify: `src/views/AdminPage.jsx`

**Interfaces:**
- Consumes: las 5 rutas de Task 1 (`GET/POST/PATCH /api/noticias/topics`, `GET/PATCH /api/noticias/config`, `GET /api/noticias`).

- [ ] **Step 1: Crear `src/components/admin/NoticiasBotManager.jsx`**

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NoticiasBotManager() {
  const [topics, setTopics]     = useState([]);
  const [config, setConfig]     = useState({ active: true, dailyCap: null });
  const [log, setLog]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [capInput, setCapInput] = useState('');
  const [busy, setBusy]         = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes, lRes] = await Promise.all([
        fetch('/api/noticias/topics'),
        fetch('/api/noticias/config'),
        fetch('/api/noticias'),
      ]);
      const [tData, cData, lData] = await Promise.all([tRes.json(), cRes.json(), lRes.json()]);
      setTopics(tData.topics || []);
      setConfig({ active: cData.active !== false, dailyCap: cData.dailyCap ?? null });
      setCapInput(cData.dailyCap != null ? String(cData.dailyCap) : '');
      setLog(lData.noticias || []);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async () => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await fetch('/api/noticias/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !config.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(c => ({ ...c, active: data.active }));
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveCap = async () => {
    setBusy(true); setErrorMsg('');
    try {
      const dailyCap = capInput.trim() === '' ? null : Number(capInput);
      const res = await fetch('/api/noticias/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyCap }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(c => ({ ...c, dailyCap: data.dailyCap }));
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addTopic = async () => {
    if (!newLabel.trim()) return;
    setBusy(true); setErrorMsg('');
    try {
      const res = await fetch('/api/noticias/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), query: newQuery.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewLabel(''); setNewQuery('');
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = async (id, activo) => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await fetch('/api/noticias/topics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400 animate-pulse">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Noticias (Bot)</h2>
        <p className="text-xs text-gray-500">Corre cada hora en GitHub Actions, fuera de Vercel. No se publica nada acá — es control del bot.</p>
      </div>

      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

      {/* Interruptor general + tope diario */}
      <div className="flex flex-wrap items-center gap-6 bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.active} disabled={busy} onChange={toggleActive} />
          <span className={config.active ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-500'}>
            {config.active ? 'Bot activo' : 'Bot pausado'}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Tope diario</label>
          <input
            type="number" min="1" value={capInput}
            onChange={e => setCapInput(e.target.value)}
            placeholder="sin tope"
            className="w-20 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5"
          />
          <button onClick={saveCap} disabled={busy}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </div>

      {/* Tópicos */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Tópicos a seguir</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="Ej: inteligencia artificial"
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 flex-1 min-w-[160px]"
          />
          <input
            type="text" value={newQuery} onChange={e => setNewQuery(e.target.value)}
            placeholder="query de búsqueda (opcional, si difiere del nombre)"
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 flex-1 min-w-[200px]"
          />
          <button onClick={addTopic} disabled={busy || !newLabel.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            + Agregar
          </button>
        </div>
        <div className="space-y-1.5">
          {topics.length === 0 && <p className="text-xs text-gray-400">Sin tópicos todavía.</p>}
          {topics.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-gray-800/40 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <span className="font-medium text-gray-900 dark:text-white">{t.label}</span>
                {t.query !== t.label && <span className="text-gray-400 ml-2">({t.query})</span>}
              </div>
              <label className="flex items-center gap-1.5 shrink-0">
                <input type="checkbox" checked={t.activo} disabled={busy} onChange={e => toggleTopic(t.id, e.target.checked)} />
                <span className={t.activo ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>{t.activo ? 'Activo' : 'Inactivo'}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Log */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Últimas publicaciones</p>
        {log.length === 0 ? (
          <p className="text-xs text-gray-400">Todavía no publicó nada.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['Tópico', 'Título', 'Estado', 'Fecha'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {log.map(n => (
                  <tr key={n.id}>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{n.topicLabel || '—'}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white max-w-[260px] truncate" title={n.title}>{n.title || '—'}</td>
                    <td className="px-3 py-2">
                      {n.status === 'published'
                        ? <span className="text-green-600 dark:text-green-400">✓ Publicada{n.makeError ? ' (Make falló)' : ''}</span>
                        : <span className="text-red-500">✗ Error</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(n.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Agregar el tab al default de navegación (`src/data/adminNav.js`)**

Buscar el bloque del grupo `redes` y, después de la línea del ítem `cron`, agregar el ítem nuevo:

```js
    { id: 'cron', label: 'Cron Social', icon: '⏰' },
```

por:

```js
    { id: 'cron', label: 'Cron Social', icon: '⏰' },
    { id: 'noticias-bot', label: 'Noticias (Bot)', icon: '📰' },
```

- [ ] **Step 3: Conectar el tab en `src/views/AdminPage.jsx`**

Agregar el import junto al de `AuditoriasUnificado`:

```js
import AuditoriasUnificado from '../components/admin/AuditoriasUnificado';
```

por:

```js
import AuditoriasUnificado from '../components/admin/AuditoriasUnificado';
import NoticiasBotManager from '../components/admin/NoticiasBotManager';
```

Y agregar el bloque de contenido junto al de `auditorias-todas`:

```jsx
        {activeTab === 'auditorias-todas' && (
          <div className="p-6">
            <AuditoriasUnificado />
          </div>
        )}
```

por:

```jsx
        {activeTab === 'auditorias-todas' && (
          <div className="p-6">
            <AuditoriasUnificado />
          </div>
        )}
        {activeTab === 'noticias-bot' && (
          <div className="p-6">
            <NoticiasBotManager />
          </div>
        )}
```

- [ ] **Step 4: Agregar el ítem también a la configuración guardada en Firestore (`nav_config/admin`)**

El árbol que realmente se ve en `/admin` puede estar sobreescrito en Firestore (pasó lo mismo con "Todas las Auditorías" — el árbol guardado no hereda ítems nuevos del default automáticamente). Crear un script temporal en la raíz del repo:

`_tmp-fix-nav-noticias.mjs`:

```js
import admin from 'firebase-admin';
import fs from 'node:fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
for (const line of envLocal.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const ref = db.collection('nav_config').doc('admin');
const doc = await ref.get();

if (!doc.exists) {
  console.log('No hay nav_config/admin guardado — se usa el default de adminNav.js tal cual, nada que hacer.');
  process.exit(0);
}

const data = doc.data();
const sections = data.sections;

const group = sections.find(g => g.items.some(it => it.id === 'cron'))
  || sections.find(g => g.items.some(it => it.id === 'auditorias'));
if (!group) throw new Error('No se encontró un grupo con "cron" ni "auditorias" para anclar el ítem nuevo');

if (group.items.some(it => it.id === 'noticias-bot')) {
  console.log('Ya existe, no hago nada.');
  process.exit(0);
}

const anchorIdx = group.items.findIndex(it => it.id === 'cron');
const insertAt = anchorIdx >= 0 ? anchorIdx + 1 : group.items.length;
group.items.splice(insertAt, 0, { id: 'noticias-bot', label: 'Noticias (Bot)', icon: '📰' });

await ref.set({ sections, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: false });
console.log('Listo. Grupo actualizado:', JSON.stringify(group, null, 2));
```

Run: `node _tmp-fix-nav-noticias.mjs`
Expected: imprime el grupo actualizado con `noticias-bot` adentro (o el mensaje de "ya existe" / "no hay nav_config guardado" según el caso).

- [ ] **Step 5: Borrar el script temporal**

```bash
rm _tmp-fix-nav-noticias.mjs
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 7: Verificación visual (si hay credenciales de admin disponibles)**

Entrar a `/admin` → grupo Redes Sociales → "Noticias (Bot)" → confirmar que carga sin tópicos, activar/desactivar el interruptor general, agregar un tópico, activar/desactivar ese tópico, guardar un tope diario y confirmar que persiste al recargar. Si no hay credenciales en la sesión, saltar este step y anotarlo como concern — el build limpio y la API ya verificada en Task 1 cubren la lógica, pero no la UI real.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/NoticiasBotManager.jsx src/data/adminNav.js src/views/AdminPage.jsx
git commit -m "feat: tab de admin para gestionar tópicos y on/off del bot de noticias"
```

---

## Task 3: Páginas públicas `/noticias` y `/noticias/[id]`

**Files:**
- Create: `src/app/noticias/page.jsx`
- Create: `src/app/noticias/[id]/page.jsx`
- Modify: `src/app/sitemap.js`

**Interfaces:**
- Consumes: doc Firestore `noticias/{id}` — forma exacta que Task 5 va a escribir: `{ topicId, topicLabel, title, body, caption, sourceUrl, sourceUrlHash, sourceTitle, imageUrl, status: 'published'|'error', makeError: string|null, publishedAt: Timestamp }`. Estas páginas solo muestran `status === 'published'`.

- [ ] **Step 1: Crear `src/app/noticias/page.jsx`**

```jsx
import Link from 'next/link';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Noticias',
  description: 'Noticias de los temas que sigo, resumidas y publicadas automáticamente.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/noticias/' },
  openGraph: {
    type: 'website',
    url: 'https://marianoaliandri.com.ar/noticias/',
    title: 'Noticias | Mariano Aliandri',
    description: 'Noticias de los temas que sigo, resumidas y publicadas automáticamente.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Noticias — Mariano Aliandri' }],
  },
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function getNoticias() {
  try {
    const db = getDb();
    if (!db) return [];
    const snap = await db.collection('noticias').orderBy('publishedAt', 'desc').limit(60).get();
    return snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          topicLabel: data.topicLabel,
          imageUrl: data.imageUrl,
          status: data.status,
          publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
        };
      })
      .filter(n => n.status === 'published')
      .slice(0, 30);
  } catch { return []; }
}

export default async function NoticiasPage() {
  const noticias = await getNoticias();

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-12">
          <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Canal de noticias</span>
          <h1 className="text-4xl md:text-5xl font-black text-white mt-3 mb-4">Noticias</h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Novedades de los temas que sigo, resumidas y publicadas automáticamente.
          </p>
        </div>

        {noticias.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-5xl mb-4">📰</p>
            <p className="text-lg">Todavía no hay noticias publicadas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {noticias.map(n => (
              <Link
                key={n.id}
                href={`/noticias/${n.id}/`}
                className="block bg-[#111] border border-white/10 hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-colors group"
              >
                {n.imageUrl && (
                  <div className="aspect-video overflow-hidden">
                    <img src={n.imageUrl} alt={n.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
                      {n.topicLabel}
                    </span>
                    <span className="text-xs text-gray-600">{formatDate(n.publishedAt)}</span>
                  </div>
                  <h2 className="text-white font-bold text-lg group-hover:text-indigo-400 transition-colors">
                    {n.title}
                  </h2>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Crear `src/app/noticias/[id]/page.jsx`**

```jsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function getNoticia(id) {
  try {
    const db = getDb();
    if (!db) return null;
    const doc = await db.collection('noticias').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (data.status !== 'published') return null;
    return {
      id: doc.id,
      ...data,
      publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
    };
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const n = await getNoticia(id);
  if (!n) return { title: 'Noticia no encontrada' };
  const url = `https://marianoaliandri.com.ar/noticias/${id}/`;
  const description = (n.body || '').slice(0, 160);
  return {
    title: `${n.title} | Noticias`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: n.title,
      description,
      images: n.imageUrl ? [{ url: n.imageUrl, width: 1200, height: 630, alt: n.title }] : undefined,
    },
  };
}

export default async function NoticiaDetailPage({ params }) {
  const { id } = await params;
  const n = await getNoticia(id);
  if (!n) notFound();

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/noticias" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 inline-block">
          ← Todas las noticias
        </Link>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
            {n.topicLabel}
          </span>
          <span className="text-xs text-gray-600">{formatDate(n.publishedAt)}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-white mb-6">{n.title}</h1>

        {n.imageUrl && (
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-8">
            <img src={n.imageUrl} alt={n.title} className="w-full object-cover" />
          </div>
        )}

        <div className="text-gray-300 text-base leading-relaxed space-y-4 mb-10">
          {(n.body || '').split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>

        {n.sourceUrl && (
          <p className="text-xs text-gray-600 mb-10">
            Fuente:{' '}
            <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              {n.sourceTitle || n.sourceUrl}
            </a>
          </p>
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
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Agregar `/noticias/` al sitemap**

En `src/app/sitemap.js`, reemplazar:

```js
    { url: `${BASE_URL}/auditorias/`,  lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
```

por:

```js
    { url: `${BASE_URL}/auditorias/`,  lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/noticias/`,    lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
```

- [ ] **Step 4: Crear una noticia de prueba directo en Firestore para verificar el render**

Como el bot todavía no existe (Task 4/5), crear un doc de prueba con un script temporal en la raíz del repo, `_tmp-seed-noticia.mjs`:

```js
import admin from 'firebase-admin';
import fs from 'node:fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
for (const line of envLocal.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const ref = await db.collection('noticias').add({
  topicId: 'test-topic',
  topicLabel: 'Prueba',
  title: 'Noticia de prueba para verificar el render',
  body: 'Primer párrafo de prueba.\nSegundo párrafo de prueba.',
  caption: 'Caption de prueba',
  sourceUrl: 'https://example.com/nota-de-prueba',
  sourceUrlHash: 'test-hash-0001',
  sourceTitle: 'Nota de prueba',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  status: 'published',
  makeError: null,
  publishedAt: admin.firestore.FieldValue.serverTimestamp(),
});
console.log('Creado:', ref.id);
```

Run: `node _tmp-seed-noticia.mjs`
Expected: imprime el `id` creado. Guardarlo.

- [ ] **Step 5: Verificar contra el servidor real**

Levantar `npm run dev` en background, esperar `✓ Ready`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/noticias/
```

Expected: `200`.

```bash
curl -s http://localhost:3000/noticias/ | grep -c "Noticia de prueba para verificar el render"
```

Expected: `1`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/noticias/<EL_ID_DE_PRUEBA>/
```

Expected: `200`.

```bash
curl -s http://localhost:3000/noticias/<EL_ID_DE_PRUEBA>/ | grep -c "Segundo párrafo de prueba"
```

Expected: `1`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/noticias/id-que-no-existe/
```

Expected: `404`.

Frenar el dev server.

- [ ] **Step 6: Borrar el doc de prueba y el script temporal**

Reusar `_tmp-seed-noticia.mjs`, cambiar la última parte por:

```js
await db.collection('noticias').doc('<EL_ID_DE_PRUEBA>').delete();
console.log('Borrado.');
```

Run: `node _tmp-seed-noticia.mjs`
Expected: `Borrado.`

```bash
rm _tmp-seed-noticia.mjs
```

- [ ] **Step 7: Commit**

```bash
git add src/app/noticias src/app/sitemap.js
git commit -m "feat: páginas públicas /noticias y /noticias/[id]"
```

---

## Task 4: Script del bot — RSS + dedup + redacción con Gemini (dry-run)

**Files:**
- Create: `scripts/noticias-bot.mjs`
- Modify: `package.json`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Consumes: colecciones Firestore `noticias_topics` y `noticias_config` (forma de Task 1), y la colección `noticias` (para dedup, forma de Task 3/5).
- Produces: función `publishNoticia({ db, topic, item, content, sourceUrlHash })` — en esta tarea es un **stub** (solo loguea). Task 5 reemplaza el cuerpo de esta función por la publicación real, sin tocar su firma ni ningún otro código de este archivo.

- [ ] **Step 1: Instalar la dependencia de parseo de RSS**

Run: `npm install fast-xml-parser`
Expected: `package.json` y `package-lock.json` quedan con `fast-xml-parser` en `dependencies`.

- [ ] **Step 2: Excluir `scripts/` del lint de Next (no es código de la app)**

En `eslint.config.mjs`, reemplazar:

```js
  globalIgnores([
    // Default ignores de eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
```

por:

```js
  globalIgnores([
    // Default ignores de eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // scripts/ corre fuera de Next (GitHub Actions), no sigue reglas de React/Next.
    "scripts/**",
  ]),
```

- [ ] **Step 3: Crear `scripts/noticias-bot.mjs`**

```js
// Bot de noticias — corre en GitHub Actions, no en Vercel. Autocontenido a
// propósito: no importa nada de src/ (esos archivos son CommonJS por default
// en este package.json, y usan sintaxis ESM — un `node` plano no puede
// importarlos desde un script externo al build de Next).
import admin from 'firebase-admin';
import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const SITE_URL = 'https://marianoaliandri.com.ar';

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

function hashUrl(url) {
  return crypto.createHash('sha256').update(normalizeUrl(url)).digest('hex').slice(0, 16);
}

// Argentina es UTC-3 todo el año (sin horario de verano).
function startOfTodayArgentina() {
  const now = new Date();
  const arOffsetMs = 3 * 60 * 60 * 1000;
  const arNow = new Date(now.getTime() - arOffsetMs);
  const startAR = Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth(), arNow.getUTCDate());
  return new Date(startAR + arOffsetMs);
}

async function fetchConfig(db) {
  const doc = await db.collection('noticias_config').doc('settings').get();
  const data = doc.data() || {};
  return { active: data.active !== false, dailyCap: data.dailyCap ?? null };
}

async function fetchActiveTopics(db) {
  const snap = await db.collection('noticias_topics').where('activo', '==', true).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Trae docs de hoy por rango de fecha (un solo campo, sin índice compuesto) y
// filtra por status en memoria.
async function countPublishedToday(db) {
  const cutoff = startOfTodayArgentina();
  const snap = await db.collection('noticias').where('publishedAt', '>=', cutoff).get();
  return snap.docs.filter(d => d.data().status === 'published').length;
}

async function alreadyPublished(db, sourceUrlHash) {
  const snap = await db.collection('noticias').where('sourceUrlHash', '==', sourceUrlHash).limit(1).get();
  return !snap.empty;
}

async function fetchGoogleNewsRss(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=AR&ceid=AR:es-419`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Google News RSS ${resp.status}`);
  const xml = await resp.text();
  const parsed = new XMLParser().parse(xml);
  const rawItems = parsed?.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);
  return items
    .map(it => ({ title: String(it.title || '').trim(), link: String(it.link || '').trim(), pubDate: it.pubDate || null }))
    .filter(it => it.title && it.link)
    .reverse(); // Google trae lo más nuevo primero; procesamos más viejo primero.
}

async function generateContent(item, topic) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const prompt = `Sos el redactor del canal de noticias de Mariano Aliandri (${SITE_URL}), desarrollador Full Stack y analista de datos de Neuquén, Argentina.

Tenés este titular real como disparador:
Título: ${item.title}
Fuente: ${item.link}
Tópico que seguís: ${topic.label}

Escribí, en español rioplatense (vos, no tú), un JSON con exactamente estas 3 claves, sin texto extra antes ni después ni bloques de código:
{"title": "título propio para la nota, no copies el original tal cual", "body": "2 a 4 párrafos (separados por \\n) explicando la noticia y por qué importa, tono cercano y profesional, sin inventar datos que no estén en el titular", "caption": "1 a 2 oraciones cortas para un post de red social, SIN incluir ningún link ni URL"}`;

  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await resp.json();
  if (!resp.ok || data?.error) throw new Error(`Gemini ${resp.status}: ${data?.error?.message || 'error desconocido'}`);

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini no generó texto (posible bloqueo de contenido)');

  const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Gemini no devolvió JSON válido');
  }
  if (!parsed.title || !parsed.body || !parsed.caption) throw new Error('JSON de Gemini incompleto (falta title, body o caption)');
  return parsed;
}

// STUB — Task 5 reemplaza este cuerpo por la publicación real (imagen +
// Firestore + Make), sin cambiar la firma de la función. `db` y
// `sourceUrlHash` no se usan todavía acá, los va a necesitar Task 5.
async function publishNoticia({ db, topic, item, content, sourceUrlHash }) {
  console.log(`  [dry-run] publicaría: "${content.title}" (tópico: ${topic.label}, fuente: ${item.link})`);
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  const config = await fetchConfig(db);
  if (!config.active) {
    console.log('Bot pausado (noticias_config.active = false). Nada para hacer.');
    return;
  }

  let remaining = config.dailyCap != null ? config.dailyCap - await countPublishedToday(db) : Infinity;
  if (remaining <= 0) {
    console.log(`Tope diario (${config.dailyCap}) ya alcanzado hoy. Nada para hacer.`);
    return;
  }

  const topics = await fetchActiveTopics(db);
  console.log(`${topics.length} tópico(s) activo(s).`);

  let publishedCount = 0;
  let errorCount = 0;

  for (const topic of topics) {
    if (remaining <= 0) break;
    console.log(`\n— Tópico: ${topic.label} —`);

    let items;
    try {
      items = await fetchGoogleNewsRss(topic.query || topic.label);
    } catch (e) {
      console.error(`  Error trayendo RSS: ${e.message}`);
      continue;
    }
    console.log(`  ${items.length} item(s) en el RSS.`);

    for (const item of items) {
      if (remaining <= 0) break;
      const sourceUrlHash = hashUrl(item.link);
      if (await alreadyPublished(db, sourceUrlHash)) continue;

      try {
        const content = await generateContent(item, topic);
        await publishNoticia({ db, topic, item, content, sourceUrlHash });
        publishedCount++;
        remaining--;
      } catch (e) {
        errorCount++;
        console.error(`  Error con "${item.title}": ${e.message}`);
      }
    }
  }

  console.log(`\nListo. Publicadas: ${publishedCount}. Errores: ${errorCount}.`);
}

main().catch(e => {
  console.error('Error fatal:', e);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Correr eslint sobre el resto del proyecto (confirmar que `scripts/` quedó afuera)**

Run: `npx eslint .`
Expected: sin errores nuevos, y ningún error referido a `scripts/noticias-bot.mjs` en la salida.

- [ ] **Step 5: Verificar en vivo (dry-run), contra Firestore/RSS/Gemini reales**

Necesita un tópico activo — reusar el flujo de Task 1 (con el dev server corriendo, o directo por Firestore). Con el dev server de Task 1 todavía disponible como referencia, crear un tópico real de prueba:

```bash
npm run dev &
sleep 3
curl -s -X POST http://localhost:3000/api/noticias/topics \
  -H "Content-Type: application/json" \
  -d '{"label":"inteligencia artificial"}'
kill %1
```

Ahora correr el script con las credenciales de `.env.local` cargadas en el shell:

```bash
set -a
source .env.local
set +a
node scripts/noticias-bot.mjs
```

Expected: log con `1 tópico(s) activo(s).`, seguido de `— Tópico: inteligencia artificial —`, la cantidad de items del RSS, y por cada item nuevo una línea `[dry-run] publicaría: "..."` con un título distinto al titular original (confirma que Gemini lo reescribió). Si algún item falla, el log muestra el error puntual y sigue con el próximo — no debe cortar el proceso. Termina con `Listo. Publicadas: N. Errores: M.` y `process.exitCode` en `0` (verificar con `echo $?` después de correr el script).

- [ ] **Step 6: Verificar que el interruptor general corta todo sin llamadas externas**

```bash
set -a
source .env.local
set +a
curl -s -X PATCH http://localhost:3000/api/noticias/config -H "Content-Type: application/json" -d '{"active":false}' > /dev/null 2>&1 || true
```

Si el dev server ya no está arriba, apagar el flag directo por Firestore con un script temporal de una línea (mismo patrón de conexión que se usó arriba), o levantar `npm run dev` de nuevo un momento para hacer el PATCH. Con `active:false`:

```bash
node scripts/noticias-bot.mjs
```

Expected: única línea de log `Bot pausado (noticias_config.active = false). Nada para hacer.`, sin ningún log de tópicos ni de Gemini.

Volver a poner `active:true` (mismo PATCH que antes con `{"active":true}`) para que Task 5 arranque con el bot activo.

- [ ] **Step 7: Commit**

```bash
git add scripts/noticias-bot.mjs package.json package-lock.json eslint.config.mjs
git commit -m "feat: script del bot de noticias — RSS, dedup y redacción con Gemini (dry-run)"
```

---

## Task 5: Script del bot — imagen, Firestore y Make (publicación real)

**Files:**
- Modify: `scripts/noticias-bot.mjs`

**Interfaces:**
- Consumes: `publishNoticia({ db, topic, item, content, sourceUrlHash })` de Task 4 (misma firma, se reemplaza el cuerpo).
- Produces: docs reales en `noticias` con la forma que Task 1 (`GET /api/noticias`) y Task 3 (páginas públicas) ya leen. POST real al webhook de Make (`MAKE_WEBHOOK_URL`) con `type: 'noticia'`.

- [ ] **Step 1: Reemplazar el stub `publishNoticia` por la implementación real**

En `scripts/noticias-bot.mjs`, agregar estas funciones nuevas antes de `publishNoticia` (después de `generateContent`):

```js
// Mismo patrón que src/app/api/auditorias/send-biz-email/route.js — duplicado
// acá porque este script no puede importar de src/ (ver nota al principio del
// archivo).
async function getScreenshot(url) {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    const data = await resp.json();
    return data?.data?.screenshot?.url || null;
  } catch {
    return null;
  }
}

async function uploadToCloudinary(imageUrl) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error('CLOUDINARY_CLOUD_NAME o CLOUDINARY_UPLOAD_PRESET no configurados');

  const form = new URLSearchParams();
  form.set('file', imageUrl);
  form.set('upload_preset', uploadPreset);

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error?.message || `Cloudinary ${resp.status}`);
  return data.secure_url;
}

async function sendToMake(text, imageUrl) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('MAKE_WEBHOOK_URL no configurada');

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      networks: { facebook: true, linkedin: true, instagram: true },
      type: 'noticia',
      useAI: false,
      imageUrl,
    }),
  });
  if (!resp.ok) throw new Error(`Make ${resp.status}`);
}
```

- [ ] **Step 2: Reemplazar el cuerpo de `publishNoticia`**

Reemplazar:

```js
// STUB — Task 5 reemplaza este cuerpo por la publicación real (imagen +
// Firestore + Make), sin cambiar la firma de la función. `db` y
// `sourceUrlHash` no se usan todavía acá, los va a necesitar Task 5.
async function publishNoticia({ db, topic, item, content, sourceUrlHash }) {
  console.log(`  [dry-run] publicaría: "${content.title}" (tópico: ${topic.label}, fuente: ${item.link})`);
}
```

por:

```js
async function publishNoticia({ db, topic, item, content, sourceUrlHash }) {
  const screenshotUrl = await getScreenshot(item.link);
  if (!screenshotUrl) {
    await db.collection('noticias').add({
      topicId: topic.id, topicLabel: topic.label,
      title: content.title, body: content.body, caption: content.caption,
      sourceUrl: item.link, sourceUrlHash, sourceTitle: item.title,
      imageUrl: null, status: 'error', makeError: 'No se pudo obtener el screenshot (Microlink)',
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✗ "${content.title}" — sin imagen, guardada como error`);
    return;
  }

  let imageUrl;
  try {
    imageUrl = await uploadToCloudinary(screenshotUrl);
  } catch (e) {
    await db.collection('noticias').add({
      topicId: topic.id, topicLabel: topic.label,
      title: content.title, body: content.body, caption: content.caption,
      sourceUrl: item.link, sourceUrlHash, sourceTitle: item.title,
      imageUrl: null, status: 'error', makeError: `Cloudinary: ${e.message}`,
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✗ "${content.title}" — Cloudinary falló, guardada como error`);
    return;
  }

  const docRef = await db.collection('noticias').add({
    topicId: topic.id, topicLabel: topic.label,
    title: content.title, body: content.body, caption: content.caption,
    sourceUrl: item.link, sourceUrlHash, sourceTitle: item.title,
    imageUrl, status: 'published', makeError: null,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    await sendToMake(content.caption, imageUrl);
    console.log(`  ✓ "${content.title}" — publicada y enviada a Make`);
  } catch (e) {
    await docRef.update({ makeError: e.message });
    console.log(`  ⚠ "${content.title}" — publicada en el sitio, pero Make falló: ${e.message}`);
  }
}
```

- [ ] **Step 3: Correr eslint**

Run: `npx eslint .`
Expected: sin errores (recordar que `scripts/**` sigue ignorado desde Task 4).

- [ ] **Step 4: Verificar el flujo completo en vivo**

Con `.env.local` cargado en el shell (incluye ya `CLOUDINARY_CLOUD_NAME`/`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` y las credenciales de Firebase/Gemini; para `MAKE_WEBHOOK_URL` y `CLOUDINARY_UPLOAD_PRESET` puede hacer falta exportarlas a mano si todavía no están en `.env.local`):

```bash
set -a
source .env.local
export CLOUDINARY_CLOUD_NAME="$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"
export CLOUDINARY_UPLOAD_PRESET="noticias"   # o el preset unsigned que se haya creado en Cloudinary
export MAKE_WEBHOOK_URL="https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi"
set +a
node scripts/noticias-bot.mjs
```

Expected: al menos una línea `✓ "..." — publicada y enviada a Make` (o `⚠` si Make devolvió error porque todavía no existe la rama `type:'noticia'` en el Router — no es bloqueante para este test, el webhook igual responde 200). Confirmar en la consola de Firebase (colección `noticias`) que apareció un doc nuevo con `status:'published'` y un `imageUrl` que empieza con `https://res.cloudinary.com/` (no con `https://api.microlink.io/`).

Levantar `npm run dev`, y con el `id` del doc nuevo:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/noticias/<EL_ID>/
```

Expected: `200`.

Frenar el dev server.

- [ ] **Step 5: Verificar que el dedup funciona de verdad (no solo en el dry-run)**

Correr el script de nuevo inmediatamente, mismo tópico:

```bash
node scripts/noticias-bot.mjs
```

Expected: si no salió una noticia nueva realmente distinta en el RSS en este lapso, el log debe mostrar `0 tópico(s)` procesando items nuevos (todos los del RSS ya están en `noticias` por `sourceUrlHash`) — es decir, no debe volver a publicar el mismo titular. Confirmar contando los docs en Firestore antes y después (debe ser el mismo número, salvo que haya salido una noticia genuinamente nueva entre las dos corridas).

- [ ] **Step 6: Verificar que el tope diario corta la corrida**

Con al menos 2 tópicos activos con noticias nuevas disponibles (agregar un segundo tópico de prueba si hace falta, ej. `"nextjs"`, vía el mismo `POST /api/noticias/topics` de Task 1), poner el tope en 1:

```bash
curl -s -X PATCH http://localhost:3000/api/noticias/config -H "Content-Type: application/json" -d '{"dailyCap":1}'
```

Borrar de Firestore cualquier doc de `noticias` con `status:'published'` publicado hoy (si quedó alguno de pruebas anteriores) para que `countPublishedToday` arranque en 0 — reusar un script temporal de conexión como los ya usados.

```bash
node scripts/noticias-bot.mjs
```

Expected: el log procesa el primer tópico, publica **una sola** noticia (`remaining` llega a 0), y corta ahí — no debe seguir con el segundo tópico ni con más items del primero. Confirmar en Firestore que solo hay 1 doc nuevo con `status:'published'` de hoy. Las noticias que quedaron pendientes (no tenían `sourceUrlHash` guardado, porque no llegaron a procesarse) se vuelven a evaluar en la próxima corrida sin problema.

Volver a sacar el tope:

```bash
curl -s -X PATCH http://localhost:3000/api/noticias/config -H "Content-Type: application/json" -d '{"dailyCap":null}'
```

- [ ] **Step 7: Verificar que un error de Gemini no tira abajo la corrida**

Simular una falla real de Gemini corriendo el script con la API key rota, contra un tópico con al menos un item nuevo sin publicar todavía:

```bash
set -a
source .env.local
export GEMINI_API_KEY="key-invalida-a-proposito"
export CLOUDINARY_CLOUD_NAME="$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"
export CLOUDINARY_UPLOAD_PRESET="noticias"
export MAKE_WEBHOOK_URL="https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi"
set +a
node scripts/noticias-bot.mjs
echo "exit code: $?"
```

Expected: por cada item nuevo, una línea `Error con "...": Gemini 400: ...` (o el mensaje que devuelva Google con una key inválida), el proceso sigue con el resto de los tópicos/items sin cortarse, termina con `Listo. Publicadas: 0. Errores: N.` y `exit code: 0` (un error de Gemini en un item puntual no es un error fatal del proceso — solo lo es un fallo de Firestore, ver `main().catch(...)`). Confirmar que **no** se creó ningún doc nuevo en `noticias` por estos items (a diferencia de un fallo de Microlink/Cloudinary, un fallo de Gemini pasa nunca genera contenido para guardar).

- [ ] **Step 8: Limpiar los docs de prueba creados en este Task**

Con un script temporal `_tmp-cleanup-noticias-test.mjs` (mismo patrón de conexión ya usado varias veces en este plan), borrar los docs de `noticias` cuyo `topicId` sea el de los tópicos de prueba creados en Task 4/5 (o listar y borrar a mano los `id` que se fueron guardando durante la verificación). Borrar el script al terminar.

- [ ] **Step 9: Commit**

```bash
git add scripts/noticias-bot.mjs
git commit -m "feat: script del bot de noticias — publica imagen, Firestore y Make de verdad"
```

---

## Task 6: Workflow de GitHub Actions

**Files:**
- Create: `.github/workflows/noticias-bot.yml`

**Interfaces:**
- Consumes: `scripts/noticias-bot.mjs` de Task 4/5, y 7 secrets de GitHub que **Mariano tiene que cargar a mano** (ver Step 3) — no hay forma de que este task los cargue por código, son credenciales.

- [ ] **Step 1: Crear `.github/workflows/noticias-bot.yml`**

```yaml
name: Bot de noticias

on:
  schedule:
    - cron: '7 * * * *'
  workflow_dispatch: {}

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: node scripts/noticias-bot.mjs
        env:
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_CLIENT_EMAIL: ${{ secrets.FIREBASE_CLIENT_EMAIL }}
          FIREBASE_PRIVATE_KEY: ${{ secrets.FIREBASE_PRIVATE_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          CLOUDINARY_CLOUD_NAME: ${{ secrets.CLOUDINARY_CLOUD_NAME }}
          CLOUDINARY_UPLOAD_PRESET: ${{ secrets.CLOUDINARY_UPLOAD_PRESET }}
          MAKE_WEBHOOK_URL: ${{ secrets.MAKE_WEBHOOK_URL }}
```

- [ ] **Step 2: Verificar que el pipeline completo corre limpio localmente una vez más (equivalente a lo que haría el Action)**

```bash
set -a
source .env.local
export CLOUDINARY_CLOUD_NAME="$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"
export CLOUDINARY_UPLOAD_PRESET="noticias"
export MAKE_WEBHOOK_URL="https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi"
set +a
npm ci
node scripts/noticias-bot.mjs
echo "exit code: $?"
```

Expected: `exit code: 0`, mismo comportamiento verificado en Task 5. Esto es lo más cerca que se puede probar el workflow sin secrets reales de GitHub cargados (ver Step 3).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/noticias-bot.yml
git commit -m "feat: workflow de GitHub Actions para el bot de noticias (1 vez por hora)"
```

- [ ] **Step 4: Checklist de setup manual — Mariano, no código**

Esto no se puede hacer desde el plan (son credenciales y configuración en paneles de terceros). Pendiente después de mergear:

1. **GitHub → Settings → Secrets and variables → Actions**, cargar 7 secrets:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (mismos valores que ya están en Vercel), `GEMINI_API_KEY` (ídem), `CLOUDINARY_CLOUD_NAME` (el mismo valor que `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` en Vercel), `CLOUDINARY_UPLOAD_PRESET` (nombre del preset nuevo del punto 2), `MAKE_WEBHOOK_URL` (`https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi`).
2. **Cloudinary → Settings → Upload → Upload presets**, crear un preset nuevo *unsigned* (ej. `noticias`), igual que ya existe `zone_analysis_images`. Usar ese nombre como `CLOUDINARY_UPLOAD_PRESET`.
3. **Make → el escenario del webhook `574hhr7...`**, agregar una rama al Router existente para `type === 'noticia'` que reparta a Facebook, LinkedIn e Instagram como post nativo (imagen + `text`, sin link adjunto) — mismo patrón ya usado para `type: 'reel'`.
4. Una vez cargados los secrets, probar manualmente desde GitHub → pestaña **Actions** → "Bot de noticias" → **Run workflow**, y revisar el log de esa corrida.
5. Cargar al menos 1 tópico real desde `/admin` → Redes Sociales → Noticias (Bot) antes de esperar que publique algo — sin tópicos activos, el bot no tiene nada que buscar.
