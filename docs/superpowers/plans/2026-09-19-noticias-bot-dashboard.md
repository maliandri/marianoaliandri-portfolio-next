# Dashboard de tópicos del bot de noticias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tono configurable por tópico, horario semanal de publicación, borrado en cascada de un tópico + sus notas, y rediseño del admin de "Noticias (Bot)" a tarjetas expandibles por tópico.

**Architecture:** El bot (`scripts/noticias-bot.mjs`, GitHub Actions) gana dos funciones puras nuevas (`nowArgentina`, `isWithinSchedule`) y usa `topic.toneInstructions` al armar el prompt. Dos rutas API existentes (`/api/noticias/topics`, `/api/noticias/config`) se extienden con nuevos campos y una ruta `DELETE`. El admin (`NoticiasBotManager.jsx`) se reorganiza: controles globales arriba (con el editor de horario nuevo) y un componente nuevo `TopicCard.jsx` por cada tópico (colapsable, con su propio tono/notas/borrado).

**Tech Stack:** Next.js 15 App Router (Route Handlers), React 19 (client component), Firebase Admin SDK (Firestore), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-noticias-bot-dashboard-design.md`

## Global Constraints

- Todos los campos nuevos (`toneInstructions`, `schedule`) son opcionales — su ausencia (`null`/`undefined`) reproduce el comportamiento actual exactamente. No hay migración de datos.
- El borrado de un tópico es duro (sin recuperación) y **no** retracta posts ya publicados en redes sociales — el texto de confirmación en la UI debe decirlo explícitamente.
- Los tests van junto al archivo que prueban (`*.test.js` en `src/`, `*.test.mjs` en `scripts/`), siguiendo el patrón ya establecido el 2026-09-18 (Vitest, sin mocks de más — un Firestore fake en memoria por test file).
- Hora Argentina = UTC-3 fijo, todo el año (sin horario de verano) — mismo criterio que `startOfTodayArgentina()` ya usa en el script.
- No se agregan tests de componentes React (no hay infra de testing de UI en el repo) — la verificación de las tareas de UI es manual (`npm run dev` + admin).

---

### Task 1: Bot — horario semanal (`isWithinSchedule`)

**Files:**
- Modify: `vitest.config.mjs`
- Modify: `scripts/noticias-bot.mjs`
- Create: `scripts/noticias-bot.test.mjs`

**Interfaces:**
- Produces: `export function nowArgentina(date = new Date())` → `Date` (getters UTC leen como hora de pared AR). `export function isWithinSchedule(schedule, arNow)` → `boolean`, pura, sin I/O.
- Consumes: nada de otras tareas (independiente).

- [ ] **Step 1: Hacer que Vitest también recoja los tests de `scripts/`**

`vitest.config.mjs` hoy solo mira `src/**/*.test.js`. El test de este task vive en `scripts/` con extensión `.mjs`.

Reemplazar en `vitest.config.mjs`:
```js
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
```
por:
```js
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'scripts/**/*.test.mjs'],
  },
```

- [ ] **Step 2: Evitar que `main()` se ejecute solo con importar el script**

`scripts/noticias-bot.mjs` termina con `main().catch(...)` ejecutándose apenas se carga el módulo — si un test hace `import { isWithinSchedule } from './noticias-bot.mjs'`, eso dispararía el bot completo (Firestore, Gemini, Make) durante `npm test`. Hay que guardarlo para que solo corra cuando el archivo se ejecuta directo (`node scripts/noticias-bot.mjs`), no cuando se importa como módulo.

Al final del archivo, reemplazar:
```js
main().catch(e => {
  console.error('Error fatal:', e);
  process.exitCode = 1;
});
```
por:
```js
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error('Error fatal:', e);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 3: Escribir el test que falla**

Crear `scripts/noticias-bot.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { isWithinSchedule, nowArgentina } from './noticias-bot.mjs';

// Enero de 1970: 1=jue, 2=vie, 3=sab, 4=dom, 5=lun, 6=mar, 7=mie.
// Se usan estas fechas fijas para tener un getUTCDay() conocido sin ambigüedad.
const DAY_TO_JAN_1970 = { 0: 4, 1: 5, 2: 6, 3: 7, 4: 1, 5: 2, 6: 3 }; // getUTCDay() -> día de enero

function arNowFor(getUTCDayValue, hour) {
  return new Date(Date.UTC(1970, 0, DAY_TO_JAN_1970[getUTCDayValue], hour));
}

const FULL_WEEK = {
  dom: { enabled: true, startHour: 8, endHour: 23 },
  lun: { enabled: true, startHour: 8, endHour: 23 },
  mar: { enabled: true, startHour: 8, endHour: 23 },
  mie: { enabled: true, startHour: 8, endHour: 23 },
  jue: { enabled: true, startHour: 8, endHour: 23 },
  vie: { enabled: true, startHour: 8, endHour: 23 },
  sab: { enabled: false, startHour: null, endHour: null },
};

describe('nowArgentina', () => {
  it('resta 3 horas (Argentina es UTC-3 fijo)', () => {
    const utcNoon = new Date(Date.UTC(2026, 5, 15, 12, 0, 0));
    expect(nowArgentina(utcNoon).getUTCHours()).toBe(9);
  });
});

describe('isWithinSchedule', () => {
  it('sin schedule configurado, siempre permite publicar', () => {
    expect(isWithinSchedule(null, arNowFor(6, 3))).toBe(true); // sábado 3am
  });

  it('día deshabilitado no permite publicar en ninguna hora', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(6, 12))).toBe(false); // sábado 12pm
  });

  it('hora dentro del rango permite publicar', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(1, 10))).toBe(true); // lunes 10am
  });

  it('hora antes del rango no permite publicar', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(1, 7))).toBe(false); // lunes 7am
  });

  it('startHour es inclusivo', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(1, 8))).toBe(true); // lunes 8am justo
  });

  it('endHour es exclusivo', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(1, 23))).toBe(false); // lunes 23hs justo
  });

  it('día habilitado sin startHour/endHour permite todo el día', () => {
    const schedule = { ...FULL_WEEK, mar: { enabled: true, startHour: null, endHour: null } };
    expect(isWithinSchedule(schedule, arNowFor(2, 2))).toBe(true); // martes 2am
  });
});
```

- [ ] **Step 4: Correr los tests y confirmar que fallan**

Run: `npm test -- scripts/noticias-bot.test.mjs`
Expected: FAIL — `isWithinSchedule`/`nowArgentina` no están exportados todavía.

- [ ] **Step 5: Implementar `nowArgentina` e `isWithinSchedule`**

En `scripts/noticias-bot.mjs`, agregar estas dos funciones justo después de `startOfTodayArgentina()` (reusan el mismo criterio de offset):
```js
// Devuelve un Date cuyos getters UTC (getUTCDay, getUTCHours) leen como hora de pared
// en Argentina — mismo truco de offset que startOfTodayArgentina().
export function nowArgentina(date = new Date()) {
  const arOffsetMs = 3 * 60 * 60 * 1000;
  return new Date(date.getTime() - arOffsetMs);
}

const SCHEDULE_DAY_KEYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']; // getUTCDay(): 0=domingo

// Función pura: dado el schedule configurado (o null) y el momento actual ya ajustado a
// hora Argentina (nowArgentina()), decide si el bot puede publicar ahora.
export function isWithinSchedule(schedule, arNow) {
  if (!schedule) return true;
  const day = schedule[SCHEDULE_DAY_KEYS[arNow.getUTCDay()]];
  if (!day || !day.enabled) return false;
  if (day.startHour == null || day.endHour == null) return true;
  const hour = arNow.getUTCHours();
  return hour >= day.startHour && hour < day.endHour;
}
```

- [ ] **Step 6: Correr los tests y confirmar que pasan**

Run: `npm test -- scripts/noticias-bot.test.mjs`
Expected: PASS (8 tests).

- [ ] **Step 7: Integrar el chequeo de horario en `fetchConfig` y `main()`**

En `fetchConfig(db)`, reemplazar:
```js
async function fetchConfig(db) {
  const doc = await db.collection('noticias_config').doc('settings').get();
  const data = doc.data() || {};
  return { active: data.active !== false, dailyCap: data.dailyCap ?? null };
}
```
por:
```js
async function fetchConfig(db) {
  const doc = await db.collection('noticias_config').doc('settings').get();
  const data = doc.data() || {};
  return { active: data.active !== false, dailyCap: data.dailyCap ?? null, schedule: data.schedule ?? null };
}
```

En `main()`, justo después del chequeo de `config.active` (antes del chequeo de `dailyCap`), agregar:
```js
  const config = await fetchConfig(db);
  if (!config.active) {
    console.log('Bot pausado (noticias_config.active = false). Nada para hacer.');
    return;
  }

  if (!isWithinSchedule(config.schedule, nowArgentina())) {
    console.log('Fuera del horario configurado. Nada para hacer.');
    return;
  }

  let remaining = config.dailyCap != null ? config.dailyCap - await countPublishedToday(db) : Infinity;
```

- [ ] **Step 8: Verificar sintaxis del script completo**

Run: `node --check scripts/noticias-bot.mjs`
Expected: sin salida (sintaxis OK).

- [ ] **Step 9: Correr toda la suite y confirmar que nada se rompió**

Run: `npm test`
Expected: PASS — todos los tests (los de ayer + los nuevos de este task).

- [ ] **Step 10: Commit**

```bash
git add vitest.config.mjs scripts/noticias-bot.mjs scripts/noticias-bot.test.mjs
git commit -m "feat: horario semanal de publicación para el bot de noticias

Agrega isWithinSchedule()/nowArgentina() (funciones puras, con tests)
y el chequeo en main(). Sin schedule configurado (default), el bot
sigue corriendo 24/7 como hasta ahora — sin cambio de comportamiento.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Bot — tono por tópico en el prompt

**Files:**
- Modify: `scripts/noticias-bot.mjs`

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: `buildPrompt(item, topic)` ahora también lee `topic.toneInstructions` (campo opcional del doc de Firestore que ya se trae completo vía `fetchActiveTopics`).

- [ ] **Step 1: Agregar el bloque de tono al prompt**

En `buildPrompt(item, topic)`, el `return` actual termina en el bloque de reglas de "no clickbait" que se agregó el 2026-09-18. Justo antes del cierre de la template string, agregar el bloque de tono condicional:

Reemplazar el final de la función (desde `Lo mismo aplica a "caption"...` hasta el cierre de la template string) — es decir, esta línea:
```js
resumir la noticia en sí, no ser un cliffhanger.`;
}
```
por:
```js
resumir la noticia en sí, no ser un cliffhanger.` +
    (topic.toneInstructions && topic.toneInstructions.trim()
      ? `\n\nTONO ESPECÍFICO PARA ESTE TÓPICO (seguilo estrictamente, tiene prioridad sobre el tono por default de arriba):\n${topic.toneInstructions.trim()}`
      : '');
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check scripts/noticias-bot.mjs`
Expected: sin salida (sintaxis OK).

- [ ] **Step 3: Verificación manual del prompt generado**

No hay test automático para esto (es concatenación de strings, spec no lo pide). Verificar a mano corriendo:
```bash
node --input-type=module -e "
import('./scripts/noticias-bot.mjs').then(async (m) => {
  // buildPrompt no está exportada — este check solo confirma que el módulo
  // sigue cargando sin errores después del cambio (import dispara top-level,
  // pero main() ya no corre sola gracias al guard del Task 1).
  console.log('módulo carga OK, exports:', Object.keys(m));
});
"
```
Expected: imprime `módulo carga OK, exports: [ 'nowArgentina', 'isWithinSchedule' ]` sin lanzar nada.

- [ ] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/noticias-bot.mjs
git commit -m "feat: el bot usa toneInstructions del tópico en el prompt

Campo opcional en noticias_topics — sin configurar, el prompt queda
igual que hasta ahora.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: API — `/api/noticias/topics` (tono + borrado en cascada)

**Files:**
- Modify: `src/app/api/noticias/topics/route.js`
- Create: `src/app/api/noticias/topics/route.test.js`

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: `PATCH` acepta `{ id, activo?, toneInstructions? }` (al menos uno de los dos). `DELETE` acepta `{ id }`, responde `{ success: true, deletedCount: number }` o 404.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/app/api/noticias/topics/route.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));

import { getDb } from '@/lib/firebase-admin';
import { PATCH, DELETE } from './route.js';

function makeRequest(body) {
  return { json: async () => body };
}

// Firestore fake en memoria — mismo espíritu que el de
// src/app/api/lead-finder-pro/run/route.test.js, pero con lo que esta ruta
// necesita: doc.update/delete en noticias_topics, where+get+batch en noticias.
function createFakeDb(topics = {}, notes = {}) {
  const state = { topics: { ...topics }, notes: { ...notes } };

  function topicDocRef(id) {
    return {
      async get() {
        const data = state.topics[id];
        return { exists: data !== undefined, data: () => data };
      },
      async update(patch) {
        state.topics[id] = { ...(state.topics[id] || {}), ...patch };
      },
      async delete() {
        delete state.topics[id];
      },
    };
  }

  function noteDocRef(id) {
    return { id, delete() { delete state.notes[id]; } };
  }

  return {
    state,
    db: {
      collection(name) {
        if (name === 'noticias_topics') return { doc: (id) => topicDocRef(id) };
        if (name === 'noticias') {
          return {
            where(field, op, value) {
              if (op !== '==') throw new Error('fake solo soporta ==');
              const matches = Object.entries(state.notes)
                .filter(([, data]) => data[field] === value)
                .map(([id]) => ({ id, ref: noteDocRef(id) }));
              return { async get() { return { docs: matches }; } };
            },
          };
        }
        throw new Error(`fake db: colección no soportada "${name}"`);
      },
      batch() {
        const ops = [];
        return {
          delete(ref) { ops.push(ref); },
          async commit() { for (const ref of ops) ref.delete(); },
        };
      },
    },
  };
}

describe('PATCH /api/noticias/topics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('actualiza toneInstructions', async () => {
    const { db, state } = createFakeDb({ t1: { label: 'SEO', activo: true } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1', toneInstructions: 'tono directo' }));
    expect(res.status).toBe(200);
    expect(state.topics.t1.toneInstructions).toBe('tono directo');
  });

  it('sigue aceptando solo activo (compatibilidad)', async () => {
    const { db, state } = createFakeDb({ t1: { label: 'SEO', activo: true } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1', activo: false }));
    expect(res.status).toBe(200);
    expect(state.topics.t1.activo).toBe(false);
  });

  it('rechaza si no manda ni activo ni toneInstructions', async () => {
    const { db } = createFakeDb({ t1: { label: 'SEO' } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1' }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/noticias/topics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('borra el tópico y sus notas, sin tocar notas de otros tópicos', async () => {
    const { db, state } = createFakeDb(
      { t1: { label: 'SEO' }, t2: { label: 'Neuquén' } },
      {
        n1: { topicId: 't1', title: 'nota 1' },
        n2: { topicId: 't1', title: 'nota 2' },
        n3: { topicId: 't2', title: 'nota de otro tópico' },
      }
    );
    getDb.mockReturnValue(db);

    const res = await DELETE(makeRequest({ id: 't1' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deletedCount).toBe(2);
    expect(state.topics.t1).toBeUndefined();
    expect(state.topics.t2).toBeDefined();
    expect(state.notes.n1).toBeUndefined();
    expect(state.notes.n2).toBeUndefined();
    expect(state.notes.n3).toBeDefined();
  });

  it('devuelve 404 si el tópico no existe', async () => {
    const { db } = createFakeDb({});
    getDb.mockReturnValue(db);
    const res = await DELETE(makeRequest({ id: 'no-existe' }));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npm test -- src/app/api/noticias/topics/route.test.js`
Expected: FAIL — `DELETE` no existe todavía, `PATCH` no acepta `toneInstructions`.

- [ ] **Step 3: Implementar el `PATCH` extendido y el `DELETE`**

Reemplazar el `PATCH` completo actual:
```js
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
por:
```js
export async function PATCH(request) {
  try {
    const { id, activo, toneInstructions } = await request.json();
    if (!id) {
      return Response.json({ error: 'id es requerido' }, { status: 400 });
    }
    if (activo === undefined && toneInstructions === undefined) {
      return Response.json({ error: 'Nada para actualizar (activo o toneInstructions)' }, { status: 400 });
    }
    if (activo !== undefined && typeof activo !== 'boolean') {
      return Response.json({ error: 'activo debe ser boolean' }, { status: 400 });
    }
    if (toneInstructions !== undefined && typeof toneInstructions !== 'string') {
      return Response.json({ error: 'toneInstructions debe ser string' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const update = {};
    if (activo !== undefined) update.activo = activo;
    if (toneInstructions !== undefined) update.toneInstructions = toneInstructions.trim() || null;

    await db.collection('noticias_topics').doc(id).update(update);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

Agregar el `DELETE` al final del archivo:
```js
export async function DELETE(request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return Response.json({ error: 'id es requerido' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const topicRef = db.collection('noticias_topics').doc(id);
    const topicSnap = await topicRef.get();
    if (!topicSnap.exists) {
      return Response.json({ error: 'Tópico no encontrado' }, { status: 404 });
    }

    const notesSnap = await db.collection('noticias').where('topicId', '==', id).get();
    const docs = notesSnap.docs;

    const BATCH_LIMIT = 500;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const doc of docs.slice(i, i + BATCH_LIMIT)) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    await topicRef.delete();

    return Response.json({ success: true, deletedCount: docs.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npm test -- src/app/api/noticias/topics/route.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/noticias/topics/route.js src/app/api/noticias/topics/route.test.js
git commit -m "feat: PATCH toneInstructions + DELETE en cascada para tópicos

DELETE borra el tópico y todas sus notas en noticias (por topicId,
en tandas de 500 por el límite de Firestore). 404 si el tópico no
existe.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: API — `/api/noticias/config` (horario)

**Files:**
- Modify: `src/app/api/noticias/config/route.js`
- Create: `src/app/api/noticias/config/route.test.js`

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: `GET`/`PATCH` ahora también devuelven/aceptan `schedule` (objeto con las 7 claves de día o `null`).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/app/api/noticias/config/route.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));

import { getDb } from '@/lib/firebase-admin';
import { PATCH } from './route.js';

function makeRequest(body) {
  return { json: async () => body };
}

function createFakeConfigDb(initial = {}) {
  const state = { settings: { ...initial } };
  return {
    state,
    db: {
      collection() {
        return {
          doc() {
            return {
              async get() { return { exists: true, data: () => state.settings }; },
              async set(patch) { Object.assign(state.settings, patch); },
            };
          },
        };
      },
    },
  };
}

const VALID_SCHEDULE = {
  lun: { enabled: true, startHour: 8, endHour: 23 },
  mar: { enabled: true, startHour: 8, endHour: 23 },
  mie: { enabled: true, startHour: 8, endHour: 23 },
  jue: { enabled: true, startHour: 8, endHour: 23 },
  vie: { enabled: true, startHour: 8, endHour: 23 },
  sab: { enabled: false, startHour: null, endHour: null },
  dom: { enabled: false, startHour: null, endHour: null },
};

describe('PATCH /api/noticias/config — schedule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('acepta un schedule válido', async () => {
    const { db, state } = createFakeConfigDb({ active: true, dailyCap: null });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ schedule: VALID_SCHEDULE }));
    expect(res.status).toBe(200);
    expect(state.settings.schedule).toEqual(VALID_SCHEDULE);
  });

  it('acepta schedule: null (vuelve a publicar sin restricción)', async () => {
    const { db, state } = createFakeConfigDb({ schedule: VALID_SCHEDULE });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ schedule: null }));
    expect(res.status).toBe(200);
    expect(state.settings.schedule).toBeNull();
  });

  it('rechaza un schedule al que le falta un día', async () => {
    const { lun: _omitido, ...incompleto } = VALID_SCHEDULE;
    const { db } = createFakeConfigDb({});
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ schedule: incompleto }));
    expect(res.status).toBe(400);
  });

  it('rechaza startHour fuera de rango (0-24)', async () => {
    const { db } = createFakeConfigDb({});
    getDb.mockReturnValue(db);
    const bad = { ...VALID_SCHEDULE, lun: { enabled: true, startHour: 25, endHour: 23 } };
    const res = await PATCH(makeRequest({ schedule: bad }));
    expect(res.status).toBe(400);
  });

  it('acepta endHour: 24 (hasta medianoche)', async () => {
    const { db, state } = createFakeConfigDb({});
    getDb.mockReturnValue(db);
    const ok = { ...VALID_SCHEDULE, vie: { enabled: true, startHour: 20, endHour: 24 } };
    const res = await PATCH(makeRequest({ schedule: ok }));
    expect(res.status).toBe(200);
    expect(state.settings.schedule.vie.endHour).toBe(24);
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npm test -- src/app/api/noticias/config/route.test.js`
Expected: FAIL — `schedule` todavía no se valida ni se guarda.

- [ ] **Step 3: Implementar la validación y el manejo de `schedule`**

Al principio del archivo, después del `import`, agregar:
```js
const SCHEDULE_DAYS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

function isValidSchedule(schedule) {
  if (schedule === null) return true;
  if (typeof schedule !== 'object') return false;
  const hourOk = (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 24);
  return SCHEDULE_DAYS.every(day => {
    const entry = schedule[day];
    return !!entry && typeof entry.enabled === 'boolean' && hourOk(entry.startHour) && hourOk(entry.endHour);
  });
}
```

Reemplazar `const DEFAULTS = { active: true, dailyCap: null };` por:
```js
const DEFAULTS = { active: true, dailyCap: null, schedule: null };
```

En `GET`, reemplazar:
```js
    const data = doc.data();
    return Response.json({
      active: data.active !== false,
      dailyCap: data.dailyCap ?? null,
    });
```
por:
```js
    const data = doc.data();
    return Response.json({
      active: data.active !== false,
      dailyCap: data.dailyCap ?? null,
      schedule: data.schedule ?? null,
    });
```

En `PATCH`, agregar el bloque de `schedule` junto a los de `active`/`dailyCap` (antes del chequeo de `Object.keys(update).length`):
```js
    if ('schedule' in body) {
      if (!isValidSchedule(body.schedule)) {
        return Response.json({
          error: 'schedule inválido — debe tener las 7 claves de día (lun..dom) con { enabled, startHour, endHour }, o ser null',
        }, { status: 400 });
      }
      update.schedule = body.schedule;
    }
```

Y en la respuesta final de `PATCH`, reemplazar:
```js
    return Response.json({ success: true, active: data.active !== false, dailyCap: data.dailyCap ?? null });
```
por:
```js
    return Response.json({
      success: true,
      active: data.active !== false,
      dailyCap: data.dailyCap ?? null,
      schedule: data.schedule ?? null,
    });
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npm test -- src/app/api/noticias/config/route.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/noticias/config/route.js src/app/api/noticias/config/route.test.js
git commit -m "feat: horario semanal configurable en /api/noticias/config

schedule: null (default) mantiene el comportamiento actual (24/7).
Validación: las 7 claves de día, enabled boolean, horas 0-24
(24 = hasta medianoche) o null (sin restricción ese día).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: UI — componente `TopicCard`

**Files:**
- Create: `src/components/admin/TopicCard.jsx`

**Interfaces:**
- Consumes: ninguna función de otras tareas directamente (las llamadas a la API las hace el padre — Task 6 — vía props/callbacks).
- Produces: `export default function TopicCard({ topic, notes, busy, onToggleActivo, onSaveTone, onDelete })`.
  - `topic`: `{ id, label, query, activo, toneInstructions }`.
  - `notes`: array de notas de ESE tópico ya filtradas por el padre — cada nota trae `{ id, title, status, publishedAt, sourceUrl, topicId }` (mismas keys que ya devuelve `/api/noticias`, ver `NoticiasBotManager.jsx` actual).
  - `onToggleActivo(id: string, activo: boolean)`, `onSaveTone(id: string, toneInstructions: string)`, `onDelete(topic: object)` — el padre hace el fetch y el `confirm()`.

- [ ] **Step 1: Crear el componente**

Crear `src/components/admin/TopicCard.jsx`:
```jsx
'use client';

import { useState } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TopicCard({ topic, notes, busy, onToggleActivo, onSaveTone, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [toneDraft, setToneDraft] = useState(topic.toneInstructions || '');

  const publishedCount = notes.filter(n => n.status === 'published').length;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/40">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <span className={`text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{topic.label}</span>
          <span className="text-xs text-gray-400 shrink-0">
            {publishedCount} publicada{publishedCount === 1 ? '' : 's'}
          </span>
        </button>
        <label className="flex items-center gap-1.5 shrink-0 text-xs">
          <input
            type="checkbox"
            checked={topic.activo}
            disabled={busy}
            onChange={e => onToggleActivo(topic.id, e.target.checked)}
          />
          <span className={topic.activo ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
            {topic.activo ? 'Activo' : 'Inactivo'}
          </span>
        </label>
      </div>

      {expanded && (
        <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5 block">
              Tono de este tópico
            </label>
            <textarea
              value={toneDraft}
              onChange={e => setToneDraft(e.target.value)}
              placeholder="Ej: tono periodístico, directo, sin hype, sin frases hechas de marketing"
              rows={3}
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2"
            />
            <button
              type="button"
              onClick={() => onSaveTone(topic.id, toneDraft)}
              disabled={busy}
              className="mt-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50"
            >
              Guardar tono
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              Últimas publicaciones
            </p>
            {notes.length === 0 ? (
              <p className="text-xs text-gray-400">Todavía no publicó nada de este tópico.</p>
            ) : (
              <div className="space-y-1">
                {notes.slice(0, 10).map(n => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-gray-800/40 rounded-lg px-3 py-1.5"
                  >
                    <a
                      href={`/noticias/${n.id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 dark:text-white truncate hover:underline"
                    >
                      {n.title || '—'}
                    </a>
                    <span className="text-gray-400 shrink-0">{formatDate(n.publishedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => onDelete(topic)}
              disabled={busy}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
            >
              Eliminar tópico
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que el proyecto sigue compilando**

Run: `npm run build`
Expected: exit 0 (el componente no se usa todavía en ningún lado — Task 6 lo conecta — así que esto solo confirma que no hay errores de sintaxis/JSX).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/TopicCard.jsx
git commit -m "feat: componente TopicCard (tarjeta expandible por tópico)

Todavía no se usa desde NoticiasBotManager — eso es el próximo task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: UI — rediseño de `NoticiasBotManager`

**Files:**
- Modify: `src/components/admin/NoticiasBotManager.jsx`

**Interfaces:**
- Consumes: `TopicCard` (Task 5) — `import TopicCard from './TopicCard'`. `PATCH /api/noticias/topics` con `toneInstructions` y `DELETE /api/noticias/topics` (Task 3). `PATCH /api/noticias/config` con `schedule` (Task 4).
- Produces: nada que otras tareas consuman (es la hoja del árbol de dependencias).

- [ ] **Step 1: Reemplazar el archivo completo**

Este task reemplaza `src/components/admin/NoticiasBotManager.jsx` entero (cambia la estructura de estado, agrega el editor de horario, y cambia el tramo final de tópicos + log por tarjetas). Contenido completo del archivo:

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import TopicCard from './TopicCard';

const DAYS = [
  ['lun', 'Lunes'], ['mar', 'Martes'], ['mie', 'Miércoles'], ['jue', 'Jueves'],
  ['vie', 'Viernes'], ['sab', 'Sábado'], ['dom', 'Domingo'],
];

const ALL_DAYS_UNRESTRICTED = Object.fromEntries(
  DAYS.map(([key]) => [key, { enabled: true, startHour: null, endHour: null }])
);

function HourSelect({ value, onChange, disabled }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      disabled={disabled}
      className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 disabled:opacity-50"
    >
      <option value="">--</option>
      {Array.from({ length: 25 }, (_, h) => (
        <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
      ))}
    </select>
  );
}

export default function NoticiasBotManager() {
  const [topics, setTopics]     = useState([]);
  const [config, setConfig]     = useState({ active: true, dailyCap: null, schedule: null });
  const [scheduleDraft, setScheduleDraft] = useState(ALL_DAYS_UNRESTRICTED);
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
      setConfig({ active: cData.active !== false, dailyCap: cData.dailyCap ?? null, schedule: cData.schedule ?? null });
      setScheduleDraft(cData.schedule || ALL_DAYS_UNRESTRICTED);
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

  const saveSchedule = async () => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await fetch('/api/noticias/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: scheduleDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(c => ({ ...c, schedule: data.schedule }));
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

  const saveTone = async (id, toneInstructions) => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await fetch('/api/noticias/topics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, toneInstructions }),
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

  const deleteTopic = async (topic) => {
    const topicNotes = log.filter(n => n.topicId === topic.id);
    const ok = window.confirm(
      `Vas a borrar el tópico "${topic.label}" y sus ${topicNotes.length} notas publicadas en el sitio. ` +
      `No se puede deshacer. Los posts que ya se publicaron en Facebook/LinkedIn/Instagram no se borran — esto solo afecta tu sitio.`
    );
    if (!ok) return;

    setBusy(true); setErrorMsg('');
    try {
      const res = await fetch('/api/noticias/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: topic.id }),
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

      {/* Horario de publicación */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Horario de publicación</p>
        <div className="space-y-1.5">
          {DAYS.map(([key, dayLabel]) => {
            const day = scheduleDraft[key];
            return (
              <div key={key} className="flex items-center gap-3 text-xs bg-gray-50 dark:bg-gray-800/40 rounded-lg px-3 py-2">
                <label className="flex items-center gap-1.5 w-24 shrink-0">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={e => setScheduleDraft(s => ({ ...s, [key]: { ...s[key], enabled: e.target.checked } }))}
                  />
                  <span className={day.enabled ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>{dayLabel}</span>
                </label>
                <span className="text-gray-400">desde</span>
                <HourSelect
                  value={day.startHour}
                  disabled={!day.enabled}
                  onChange={v => setScheduleDraft(s => ({ ...s, [key]: { ...s[key], startHour: v } }))}
                />
                <span className="text-gray-400">hasta</span>
                <HourSelect
                  value={day.endHour}
                  disabled={!day.enabled}
                  onChange={v => setScheduleDraft(s => ({ ...s, [key]: { ...s[key], endHour: v } }))}
                />
              </div>
            );
          })}
        </div>
        <button onClick={saveSchedule} disabled={busy}
          className="mt-2 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50">
          Guardar horario
        </button>
        <p className="text-[11px] text-gray-400 mt-1">
          "--" en desde/hasta = sin restricción de hora ese día. Un día sin tildar = no publica nada ese día.
        </p>
      </div>

      {/* Agregar tópico */}
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

        {/* Tópicos, uno por tarjeta */}
        <div className="space-y-2">
          {topics.length === 0 && <p className="text-xs text-gray-400">Sin tópicos todavía.</p>}
          {topics.map(t => (
            <TopicCard
              key={t.id}
              topic={t}
              notes={log.filter(n => n.topicId === t.id)}
              busy={busy}
              onToggleActivo={toggleTopic}
              onSaveTone={saveTone}
              onDelete={deleteTopic}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar el build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Correr toda la suite**

Run: `npm test`
Expected: PASS (nada de esto tiene tests automáticos, pero confirma que no se rompió nada de lo anterior).

- [ ] **Step 4: Verificación manual en el browser**

```bash
npm run dev
```
Abrir `/admin`, entrar a la tab "Noticias (Bot)" (requiere login de admin), y confirmar a mano:
- El editor de horario semanal aparece, los 7 días con sus selects, y "Guardar horario" no tira error.
- Cada tópico aparece como una tarjeta colapsada; al expandir se ve el textarea de tono, sus propias últimas publicaciones (no las de otros tópicos), y el botón "Eliminar tópico".
- Guardar un tono y volver a cargar la página lo mantiene guardado.
- Eliminar un tópico de prueba (crear uno nuevo primero, sin notas, para no perder datos reales) muestra el `confirm()` con el texto correcto y lo saca de la lista al confirmar.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/NoticiasBotManager.jsx
git commit -m "feat: rediseña Noticias (Bot) a tarjetas por tópico + horario

Reemplaza la lista plana + tabla global por TopicCard (tono, notas y
borrado por tópico) y agrega el editor de horario semanal arriba.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Después de completar todos los tasks

- Actualizar `CLAUDE.md`: sección "Colecciones Firestore" (documentar `toneInstructions` en
  `noticias_topics` y `schedule` en `noticias_config`), y la sección "Bot de noticias" con
  una línea sobre el horario semanal y el borrado en cascada.
- `git push` — no hace falta ninguna env var ni secret nuevo para esto (todo Firestore, ya
  cubierto por los secrets existentes).
