# Auditoría SEO automática + publicación en redes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el sitio audite solo, dos veces por semana, un rubro en una ciudad argentina, publique el informe en `/auditorias/[id]` y lo anuncie en LinkedIn, Instagram y Facebook vía Make.com.

**Architecture:** La lógica vive en `src/lib/` (elección de combinación ciudad × rubro, auditoría por lote reutilizando `runLeadFinderAction`, guardado compartido, orquestación con candado en Firestore). La corrida programada es un script de GitHub Actions (`tsx --tsconfig jsconfig.json`, sin el límite de 60 s de Vercel Hobby) disparado por cron-job.org; el admin tiene una ruta `POST` para "Correr ahora" y una tarjeta para configurar.

**Tech Stack:** Next.js 15 (App Router), Firebase Admin / Firestore, Google Places API (vía `runLeadFinderAction`), `callGemini`, Make.com webhook, GitHub Actions, `tsx`, vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-auditoria-automatica-design.md`

## Global Constraints

- Tests con vitest (`npm test`), archivos `src/**/*.test.js`; mocks con `vi.mock('@/lib/...')` como en `src/app/api/noticias/config/route.test.js`.
- Node 20 en CI; `Response.json` estático disponible.
- Las rutas de admin usan `requireAdmin` de `@/lib/adminAuth`. Sin credenciales hardcodeadas.
- Modelo Gemini: el que ya usa `callGemini` (`gemini-3.8-flash`). No tocar `geminiClient.js`.
- El payload a Make.com mantiene los nombres de campo existentes: `type: 'keyword_report'`, `text`, `networks`, y `imageUrl` (nunca `url`). No cambiar nombres.
- El post en redes **no incluye nombres de negocios**, solo datos agregados.
- `auditoria_auto` y `auditoria_auto_runs` son solo Admin SDK; no se agregan reglas (Firestore deniega por defecto lo no declarado en `firestore.rules`).
- La automatización arranca **apagada** (`activo: false` en la semilla) hasta que Mariano la active.
- Server components/Actions leen Firestore con `getDb()` directo, nunca con self-fetch.
- Commits locales por tarea solo si Mariano ya autorizó commits en esta sesión; **nunca `git push`** sin que lo pida. Mensajes terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Toda URL de webhook externo registrada en un servicio termina en `/` (regla `trailingSlash`); aplica si se agrega alguna.

## Review Focus

- Primera corrida sin el doc `auditoria_auto/config`: debe usar la semilla con `activo: false` y **no publicar nada** (Task 4).
- Gemini sin cuota al guardar el informe: la corrida igual guarda y publica, con resumen de plantilla (Task 2).
- Lugares sin sitio web o con `seoScore` nulo: se descartan y no rompen las estadísticas; con 0 resultados no se publica (Tasks 1, 3, 4).
- Make.com responde no-2xx o lanza excepción: el informe queda guardado, el run queda `post_fallido` y el candado se libera (Task 4).
- Ciudad que Nominatim no geocodifica: run `error`, la combinación NO se marca como corrida y no se publica (Tasks 3, 4).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/data/auditoriaAuto.js` (nuevo) | Semilla: ~41 ciudades, rubros (prioritarios y secundarios), imagen de marca por defecto |
| `src/lib/autoAudit.js` (nuevo) | Funciones puras: `pickNext`, `buildStats`, `buildPost`, `validateConfigPatch` |
| `src/lib/auditoriasStore.js` (nuevo) | `saveAuditoria` (extraído de `POST /api/auditorias`) |
| `src/lib/autoAuditBatch.js` (nuevo) | `runBatch`: geocodifica, busca candidatos y audita con presupuesto de tiempo |
| `src/lib/autoAuditRun.js` (nuevo) | `loadConfig`, `runAutoAudit`: candado, orquestación, post a Make, registro del run |
| `src/app/api/auditorias/route.js` (modifica) | `POST` delega en `saveAuditoria` |
| `src/app/api/cron/auditoria/route.js` (nuevo) | `POST` admin → `runAutoAudit({ force: true })` |
| `src/app/api/auditoria-auto/route.js` (nuevo) | `GET`/`PATCH` admin de la configuración y últimos runs |
| `scripts/auto-audit.mjs` (nuevo) | Entrada para GitHub Actions |
| `.github/workflows/auditoria-auto.yml` (nuevo) | Workflow `workflow_dispatch` |
| `src/components/admin/AutoAuditCard.jsx` (nuevo) | Tarjeta del admin |
| `src/data/adminNav.js`, `src/views/AdminPage.jsx` (modifican) | Nueva pestaña |

---

### Task 1: Semilla y funciones puras

**Files:**
- Create: `src/data/auditoriaAuto.js`
- Create: `src/lib/autoAudit.js`
- Test: `src/lib/autoAudit.test.js`

**Interfaces:**
- Produces:
  - `CIUDADES_SEMILLA: string[]`, `RUBROS_SEMILLA: Array<{ label, kind: 'type'|'text', value, prioritario }>`, `IMAGEN_MARCA: string` (de `@/data/auditoriaAuto`)
  - `COOLDOWN_MS`, `PRIORITY_RATIO`, `DEFAULT_NETWORKS`, `comboKey(ciudad, rubro) → string`
  - `pickNext(config, nowMs?, rand?) → { ciudad, rubro } | null`
  - `buildStats(results) → { total, avgSeoScore, lowSeoCount, withEmail }`
  - `buildPost({ combo, stats, auditoriaId, summary, imageUrl, networks }) → { title, payload }`
  - `validateConfigPatch(body) → { update } | { error }`

- [ ] **Step 1: Crear la semilla**

`src/data/auditoriaAuto.js`:

```js
// Semilla de la auditoría automática. La primera corrida la copia a Firestore
// (auditoria_auto/config) y desde ahí se edita desde el admin.
// Ciudades: masa crítica de comercios (no se usa localidadesAR.js: trae localidades diminutas).
export const CIUDADES_SEMILLA = [
  'Neuquén', 'Cipolletti', 'Plottier', 'General Roca', 'Bariloche', 'Viedma',
  'Trelew', 'Puerto Madryn', 'Comodoro Rivadavia', 'Río Gallegos', 'Ushuaia',
  'Santa Rosa', 'Bahía Blanca', 'Mar del Plata', 'La Plata', 'Tandil', 'Olavarría',
  'Buenos Aires', 'Rosario', 'Santa Fe', 'Rafaela', 'Paraná', 'Córdoba', 'Río Cuarto',
  'Mendoza', 'San Rafael', 'San Juan', 'San Luis', 'Villa Mercedes',
  'San Miguel de Tucumán', 'Salta', 'San Salvador de Jujuy', 'Santiago del Estero',
  'San Fernando del Valle de Catamarca', 'La Rioja', 'Resistencia', 'Corrientes',
  'Posadas', 'Formosa', 'Concordia', 'Villa Carlos Paz',
];

// kind 'type' → includedTypes de Places (searchNearby). kind 'text' → searchText libre.
// prioritario: negocios con etapas constructivas o de fabricación que consumen insumos
// (el tipo de sistema desarrollado en Almamod: requisiciones, stock, seguimiento, cómputo).
export const RUBROS_SEMILLA = [
  // Prioritarios — tipos de Places
  { label: 'Constructor',  kind: 'type', value: 'general_contractor', prioritario: true },
  { label: 'Electricista', kind: 'type', value: 'electrician',        prioritario: true },
  { label: 'Plomero',      kind: 'type', value: 'plumber',            prioritario: true },
  { label: 'Pintor',       kind: 'type', value: 'painter',            prioritario: true },
  { label: 'Ferretería',   kind: 'type', value: 'hardware_store',     prioritario: true },
  // Prioritarios — texto libre
  { label: 'Construcción en seco',       kind: 'text', value: 'construcción en seco',       prioritario: true },
  { label: 'Steel framing',              kind: 'text', value: 'steel framing',              prioritario: true },
  { label: 'Durlock',                    kind: 'text', value: 'durlock',                    prioritario: true },
  { label: 'Casas modulares',            kind: 'text', value: 'casas modulares',            prioritario: true },
  { label: 'Casas prefabricadas',        kind: 'text', value: 'casas prefabricadas',        prioritario: true },
  { label: 'Contenedores habitables',    kind: 'text', value: 'contenedores habitables',    prioritario: true },
  { label: 'Constructora',               kind: 'text', value: 'constructora',               prioritario: true },
  { label: 'Estudio de arquitectura',    kind: 'text', value: 'estudio de arquitectura',    prioritario: true },
  { label: 'Maestro mayor de obras',     kind: 'text', value: 'maestro mayor de obras',     prioritario: true },
  { label: 'Metalúrgica',                kind: 'text', value: 'metalúrgica',                prioritario: true },
  { label: 'Herrería',                   kind: 'text', value: 'herrería',                   prioritario: true },
  { label: 'Carpintería metálica',       kind: 'text', value: 'carpintería metálica',       prioritario: true },
  { label: 'Carpintería de aluminio',    kind: 'text', value: 'carpintería de aluminio',    prioritario: true },
  { label: 'Aberturas de aluminio',      kind: 'text', value: 'aberturas de aluminio',      prioritario: true },
  { label: 'Aberturas de PVC',           kind: 'text', value: 'aberturas de PVC',           prioritario: true },
  { label: 'Fábrica de aberturas',       kind: 'text', value: 'fábrica de aberturas',       prioritario: true },
  { label: 'Carpintería',                kind: 'text', value: 'carpintería',                prioritario: true },
  { label: 'Fábrica de muebles a medida', kind: 'text', value: 'fábrica de muebles a medida', prioritario: true },
  { label: 'Fábrica de premoldeados',    kind: 'text', value: 'fábrica de premoldeados',    prioritario: true },
  { label: 'Corralón',                   kind: 'text', value: 'corralón',                   prioritario: true },
  { label: 'Vidriería',                  kind: 'text', value: 'vidriería',                  prioritario: true },
  { label: 'Confección textil',          kind: 'text', value: 'confección textil',          prioritario: true },
  // Secundarios — variedad de contenido
  { label: 'Restaurante',  kind: 'type', value: 'restaurant',         prioritario: false },
  { label: 'Panadería',    kind: 'type', value: 'bakery',             prioritario: false },
  { label: 'Ropa',         kind: 'type', value: 'clothing_store',     prioritario: false },
  { label: 'Mecánico',     kind: 'type', value: 'car_repair',         prioritario: false },
  { label: 'Inmobiliaria', kind: 'type', value: 'real_estate_agency', prioritario: false },
  { label: 'Contabilidad', kind: 'type', value: 'accounting',         prioritario: false },
];

// Imagen de marca (Instagram no publica sin imagen). Se puede cambiar desde el admin
// (config.imageUrl). Debe devolver un JPG/PNG 1080x1080 público.
export const IMAGEN_MARCA =
  'https://res.cloudinary.com/dlshym1te/image/fetch/w_1080,h_1080,c_pad,b_white,f_jpg/https://marianoaliandri.com.ar/logo-ma.png';
```

- [ ] **Step 2: Escribir los tests que fallan**

`src/lib/autoAudit.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  COOLDOWN_MS, DEFAULT_NETWORKS, comboKey, pickNext, buildStats, buildPost, validateConfigPatch,
} from './autoAudit.js';

const NOW = Date.UTC(2026, 9, 9);
const PRIO = { label: 'Ferretería', kind: 'type', value: 'hardware_store', prioritario: true };
const SEC  = { label: 'Panadería',  kind: 'type', value: 'bakery',         prioritario: false };

describe('pickNext', () => {
  it('con rand < 0.8 elige un rubro prioritario', () => {
    const c = pickNext({ ciudades: ['A', 'B'], rubros: [PRIO, SEC], ultimaCorrida: {} }, NOW, () => 0.5);
    expect(c.rubro.label).toBe('Ferretería');
  });

  it('con rand >= 0.8 elige un rubro secundario', () => {
    const c = pickNext({ ciudades: ['A', 'B'], rubros: [PRIO, SEC], ultimaCorrida: {} }, NOW, () => 0.9);
    expect(c.rubro.label).toBe('Panadería');
  });

  it('si el pool elegido está vacío usa el otro', () => {
    const c = pickNext({ ciudades: ['A'], rubros: [SEC], ultimaCorrida: {} }, NOW, () => 0.1);
    expect(c.rubro.label).toBe('Panadería');
  });

  it('no repite una combinación corrida hace menos de 30 días', () => {
    const config = {
      ciudades: ['A', 'B'], rubros: [PRIO],
      ultimaCorrida: { [comboKey('A', PRIO)]: NOW - 1000 },
    };
    expect(pickNext(config, NOW, () => 0.1).ciudad).toBe('B');
  });

  it('vuelve a habilitar una combinación pasados 30 días', () => {
    const config = {
      ciudades: ['A'], rubros: [PRIO],
      ultimaCorrida: { [comboKey('A', PRIO)]: NOW - COOLDOWN_MS },
    };
    expect(pickNext(config, NOW, () => 0.1).ciudad).toBe('A');
  });

  it('prefiere la combinación corrida hace más tiempo', () => {
    const config = {
      ciudades: ['A', 'B'], rubros: [PRIO],
      ultimaCorrida: {
        [comboKey('A', PRIO)]: NOW - COOLDOWN_MS - 5000,
        [comboKey('B', PRIO)]: NOW - COOLDOWN_MS - 9000,
      },
    };
    expect(pickNext(config, NOW, () => 0.1).ciudad).toBe('B');
  });

  it('devuelve null si todas están en cooldown o no hay ciudades/rubros', () => {
    const config = { ciudades: ['A'], rubros: [PRIO], ultimaCorrida: { [comboKey('A', PRIO)]: NOW } };
    expect(pickNext(config, NOW)).toBeNull();
    expect(pickNext({ ciudades: [], rubros: [PRIO] }, NOW)).toBeNull();
    expect(pickNext({ ciudades: ['A'], rubros: [] }, NOW)).toBeNull();
  });
});

describe('buildStats', () => {
  it('calcula total, promedio, débiles (<50) y con email', () => {
    const stats = buildStats([
      { seoScore: 20, email: 'a@a.com' },
      { seoScore: 49, email: null },
      { seoScore: 50, email: 'b@b.com' },
      { seoScore: 81, email: null },
    ]);
    expect(stats).toEqual({ total: 4, avgSeoScore: 50, lowSeoCount: 2, withEmail: 2 });
  });

  it('con lista vacía devuelve ceros y promedio null (no NaN)', () => {
    expect(buildStats([])).toEqual({ total: 0, avgSeoScore: null, lowSeoCount: 0, withEmail: 0 });
  });

  it('ignora scores no numéricos en el promedio', () => {
    const stats = buildStats([{ seoScore: null }, { seoScore: 40 }]);
    expect(stats.avgSeoScore).toBe(40);
    expect(stats.total).toBe(2);
  });
});

describe('buildPost', () => {
  const combo = { ciudad: 'Mendoza', rubro: PRIO };
  const stats = { total: 12, avgSeoScore: 41, lowSeoCount: 9, withEmail: 5 };

  it('arma título, texto con agregados y link al informe', () => {
    const { title, payload } = buildPost({
      combo, stats, auditoriaId: 'abc123', summary: 'Resumen corto.',
      imageUrl: 'https://img/x.jpg', networks: DEFAULT_NETWORKS,
    });
    expect(title).toBe('Auditoría SEO de 12 sitios de Ferretería en Mendoza');
    expect(payload.type).toBe('keyword_report');
    expect(payload.networks).toEqual(['linkedin', 'instagram', 'facebook']);
    expect(payload.imageUrl).toBe('https://img/x.jpg');
    expect(payload.text).toContain('41/100');
    expect(payload.text).toContain('75% (9 de 12)');
    expect(payload.text).toContain('Resumen corto.');
    expect(payload.text).toContain('https://marianoaliandri.com.ar/auditorias/abc123');
  });

  it('trunca resúmenes largos a 240 caracteres', () => {
    const { payload } = buildPost({
      combo, stats, auditoriaId: 'x', summary: 'a'.repeat(500), imageUrl: 'u', networks: ['linkedin'],
    });
    const line = payload.text.split('\n').find(l => l.startsWith('aaa'));
    expect(line.length).toBeLessThanOrEqual(240);
    expect(line.endsWith('…')).toBe(true);
  });

  it('sin summary no deja líneas vacías de más', () => {
    const { payload } = buildPost({ combo, stats, auditoriaId: 'x', imageUrl: 'u', networks: ['linkedin'] });
    expect(payload.text).not.toMatch(/\n{3,}/);
  });
});

describe('validateConfigPatch', () => {
  it('acepta activo boolean', () => {
    expect(validateConfigPatch({ activo: true })).toEqual({ update: { activo: true } });
  });

  it('rechaza activo no boolean', () => {
    expect(validateConfigPatch({ activo: 'si' }).error).toMatch(/activo/);
  });

  it('normaliza ciudades: trim, descarta vacías y duplicadas', () => {
    const r = validateConfigPatch({ ciudades: [' Neuquén ', '', 'Neuquén', 'Salta'] });
    expect(r.update.ciudades).toEqual(['Neuquén', 'Salta']);
  });

  it('rechaza ciudades si no es array o queda vacío', () => {
    expect(validateConfigPatch({ ciudades: 'Neuquén' }).error).toMatch(/ciudades/);
    expect(validateConfigPatch({ ciudades: ['  '] }).error).toMatch(/ciudades/);
  });

  it('valida rubros: kind type|text, label y value no vacíos, prioritario boolean', () => {
    const ok = validateConfigPatch({ rubros: [{ label: 'X', kind: 'text', value: 'x', prioritario: true }] });
    expect(ok.update.rubros).toHaveLength(1);
    expect(validateConfigPatch({ rubros: [{ label: 'X', kind: 'otro', value: 'x', prioritario: true }] }).error).toMatch(/rubros/);
    expect(validateConfigPatch({ rubros: [{ label: '', kind: 'text', value: 'x', prioritario: true }] }).error).toMatch(/rubros/);
    expect(validateConfigPatch({ rubros: [] }).error).toMatch(/rubros/);
  });

  it('valida networks contra linkedin/instagram/facebook', () => {
    expect(validateConfigPatch({ networks: ['linkedin', 'facebook'] }).update.networks).toEqual(['linkedin', 'facebook']);
    expect(validateConfigPatch({ networks: ['tiktok'] }).error).toMatch(/networks/);
    expect(validateConfigPatch({ networks: [] }).error).toMatch(/networks/);
  });

  it('valida imageUrl https', () => {
    expect(validateConfigPatch({ imageUrl: 'https://a/b.jpg' }).update.imageUrl).toBe('https://a/b.jpg');
    expect(validateConfigPatch({ imageUrl: 'http://a/b.jpg' }).error).toMatch(/imageUrl/);
  });

  it('rechaza un body sin campos conocidos', () => {
    expect(validateConfigPatch({ otraCosa: 1 }).error).toMatch(/Nada para actualizar/);
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que fallan**

Run: `npx vitest run src/lib/autoAudit.test.js`
Expected: FAIL (`Cannot find module './autoAudit.js'` o similar).

- [ ] **Step 4: Implementar `src/lib/autoAudit.js`**

```js
// Lógica pura de la auditoría automática (sin I/O) — ver
// docs/superpowers/specs/2026-10-08-auditoria-automatica-design.md
export const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // = TTL de caché de auditPlace
export const PRIORITY_RATIO = 0.8;
export const DEFAULT_NETWORKS = ['linkedin', 'instagram', 'facebook'];

const SITE_URL = 'https://marianoaliandri.com.ar';
const VALID_NETWORKS = ['linkedin', 'instagram', 'facebook'];
const SUMMARY_MAX = 240;

export function comboKey(ciudad, rubro) {
  return `${ciudad}|${rubro.label}`;
}

// Elige la próxima combinación ciudad × rubro. Respeta la proporción prioritarios/secundarios,
// nunca repite una combinación dentro de COOLDOWN_MS y, dentro del pool, toma la corrida hace
// más tiempo (las nunca corridas primero; empate → al azar).
export function pickNext(config, nowMs = Date.now(), rand = Math.random) {
  const ciudades = config?.ciudades || [];
  const rubros = config?.rubros || [];
  const last = config?.ultimaCorrida || {};

  const eligible = [];
  for (const ciudad of ciudades) {
    for (const rubro of rubros) {
      const lastRun = last[comboKey(ciudad, rubro)] || 0;
      if (nowMs - lastRun >= COOLDOWN_MS) eligible.push({ ciudad, rubro, lastRun });
    }
  }
  if (!eligible.length) return null;

  const prio = eligible.filter(c => c.rubro.prioritario);
  const sec = eligible.filter(c => !c.rubro.prioritario);
  let pool = rand() < PRIORITY_RATIO ? prio : sec;
  if (!pool.length) pool = prio.length ? prio : sec;

  const oldest = Math.min(...pool.map(c => c.lastRun));
  const candidates = pool.filter(c => c.lastRun === oldest);
  const pick = candidates[Math.floor(rand() * candidates.length)];
  return { ciudad: pick.ciudad, rubro: pick.rubro };
}

// Mismo shape que stats de POST /api/auditorias.
export function buildStats(results) {
  const total = results.length;
  const scored = results.filter(r => typeof r.seoScore === 'number');
  const avgSeoScore = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.seoScore, 0) / scored.length)
    : null;
  const lowSeoCount = scored.filter(r => r.seoScore < 50).length;
  const withEmail = results.filter(r => r.email).length;
  return { total, avgSeoScore, lowSeoCount, withEmail };
}

function clip(text, max) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Post para redes: SOLO datos agregados, nunca nombres de negocios.
export function buildPost({ combo, stats, auditoriaId, summary, imageUrl, networks }) {
  const { ciudad, rubro } = combo;
  const title = `Auditoría SEO de ${stats.total} sitios de ${rubro.label} en ${ciudad}`;
  const pctLow = stats.total ? Math.round((stats.lowSeoCount / stats.total) * 100) : 0;

  const lines = [
    title,
    '',
    `📊 SEO promedio: ${stats.avgSeoScore ?? '—'}/100`,
    `⚠️ ${pctLow}% (${stats.lowSeoCount} de ${stats.total}) con posicionamiento débil (menos de 50)`,
  ];
  if (summary && String(summary).trim()) {
    lines.push('', clip(summary, SUMMARY_MAX));
  }
  lines.push('', `Ver el informe completo: ${SITE_URL}/auditorias/${auditoriaId}`);

  return {
    title,
    payload: {
      type: 'keyword_report',
      text: lines.join('\n'),
      networks: networks?.length ? networks : DEFAULT_NETWORKS,
      imageUrl,
    },
  };
}

// Valida el PATCH del admin sobre auditoria_auto/config. Devuelve { update } o { error }.
export function validateConfigPatch(body) {
  const update = {};

  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') return { error: 'activo debe ser boolean' };
    update.activo = body.activo;
  }

  if ('ciudades' in body) {
    if (!Array.isArray(body.ciudades)) return { error: 'ciudades debe ser un array de textos' };
    const ciudades = [...new Set(
      body.ciudades.map(c => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)
    )];
    if (!ciudades.length || ciudades.length > 300) return { error: 'ciudades: debe haber entre 1 y 300' };
    update.ciudades = ciudades;
  }

  if ('rubros' in body) {
    if (!Array.isArray(body.rubros) || !body.rubros.length || body.rubros.length > 300) {
      return { error: 'rubros: debe ser un array de 1 a 300 elementos' };
    }
    const rubros = [];
    for (const r of body.rubros) {
      const label = typeof r?.label === 'string' ? r.label.trim() : '';
      const value = typeof r?.value === 'string' ? r.value.trim() : '';
      if (!label || !value || !['type', 'text'].includes(r?.kind) || typeof r?.prioritario !== 'boolean') {
        return { error: 'rubros: cada rubro necesita label, value, kind (type|text) y prioritario (boolean)' };
      }
      rubros.push({ label, kind: r.kind, value, prioritario: r.prioritario });
    }
    update.rubros = rubros;
  }

  if ('networks' in body) {
    if (!Array.isArray(body.networks) || !body.networks.length
        || !body.networks.every(n => VALID_NETWORKS.includes(n))) {
      return { error: `networks: debe ser un subconjunto no vacío de ${VALID_NETWORKS.join(', ')}` };
    }
    update.networks = [...new Set(body.networks)];
  }

  if ('imageUrl' in body) {
    if (typeof body.imageUrl !== 'string' || !body.imageUrl.startsWith('https://')) {
      return { error: 'imageUrl debe ser una URL https' };
    }
    update.imageUrl = body.imageUrl;
  }

  if (!Object.keys(update).length) {
    return { error: 'Nada para actualizar (activo, ciudades, rubros, networks o imageUrl)' };
  }
  return { update };
}
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npx vitest run src/lib/autoAudit.test.js`
Expected: PASS (todos los tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/auditoriaAuto.js src/lib/autoAudit.js src/lib/autoAudit.test.js
git commit -m "feat: semilla y logica pura de la auditoria automatica"
```

---

### Task 2: Extraer `saveAuditoria`

**Files:**
- Create: `src/lib/auditoriasStore.js`
- Modify: `src/app/api/auditorias/route.js` (líneas 1-6 imports; 55-130 `POST`)
- Test: `src/lib/auditoriasStore.test.js`

**Interfaces:**
- Consumes: `getDb` (`@/lib/firebase-admin`), `callGemini` (`@/lib/geminiClient`).
- Produces: `saveAuditoria({ title, config, results, stats, summary? }) → Promise<{ id: string, summary: string }>`. Lanza `Error('DB no disponible')` si no hay Firestore.

- [ ] **Step 1: Escribir los tests que fallan**

`src/lib/auditoriasStore.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/geminiClient', () => ({ callGemini: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

import { getDb } from '@/lib/firebase-admin';
import { callGemini } from '@/lib/geminiClient';
import { saveAuditoria } from './auditoriasStore.js';

function fakeDb() {
  const added = [];
  return {
    added,
    collection: (name) => ({ add: async (doc) => { added.push({ name, doc }); return { id: 'new-id' }; } }),
  };
}

const config = { ciudades: ['Mendoza'], tiposLabels: ['Ferretería'] };
const stats = { total: 2, avgSeoScore: 40, lowSeoCount: 1, withEmail: 1 };
const results = [
  { id: 'p1', nombre: 'A', ciudad: 'Mendoza', tipo: 'Ferretería', rubro: 'Ferretería', aptoSistemaMedida: true,
    siteUrl: 'https://a.com', email: 'a@a.com', seoScore: 30, direccion: 'Calle 1', telefono: '123' },
  { id: 'p2', nombre: 'B', siteUrl: 'https://b.com', seoScore: 50 },
];

beforeEach(() => vi.clearAllMocks());

describe('saveAuditoria', () => {
  it('guarda rubro y aptoSistemaMedida y descarta dirección y teléfono', async () => {
    const db = fakeDb();
    getDb.mockReturnValue(db);
    const r = await saveAuditoria({ title: 'T', config, results, stats, summary: 'ya escrito' });
    expect(r.id).toBe('new-id');
    const saved = db.added[0].doc.results;
    expect(saved[0]).toMatchObject({ rubro: 'Ferretería', aptoSistemaMedida: true, email: 'a@a.com' });
    expect(saved[0]).not.toHaveProperty('direccion');
    expect(saved[0]).not.toHaveProperty('telefono');
    expect(saved[1]).toMatchObject({ rubro: null, aptoSistemaMedida: false });
  });

  it('usa el summary provisto sin llamar a Gemini', async () => {
    getDb.mockReturnValue(fakeDb());
    const r = await saveAuditoria({ title: 'T', config, results, stats, summary: '  texto editado  ' });
    expect(r.summary).toBe('texto editado');
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('genera el resumen con Gemini si no viene', async () => {
    getDb.mockReturnValue(fakeDb());
    callGemini.mockResolvedValue('Resumen de Gemini');
    const r = await saveAuditoria({ title: 'T', config, results, stats });
    expect(r.summary).toBe('Resumen de Gemini');
  });

  it('si Gemini falla usa la plantilla con los datos reales (no rompe el guardado)', async () => {
    const db = fakeDb();
    getDb.mockReturnValue(db);
    callGemini.mockRejectedValue(new Error('Todas las Gemini API keys agotaron su cuota (429)'));
    const r = await saveAuditoria({ title: 'T', config, results, stats });
    expect(r.id).toBe('new-id');
    expect(r.summary).toContain('Mendoza');
    expect(r.summary).toContain('50%');
    expect(db.added[0].doc.summary).toBe(r.summary);
  });

  it('lanza si no hay Firestore', async () => {
    getDb.mockReturnValue(null);
    await expect(saveAuditoria({ title: 'T', config, results, stats })).rejects.toThrow('DB no disponible');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npx vitest run src/lib/auditoriasStore.test.js`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Crear `src/lib/auditoriasStore.js`** (lógica movida tal cual del `POST` actual, más `rubro`/`aptoSistemaMedida`)

```js
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { callGemini } from '@/lib/geminiClient';

// Guarda una auditoría pública. Compartido por POST /api/auditorias (panel manual) y la
// auditoría automática. Email se guarda para uso admin; dirección y teléfono se descartan.
export async function saveAuditoria({ title, config, results, stats, summary: providedSummary }) {
  const db = getDb();
  if (!db) throw new Error('DB no disponible');

  const storedResults = results.map(r => ({
    id:           r.id,
    nombre:       r.nombre,
    ciudad:       r.ciudad   || null,
    tipo:         r.tipo,
    rubro:        r.rubro    || null,
    aptoSistemaMedida: r.aptoSistemaMedida === true,
    lat:          r.lat ?? null,
    lon:          r.lon ?? null,
    siteUrl:      r.siteUrl,
    email:        r.email    || null,   // se guarda para envío admin, no se muestra en página pública
    seoScore:     r.seoScore,
    hasSitemap:   r.hasSitemap,
    hasRobots:    r.hasRobots,
    metaDesc:     r.metaDesc ? true : r.metaDesc === null ? null : false,
    hasOG:        r.hasOG,
    lastModified: r.lastModified || null,
    rating:       r.rating   || null,
  }));

  // Resumen del reporte: usar el texto editado si vino; si no, Gemini; si falla, plantilla.
  const ciudades  = (config?.ciudades || []).join(', ') || 'la zona analizada';
  const tipos     = (config?.tiposLabels || []).slice(0, 8).join(', ');
  const total     = stats?.total ?? storedResults.length;
  const lowSeo    = stats?.lowSeoCount ?? 0;
  const avg       = stats?.avgSeoScore ?? '—';
  const withEmail = stats?.withEmail ?? 0;
  const pctLow    = total > 0 ? Math.round(lowSeo / total * 100) : 0;

  let summary = (providedSummary && providedSummary.trim()) ? providedSummary.trim() : null;
  if (!summary) {
    try {
      summary = await callGemini(
        `Sos un analista de presencia digital argentina. Escribí un texto de 4 a 5 oraciones en español rioplatense (vos, no tú) que resuma los resultados de esta auditoría SEO de negocios locales con sitio web propio.

Datos:
- Ciudades: ${ciudades}
- Tipos de negocio: ${tipos}
- Total de sitios auditados: ${total}
- Score SEO promedio: ${avg}/100
- Sitios con SEO débil (< 50): ${lowSeo} (${pctLow}%)
- Con email público: ${withEmail}

El texto debe explicar qué significa un SEO débil para un negocio local, destacar la oportunidad de mejora en la zona, sonar profesional y accesible. Sin listas ni bullets, solo prosa corrida. Sin precios ni publicidad directa.`
      );
    } catch {
      summary = null;
    }
    if (!summary) {
      summary = `Auditoría SEO de ${total} negocios con sitio web propio en ${ciudades}. El ${pctLow}% (${lowSeo}) tiene un posicionamiento web débil (score menor a 50) y el promedio general es ${avg}/100. ${withEmail} cuentan con un email público de contacto. El relevamiento evidencia oportunidades concretas de mejora en la presencia digital de los comercios de la zona: sitios sin sitemap, sin metadatos o desactualizados, que hoy pierden posiciones en Google frente a la competencia.`;
    }
  }

  const docRef = await db.collection('auditorias').add({
    title,
    config,
    results: storedResults,
    stats,
    summary,
    publishedAt: FieldValue.serverTimestamp(),
    createdAt:   FieldValue.serverTimestamp(),
  });

  return { id: docRef.id, summary };
}
```

- [ ] **Step 4: Ejecutar tests de la store**

Run: `npx vitest run src/lib/auditoriasStore.test.js`
Expected: PASS.

- [ ] **Step 5: Refactorizar `POST /api/auditorias`**

En `src/app/api/auditorias/route.js`:
1. Reemplazar el import `import { callGemini } from '@/lib/geminiClient';` (línea 5) por `import { saveAuditoria } from '@/lib/auditoriasStore';`.
2. Reemplazar TODA la función `export async function POST(request) { ... }` (líneas 55-130) por:

```js
export async function POST(request) {
  try {
    const body = await request.json();
    const { title, config, results, stats, summary } = body;
    if (!title || !results?.length) {
      return Response.json({ error: 'title y results son requeridos' }, { status: 400 });
    }

    const { id } = await saveAuditoria({ title, config, results, stats, summary });
    return Response.json({ success: true, id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```
Los demás handlers (`GET`, `PATCH`, `DELETE`) no se tocan y siguen usando `getDb` y `FieldValue`.

- [ ] **Step 6: Verificar que todo sigue verde y compila el lint**

Run: `npx vitest run && npx eslint src/app/api/auditorias/route.js src/lib/auditoriasStore.js`
Expected: tests PASS, eslint sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auditoriasStore.js src/lib/auditoriasStore.test.js src/app/api/auditorias/route.js
git commit -m "refactor: extraer saveAuditoria para reutilizarlo en la auditoria automatica"
```

---

### Task 3: `runBatch` (auditoría por lote)

**Files:**
- Create: `src/lib/autoAuditBatch.js`
- Test: `src/lib/autoAuditBatch.test.js`

**Interfaces:**
- Consumes: `runLeadFinderAction(action, params)` de `@/app/api/lead-finder/route` — devuelve un `Response` cuyo JSON es `{ ok: true, ...datos }` o `{ ok: false, error, code? }`. Acciones: `geocode {city, country} → {lat, lon}`, `searchNearby {lat, lon, type, radiusM, pageToken} → {places, nextPageToken}`, `searchText {lat, lon, query, radiusM, pageToken}`, `auditPlace {placeId} → {hasWebsite, siteUrl, seoScore, hasSitemap, hasRobots, metaDesc, hasOG, email, lastUpdated, rating, ...}`.
- Produces: `runBatch(combo, opts?) → Promise<{ results: Neg[], status: 'ok'|'cuota_agotada'|'error', error?: string, examined: number }>`. `opts`: `{ budgetMs=45000, maxSites=15, maxCandidates=40, pages=2, run, now, sleep }`.
  `Neg` = `{ id, nombre, ciudad, tipo, rubro, aptoSistemaMedida, lat, lon, siteUrl, email, seoScore, hasSitemap, hasRobots, metaDesc, hasOG, lastModified, rating }`.

- [ ] **Step 1: Escribir los tests que fallan**

`src/lib/autoAuditBatch.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';

// Evita cargar firebase-admin/authServer reales; runBatch recibe `run` inyectado.
vi.mock('@/app/api/lead-finder/route', () => ({ runLeadFinderAction: vi.fn() }));

import { runBatch } from './autoAuditBatch.js';

const json = (o) => Response.json(o);
const TYPE = { ciudad: 'Mendoza', rubro: { label: 'Ferretería', kind: 'type', value: 'hardware_store', prioritario: true } };
const TEXT = { ciudad: 'Salta', rubro: { label: 'Steel framing', kind: 'text', value: 'steel framing', prioritario: true } };
const place = (id, name = id) => ({ id, displayName: { text: name }, location: { latitude: 1, longitude: 2 } });
const audited = (over = {}) => ({
  ok: true, hasWebsite: true, siteUrl: 'https://x.com', seoScore: 40, hasSitemap: false, hasRobots: true,
  metaDesc: null, hasOG: false, email: null, lastUpdated: null, rating: 4.2, ...over,
});

function makeRun(handlers) {
  return vi.fn(async (action, params) => json(await handlers[action](params)));
}
const noSleep = async () => {};

describe('runBatch', () => {
  it('rubro type: usa searchNearby con el tipo y arma los resultados con rubro y apto', async () => {
    const run = makeRun({
      geocode: () => ({ ok: true, lat: -32.9, lon: -68.8 }),
      searchNearby: () => ({ ok: true, places: [place('p1', 'Ferretería Uno')], nextPageToken: null }),
      auditPlace: () => audited({ siteUrl: 'https://uno.com', email: 'a@uno.com' }),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(run).toHaveBeenCalledWith('searchNearby', expect.objectContaining({ type: 'hardware_store', radiusM: 15000 }));
    expect(out.status).toBe('ok');
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({
      id: 'p1', nombre: 'Ferretería Uno', ciudad: 'Mendoza', tipo: 'Ferretería', rubro: 'Ferretería',
      aptoSistemaMedida: true, siteUrl: 'https://uno.com', email: 'a@uno.com', seoScore: 40,
    });
  });

  it('rubro text: usa searchText con "<término>, <ciudad>"', async () => {
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchText: () => ({ ok: true, places: [place('p1')], nextPageToken: null }),
      auditPlace: () => audited(),
    });
    await runBatch(TEXT, { run, sleep: noSleep });
    expect(run).toHaveBeenCalledWith('searchText', expect.objectContaining({ query: 'steel framing, Salta' }));
  });

  it('descarta lugares sin sitio web o con seoScore nulo', async () => {
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: ({ placeId }) => ({
        a: audited({ hasWebsite: false, siteUrl: null, seoScore: null }),
        b: audited({ seoScore: null }),
        c: audited(),
      }[placeId]),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.results.map(r => r.id)).toEqual(['c']);
    expect(out.examined).toBe(3);
  });

  it('respeta maxSites', async () => {
    const places = ['a', 'b', 'c', 'd'].map(id => place(id));
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places, nextPageToken: null }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, maxSites: 2 });
    expect(out.results).toHaveLength(2);
  });

  it('respeta maxCandidates (cuida el tope diario de getDetails)', async () => {
    const places = ['a', 'b', 'c', 'd'].map(id => place(id));
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places, nextPageToken: null }),
      auditPlace: () => audited({ hasWebsite: false, seoScore: null }),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, maxCandidates: 3 });
    expect(out.examined).toBe(3);
  });

  it('QUOTA_EXCEEDED corta y conserva lo auditado hasta ahí', async () => {
    const calls = { n: 0 };
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: () => (++calls.n === 2 ? { ok: false, code: 'QUOTA_EXCEEDED', error: 'límite' } : audited()),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('cuota_agotada');
    expect(out.results.map(r => r.id)).toEqual(['a']);
  });

  it('un error de auditPlace que no es de cuota se saltea y sigue', async () => {
    const calls = { n: 0 };
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places: [place('a'), place('b')], nextPageToken: null }),
      auditPlace: () => (++calls.n === 1 ? { ok: false, error: 'boom' } : audited()),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('ok');
    expect(out.results.map(r => r.id)).toEqual(['b']);
  });

  it('corta al agotar el presupuesto de tiempo', async () => {
    let t = 0;
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: () => { t += 20000; return audited(); },
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, budgetMs: 30000, now: () => t });
    expect(out.results).toHaveLength(2);
  });

  it('si la ciudad no se geocodifica devuelve status error sin buscar', async () => {
    const run = makeRun({ geocode: () => ({ ok: false, error: 'Ciudad no encontrada: Mendoza' }) });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out).toMatchObject({ status: 'error', results: [], examined: 0 });
    expect(out.error).toContain('Ciudad no encontrada');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('si la búsqueda falla en la primera página devuelve status error', async () => {
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: false, error: 'Error de Google Places' }),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('error');
  });

  it('pagina una vez más con nextPageToken y deduplica por id', async () => {
    const pages = [
      { ok: true, places: [place('a'), place('b')], nextPageToken: 'T2' },
      { ok: true, places: [place('b'), place('c')], nextPageToken: 'T3' },
    ];
    let i = 0;
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => pages[i++],
      auditPlace: () => audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, pages: 2 });
    expect(out.results.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npx vitest run src/lib/autoAuditBatch.test.js`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/lib/autoAuditBatch.js`**

```js
import { runLeadFinderAction } from '@/app/api/lead-finder/route';

export const RADIO_M = 15000;

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Audita un lote de negocios de una combinación ciudad × rubro, sin pasar por HTTP ni por el
// navegador. Reutiliza runLeadFinderAction: auditPlace trae caché de 30 días por placeId, así
// que un negocio ya auditado no vuelve a costar una llamada a Google.
export async function runBatch(combo, opts = {}) {
  const {
    budgetMs = 45000, maxSites = 15, maxCandidates = 40, pages = 2,
    run = runLeadFinderAction, now = Date.now, sleep = defaultSleep,
  } = opts;
  const deadline = now() + budgetMs;
  const { ciudad, rubro } = combo;

  // runLeadFinderAction devuelve un Response; se lee su JSON.
  const call = async (action, params) => (await run(action, params)).json();

  const geo = await call('geocode', { city: ciudad, country: 'Argentina' });
  if (!geo.ok) return { results: [], status: 'error', error: geo.error || 'No se pudo geocodificar', examined: 0 };

  const places = [];
  const seen = new Set();
  let pageToken = null;
  for (let page = 0; page < pages; page++) {
    const search = rubro.kind === 'text'
      ? await call('searchText', { lat: geo.lat, lon: geo.lon, query: `${rubro.value}, ${ciudad}`, radiusM: RADIO_M, pageToken })
      : await call('searchNearby', { lat: geo.lat, lon: geo.lon, type: rubro.value, radiusM: RADIO_M, pageToken });
    if (!search.ok) {
      if (!places.length) return { results: [], status: 'error', error: search.error || 'Error de búsqueda', examined: 0 };
      break;
    }
    for (const p of search.places || []) {
      if (!seen.has(p.id)) { seen.add(p.id); places.push(p); }
    }
    pageToken = search.nextPageToken || null;
    if (!pageToken || page === pages - 1) break;
    await sleep(2000); // Google necesita un instante para habilitar el token de la página siguiente
  }

  const results = [];
  let examined = 0;
  let status = 'ok';
  for (const place of places) {
    if (results.length >= maxSites || examined >= maxCandidates || now() >= deadline) break;
    examined++;

    const a = await call('auditPlace', { placeId: place.id });
    if (!a.ok) {
      if (a.code === 'QUOTA_EXCEEDED') { status = 'cuota_agotada'; break; }
      continue;
    }
    if (!a.hasWebsite || typeof a.seoScore !== 'number') continue;

    results.push({
      id:           place.id,
      nombre:       place.displayName?.text || 'Sin nombre',
      ciudad,
      tipo:         rubro.label,
      rubro:        rubro.label,
      aptoSistemaMedida: rubro.prioritario === true,
      lat:          place.location?.latitude ?? null,
      lon:          place.location?.longitude ?? null,
      siteUrl:      a.siteUrl,
      email:        a.email || null,
      seoScore:     a.seoScore,
      hasSitemap:   a.hasSitemap,
      hasRobots:    a.hasRobots,
      metaDesc:     a.metaDesc,
      hasOG:        a.hasOG,
      lastModified: a.lastUpdated || a.lastModified || null,
      rating:       a.rating ?? null,
    });
  }

  return { results, status, examined };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npx vitest run src/lib/autoAuditBatch.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autoAuditBatch.js src/lib/autoAuditBatch.test.js
git commit -m "feat: runBatch audita un lote ciudad x rubro con presupuesto de tiempo"
```

---

### Task 4: Orquestador `runAutoAudit`

**Files:**
- Create: `src/lib/autoAuditRun.js`
- Test: `src/lib/autoAuditRun.test.js`

**Interfaces:**
- Consumes: `pickNext`, `comboKey`, `buildStats`, `buildPost`, `DEFAULT_NETWORKS` (Task 1); `saveAuditoria` (Task 2); `runBatch` (Task 3); `getDb`; datos de `@/data/auditoriaAuto`.
- Produces:
  - `defaultConfig() → config` (con `activo: false`)
  - `loadConfig(db) → Promise<config>` (config completa; si el doc no existe devuelve `defaultConfig()`)
  - `runAutoAudit({ force=false, now=Date.now, budgetMs=45000, maxSites=15, maxCandidates=40 }) → Promise<{ skipped?: 'inactivo'|'en_curso'|'sin_combos', estado?, combo?, auditados?, auditoriaId?, error? }>`
  - Colecciones: `auditoria_auto/config` (campos `activo, ciudades, rubros, networks, imageUrl, ultimaCorrida{}, lock{until}`) y `auditoria_auto_runs/{id}` (`estado: 'ok'|'sin_resultados'|'cuota_agotada'|'post_fallido'|'error', combo{ciudad,rubro}, auditados, auditoriaId, error?, duracionMs, createdAt`).

- [ ] **Step 1: Escribir los tests que fallan**

`src/lib/autoAuditRun.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/autoAuditBatch', () => ({ runBatch: vi.fn() }));
vi.mock('@/lib/auditoriasStore', () => ({ saveAuditoria: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

import { getDb } from '@/lib/firebase-admin';
import { runBatch } from '@/lib/autoAuditBatch';
import { saveAuditoria } from '@/lib/auditoriasStore';
import { runAutoAudit, loadConfig, defaultConfig } from './autoAuditRun.js';
import { comboKey } from './autoAudit.js';

const NOW = Date.UTC(2026, 9, 9);
const RUBRO = { label: 'Ferretería', kind: 'type', value: 'hardware_store', prioritario: true };
const COMBO_KEY = comboKey('Neuquén', RUBRO);
const BASE_CONFIG = {
  activo: true, ciudades: ['Neuquén'], rubros: [RUBRO],
  networks: ['linkedin', 'instagram', 'facebook'], imageUrl: 'https://img/x.jpg', ultimaCorrida: {},
};

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] || {}, v) : v;
  }
  return out;
}

// Firestore falso: doc de config + colección de runs + transacciones.
function createFakeDb(initialConfig) {
  const state = { config: initialConfig, runs: [] };
  const configRef = {
    async get() { return { exists: state.config !== undefined, data: () => state.config }; },
    async set(patch) { state.config = merge(state.config || {}, patch); },
  };
  return {
    state,
    collection: (name) => (name === 'auditoria_auto_runs'
      ? { add: async (doc) => { state.runs.push(doc); return { id: `run-${state.runs.length}` }; } }
      : { doc: () => configRef }),
    runTransaction: async (fn) => fn({ get: (ref) => ref.get(), set: (ref, patch) => ref.set(patch) }),
  };
}

const results = [
  { id: 'a', nombre: 'A', seoScore: 30, email: 'a@a.com' },
  { id: 'b', nombre: 'B', seoScore: 70, email: null },
];

let fetchMock;
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  runBatch.mockResolvedValue({ results, status: 'ok', examined: 2 });
  saveAuditoria.mockResolvedValue({ id: 'aud-1', summary: 'Resumen guardado' });
});
afterEach(() => vi.unstubAllGlobals());

describe('loadConfig / defaultConfig', () => {
  it('sin doc usa la semilla y arranca apagada', async () => {
    const db = createFakeDb(undefined);
    const cfg = await loadConfig(db);
    expect(cfg.activo).toBe(false);
    expect(cfg.ciudades.length).toBeGreaterThan(30);
    expect(cfg.rubros.some(r => r.prioritario)).toBe(true);
    expect(cfg.networks).toEqual(['linkedin', 'instagram', 'facebook']);
    expect(defaultConfig().activo).toBe(false);
  });

  it('un doc que solo tiene el lock sigue usando la semilla para ciudades/rubros', async () => {
    const db = createFakeDb({ lock: { until: 0 } });
    const cfg = await loadConfig(db);
    expect(cfg.activo).toBe(false);
    expect(cfg.ciudades.length).toBeGreaterThan(30);
  });
});

describe('runAutoAudit — guardas', () => {
  it('primera corrida sin config: no audita ni publica (arranca apagada)', async () => {
    const db = createFakeDb(undefined);
    getDb.mockReturnValue(db);
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toEqual({ skipped: 'inactivo' });
    expect(runBatch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('activo:false → skipped inactivo', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, activo: false }));
    expect(await runAutoAudit({ now: () => NOW })).toEqual({ skipped: 'inactivo' });
    expect(runBatch).not.toHaveBeenCalled();
  });

  it('force ignora activo:false', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, activo: false }));
    const out = await runAutoAudit({ force: true, now: () => NOW });
    expect(out.estado).toBe('ok');
    expect(runBatch).toHaveBeenCalled();
  });

  it('candado vigente → skipped en_curso, sin tocar nada', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, lock: { until: NOW + 60000 } }));
    expect(await runAutoAudit({ now: () => NOW })).toEqual({ skipped: 'en_curso' });
    expect(runBatch).not.toHaveBeenCalled();
  });

  it('candado vencido se puede retomar', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, lock: { until: NOW - 1 } }));
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('ok');
  });

  it('sin combinaciones disponibles → skipped sin_combos y libera el candado', async () => {
    const db = createFakeDb({ ...BASE_CONFIG, ultimaCorrida: { [COMBO_KEY]: NOW } });
    getDb.mockReturnValue(db);
    expect(await runAutoAudit({ now: () => NOW })).toEqual({ skipped: 'sin_combos' });
    expect(db.state.config.lock.until).toBe(0);
  });
});

describe('runAutoAudit — flujo', () => {
  it('ok: guarda, publica en Make con agregados, registra el run, marca la combinación y libera el candado', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    const out = await runAutoAudit({ now: () => NOW });

    expect(out).toMatchObject({ estado: 'ok', auditoriaId: 'aud-1', auditados: 2 });
    expect(saveAuditoria).toHaveBeenCalledWith(expect.objectContaining({
      results,
      stats: { total: 2, avgSeoScore: 50, lowSeoCount: 1, withEmail: 1 },
      config: expect.objectContaining({ ciudades: ['Neuquén'], tiposLabels: ['Ferretería'], pais: 'Argentina' }),
    }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe('keyword_report');
    expect(body.networks).toEqual(['linkedin', 'instagram', 'facebook']);
    expect(body.imageUrl).toBe('https://img/x.jpg');
    expect(body.text).toContain('/auditorias/aud-1');
    expect(body.text).not.toContain('"nombre"');

    expect(db.state.runs).toHaveLength(1);
    expect(db.state.runs[0]).toMatchObject({ estado: 'ok', auditoriaId: 'aud-1', combo: { ciudad: 'Neuquén', rubro: 'Ferretería' } });
    expect(db.state.config.ultimaCorrida[COMBO_KEY]).toBe(NOW);
    expect(db.state.config.lock.until).toBe(0);
  });

  it('pasa budgetMs/maxSites/maxCandidates al lote', async () => {
    getDb.mockReturnValue(createFakeDb(BASE_CONFIG));
    await runAutoAudit({ now: () => NOW, budgetMs: 480000, maxSites: 30, maxCandidates: 60 });
    expect(runBatch).toHaveBeenCalledWith(
      expect.objectContaining({ ciudad: 'Neuquén' }),
      { budgetMs: 480000, maxSites: 30, maxCandidates: 60 },
    );
  });

  it('sin resultados: no guarda ni publica, pero marca la combinación', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    runBatch.mockResolvedValue({ results: [], status: 'ok', examined: 5 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('sin_resultados');
    expect(saveAuditoria).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.state.config.ultimaCorrida[COMBO_KEY]).toBe(NOW);
    expect(db.state.config.lock.until).toBe(0);
  });

  it('error de geocodificación: estado error, NO marca la combinación, no publica', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    runBatch.mockResolvedValue({ results: [], status: 'error', error: 'Ciudad no encontrada: Neuquén', examined: 0 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('error');
    expect(out.error).toContain('Ciudad no encontrada');
    expect(db.state.config.ultimaCorrida?.[COMBO_KEY]).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.state.config.lock.until).toBe(0);
  });

  it('cuota agotada con pocos resultados: no guarda, no publica, no marca', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    runBatch.mockResolvedValue({ results: results.slice(0, 1), status: 'cuota_agotada', examined: 2 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('cuota_agotada');
    expect(saveAuditoria).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.state.config.ultimaCorrida?.[COMBO_KEY]).toBeUndefined();
  });

  it('cuota agotada con 5 o más resultados: guarda el informe pero NO publica en redes', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, seoScore: 40, email: null }));
    runBatch.mockResolvedValue({ results: many, status: 'cuota_agotada', examined: 6 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toMatchObject({ estado: 'cuota_agotada', auditoriaId: 'aud-1' });
    expect(saveAuditoria).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.state.config.lock.until).toBe(0);
  });

  it('Make responde no-2xx: el informe queda guardado y el run queda post_fallido', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toMatchObject({ estado: 'post_fallido', auditoriaId: 'aud-1' });
    expect(out.error).toContain('500');
    expect(db.state.config.ultimaCorrida[COMBO_KEY]).toBe(NOW);
    expect(db.state.config.lock.until).toBe(0);
  });

  it('Make lanza excepción: post_fallido y se libera el candado', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    fetchMock.mockRejectedValue(new Error('network down'));
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toMatchObject({ estado: 'post_fallido', auditoriaId: 'aud-1' });
    expect(out.error).toContain('network down');
    expect(db.state.config.lock.until).toBe(0);
  });

  it('excepción inesperada en el lote: estado error y se libera el candado', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    runBatch.mockRejectedValue(new Error('explotó'));
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toMatchObject({ estado: 'error', error: 'explotó' });
    expect(db.state.runs[0].estado).toBe('error');
    expect(db.state.config.lock.until).toBe(0);
  });

  it('lanza si no hay Firestore', async () => {
    getDb.mockReturnValue(null);
    await expect(runAutoAudit({ now: () => NOW })).rejects.toThrow('DB no disponible');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npx vitest run src/lib/autoAuditRun.test.js`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/lib/autoAuditRun.js`**

```js
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { CIUDADES_SEMILLA, RUBROS_SEMILLA, IMAGEN_MARCA } from '@/data/auditoriaAuto';
import { pickNext, comboKey, buildStats, buildPost, DEFAULT_NETWORKS } from '@/lib/autoAudit';
import { runBatch } from '@/lib/autoAuditBatch';
import { saveAuditoria } from '@/lib/auditoriasStore';

const CONFIG_COLLECTION = 'auditoria_auto';
const RUNS_COLLECTION = 'auditoria_auto_runs';
const LOCK_MS = 15 * 60 * 1000;          // un candado huérfano vence solo a los 15 min
const MIN_SITES_TO_SAVE = 5;             // con cuota agotada solo se guarda si hay al menos 5
const MAKE_WEBHOOK_DEFAULT = 'https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi';

export function defaultConfig() {
  return {
    activo: false, // arranca apagada: se activa desde el admin tras probar con "Correr ahora"
    ciudades: [...CIUDADES_SEMILLA],
    rubros: RUBROS_SEMILLA.map(r => ({ ...r })),
    networks: [...DEFAULT_NETWORKS],
    imageUrl: IMAGEN_MARCA,
    ultimaCorrida: {},
  };
}

export async function loadConfig(db) {
  const base = defaultConfig();
  const snap = await db.collection(CONFIG_COLLECTION).doc('config').get();
  if (!snap.exists) return base;
  const d = snap.data() || {};
  return {
    ...base,
    ...d,
    activo: d.activo === true,
    ciudades: d.ciudades?.length ? d.ciudades : base.ciudades,
    rubros: d.rubros?.length ? d.rubros : base.rubros,
    networks: d.networks?.length ? d.networks : base.networks,
    imageUrl: d.imageUrl || base.imageUrl,
    ultimaCorrida: d.ultimaCorrida || {},
  };
}

async function acquireLock(db, nowMs) {
  const ref = db.collection(CONFIG_COLLECTION).doc('config');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const until = snap.exists ? (snap.data().lock?.until || 0) : 0;
    if (until > nowMs) return false;
    tx.set(ref, { lock: { until: nowMs + LOCK_MS } }, { merge: true });
    return true;
  });
}

function fechaLarga(ms) {
  return new Date(ms).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires',
  });
}

// Una corrida de la auditoría automática. La invocan el script de GitHub Actions
// (scripts/auto-audit.mjs) y el botón "Correr ahora" del admin (force: true).
export async function runAutoAudit({
  force = false, now = Date.now, budgetMs = 45000, maxSites = 15, maxCandidates = 40,
} = {}) {
  const db = getDb();
  if (!db) throw new Error('DB no disponible');

  const nowMs = now();
  const config = await loadConfig(db);
  if (!force && config.activo !== true) return { skipped: 'inactivo' };
  if (!(await acquireLock(db, nowMs))) return { skipped: 'en_curso' };

  const configRef = db.collection(CONFIG_COLLECTION).doc('config');
  const run = { estado: 'error', combo: null, auditados: 0, auditoriaId: null };
  let combo = null;
  let markRan = false;
  let skipped = null;

  try {
    combo = pickNext(config, nowMs);
    if (!combo) {
      skipped = 'sin_combos';
    } else {
      run.combo = { ciudad: combo.ciudad, rubro: combo.rubro.label };
      const batch = await runBatch(combo, { budgetMs, maxSites, maxCandidates });
      run.auditados = batch.results.length;

      if (batch.status === 'error') {
        run.estado = 'error';
        run.error = batch.error;
      } else if (batch.status === 'cuota_agotada') {
        run.estado = 'cuota_agotada';
        if (batch.results.length >= MIN_SITES_TO_SAVE) {
          const stats = buildStats(batch.results);
          const saved = await saveAuditoria({
            title: `Auditoría SEO de ${stats.total} sitios de ${combo.rubro.label} en ${combo.ciudad} (${fechaLarga(nowMs)})`,
            config: { ciudades: [combo.ciudad], pais: 'Argentina', radioKm: 15, tiposLabels: [combo.rubro.label] },
            results: batch.results,
            stats,
          });
          run.auditoriaId = saved.id;
        }
      } else if (!batch.results.length) {
        run.estado = 'sin_resultados';
        markRan = true;
      } else {
        const stats = buildStats(batch.results);
        const saved = await saveAuditoria({
          title: `Auditoría SEO de ${stats.total} sitios de ${combo.rubro.label} en ${combo.ciudad} (${fechaLarga(nowMs)})`,
          config: { ciudades: [combo.ciudad], pais: 'Argentina', radioKm: 15, tiposLabels: [combo.rubro.label] },
          results: batch.results,
          stats,
        });
        run.auditoriaId = saved.id;
        markRan = true;

        const { payload } = buildPost({
          combo, stats, auditoriaId: saved.id, summary: saved.summary,
          imageUrl: config.imageUrl, networks: config.networks,
        });
        try {
          const res = await fetch(process.env.MAKE_SOCIAL_WEBHOOK_URL || MAKE_WEBHOOK_DEFAULT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            run.estado = 'ok';
          } else {
            run.estado = 'post_fallido';
            run.error = `Make respondió ${res.status}`;
          }
        } catch (e) {
          run.estado = 'post_fallido';
          run.error = e.message;
        }
      }
    }
  } catch (e) {
    run.estado = 'error';
    run.error = e.message;
  } finally {
    try {
      if (!skipped) {
        await db.collection(RUNS_COLLECTION).add({
          ...run, duracionMs: now() - nowMs, createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      console.error('[auto-audit] no se pudo registrar el run:', e.message);
    }
    const patch = { lock: { until: 0 } };
    if (markRan && combo) patch.ultimaCorrida = { [comboKey(combo.ciudad, combo.rubro)]: nowMs };
    await configRef.set(patch, { merge: true });
  }

  if (skipped) return { skipped };
  return run;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npx vitest run src/lib/autoAuditRun.test.js`
Expected: PASS (todos).

- [ ] **Step 5: Suite completa**

Run: `npx vitest run`
Expected: toda la suite en PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/autoAuditRun.js src/lib/autoAuditRun.test.js
git commit -m "feat: orquestador runAutoAudit con candado, post a Make y registro de runs"
```

---

### Task 5: Rutas de admin

**Files:**
- Create: `src/app/api/cron/auditoria/route.js`
- Create: `src/app/api/auditoria-auto/route.js`
- Test: `src/app/api/cron/auditoria/route.test.js`
- Test: `src/app/api/auditoria-auto/route.test.js`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/adminAuth`), `runAutoAudit`, `loadConfig` (`@/lib/autoAuditRun`), `validateConfigPatch` (`@/lib/autoAudit`), `getDb`.
- Produces:
  - `POST /api/cron/auditoria/` (admin) → `200 { ok: true, ...resultadoDeRunAutoAudit }`
  - `GET /api/auditoria-auto/` (admin) → `{ config: { activo, ciudades, rubros, networks, imageUrl, ultimaCorrida }, runs: [{ id, estado, combo, auditados, auditoriaId, error, duracionMs, createdAt(ISO|null) }] }`
  - `PATCH /api/auditoria-auto/` (admin) → `{ success: true }` o `400 { error }`

- [ ] **Step 1: Tests de `POST /api/cron/auditoria`**

`src/app/api/cron/auditoria/route.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));
vi.mock('@/lib/autoAuditRun', () => ({ runAutoAudit: vi.fn() }));

import { getUserFromRequest } from '@/lib/authServer';
import { runAutoAudit } from '@/lib/autoAuditRun';
import { POST } from './route.js';

const ADMIN = { uid: 'a', email: 'admin@example.com', emailVerified: true };
const OTHER = { uid: 'o', email: 'otro@example.com', emailVerified: true };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = 'admin@example.com';
  getUserFromRequest.mockResolvedValue(ADMIN);
});

describe('POST /api/cron/auditoria', () => {
  it('401 sin token válido, sin ejecutar', async () => {
    getUserFromRequest.mockResolvedValue(null);
    const res = await POST({});
    expect(res.status).toBe(401);
    expect(runAutoAudit).not.toHaveBeenCalled();
  });

  it('403 si no es admin, sin ejecutar', async () => {
    getUserFromRequest.mockResolvedValue(OTHER);
    const res = await POST({});
    expect(res.status).toBe(403);
    expect(runAutoAudit).not.toHaveBeenCalled();
  });

  it('admin: ejecuta con force:true y devuelve el resultado', async () => {
    runAutoAudit.mockResolvedValue({ estado: 'ok', auditoriaId: 'x', auditados: 3 });
    const res = await POST({});
    expect(res.status).toBe(200);
    expect(runAutoAudit).toHaveBeenCalledWith({ force: true });
    expect(await res.json()).toEqual({ ok: true, estado: 'ok', auditoriaId: 'x', auditados: 3 });
  });

  it('500 con el mensaje si runAutoAudit lanza', async () => {
    runAutoAudit.mockRejectedValue(new Error('DB no disponible'));
    const res = await POST({});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('DB no disponible');
  });
});
```

- [ ] **Step 2: Tests de `/api/auditoria-auto`**

`src/app/api/auditoria-auto/route.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));
vi.mock('@/lib/autoAuditRun', () => ({ loadConfig: vi.fn() }));

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { loadConfig } from '@/lib/autoAuditRun';
import { GET, PATCH } from './route.js';

const ADMIN = { uid: 'a', email: 'admin@example.com', emailVerified: true };
const OTHER = { uid: 'o', email: 'otro@example.com', emailVerified: true };
const req = (body) => ({ json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = 'admin@example.com';
  getUserFromRequest.mockResolvedValue(ADMIN);
});

describe('autenticación de /api/auditoria-auto', () => {
  const handlers = [['GET', () => GET(req())], ['PATCH', () => PATCH(req({ activo: true }))]];

  describe.each(handlers)('%s', (_n, call) => {
    it('401 sin token, sin tocar Firestore', async () => {
      getUserFromRequest.mockResolvedValue(null);
      expect((await call()).status).toBe(401);
      expect(getDb).not.toHaveBeenCalled();
    });
    it('403 si no es admin, sin tocar Firestore', async () => {
      getUserFromRequest.mockResolvedValue(OTHER);
      expect((await call()).status).toBe(403);
      expect(getDb).not.toHaveBeenCalled();
    });
  });
});

describe('GET /api/auditoria-auto', () => {
  it('devuelve la config sin el lock y los últimos runs con fecha ISO', async () => {
    loadConfig.mockResolvedValue({
      activo: true, ciudades: ['A'], rubros: [], networks: ['linkedin'], imageUrl: 'https://i', ultimaCorrida: {}, lock: { until: 5 },
    });
    getDb.mockReturnValue({
      collection: () => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => ({
              docs: [{ id: 'r1', data: () => ({ estado: 'ok', auditados: 3, createdAt: { toDate: () => new Date('2026-10-09T12:00:00Z') } }) }],
            }),
          }),
        }),
      }),
    });
    const res = await GET(req());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.config).not.toHaveProperty('lock');
    expect(data.config.activo).toBe(true);
    expect(data.runs[0]).toMatchObject({ id: 'r1', estado: 'ok', createdAt: '2026-10-09T12:00:00.000Z' });
  });
});

describe('PATCH /api/auditoria-auto', () => {
  it('400 si el body es inválido, sin escribir', async () => {
    const set = vi.fn();
    getDb.mockReturnValue({ collection: () => ({ doc: () => ({ set }) }) });
    const res = await PATCH(req({ networks: ['tiktok'] }));
    expect(res.status).toBe(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('guarda con merge cuando es válido', async () => {
    const set = vi.fn();
    getDb.mockReturnValue({ collection: () => ({ doc: () => ({ set }) }) });
    const res = await PATCH(req({ activo: true }));
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith({ activo: true }, { merge: true });
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que fallan**

Run: `npx vitest run src/app/api/cron/auditoria src/app/api/auditoria-auto`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Implementar `src/app/api/cron/auditoria/route.js`**

```js
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby: tope seguro. La corrida manual usa el presupuesto corto (45 s).

import { requireAdmin } from '@/lib/adminAuth';
import { runAutoAudit } from '@/lib/autoAuditRun';

// "Correr ahora" del admin. La ejecución programada NO pasa por acá: corre en GitHub Actions
// (scripts/auto-audit.mjs). force:true ignora el interruptor `activo`.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const result = await runAutoAudit({ force: true });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Implementar `src/app/api/auditoria-auto/route.js`**

```js
export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { loadConfig } from '@/lib/autoAuditRun';
import { validateConfigPatch } from '@/lib/autoAudit';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { lock: _lock, ...config } = await loadConfig(db);
    const snap = await db.collection('auditoria_auto_runs').orderBy('createdAt', 'desc').limit(10).get();
    const runs = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
    });
    return Response.json({ config, runs });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { update, error } = validateConfigPatch(body);
    if (error) return Response.json({ error }, { status: 400 });

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    await db.collection('auditoria_auto').doc('config').set(update, { merge: true });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 6: Ejecutar y verificar que pasan**

Run: `npx vitest run src/app/api/cron/auditoria src/app/api/auditoria-auto`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/auditoria src/app/api/auditoria-auto
git commit -m "feat: rutas admin para correr y configurar la auditoria automatica"
```

---

### Task 6: Script y workflow de GitHub Actions

**Files:**
- Create: `scripts/auto-audit.mjs`
- Create: `.github/workflows/auditoria-auto.yml`
- Modify: `package.json` (devDependency `tsx`) y `package-lock.json`

**Interfaces:**
- Consumes: `runAutoAudit` de `src/lib/autoAuditRun.js`. Variables de entorno: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY_1..3`, `GEMINI_API_KEY`, opcional `MAKE_SOCIAL_WEBHOOK_URL`.
- Produces: workflow `Auditoría automática` con `workflow_dispatch` (lo dispara cron-job.org).

Nota técnica verificada: un `.mjs` suelto NO puede hacer `import { x } from '@/...'` estático (los módulos de `src/` se interpretan como CommonJS). Con `tsx --tsconfig jsconfig.json` y **`import()` dinámico** sí resuelve los alias y expone las exportaciones en el namespace o en `.default`.

- [ ] **Step 1: Instalar tsx**

Run: `npm install --save-dev tsx`
Expected: `package.json` suma `tsx` en `devDependencies`; `package-lock.json` se actualiza.

- [ ] **Step 2: Crear `scripts/auto-audit.mjs`**

```js
// Auditoría SEO automática — corre en GitHub Actions, no en Vercel (Hobby corta a los 60 s).
// Se ejecuta con: npx tsx --tsconfig jsconfig.json scripts/auto-audit.mjs
// Importa con import() dinámico: un .mjs suelto no puede importar de src/ con imports estáticos
// (esos archivos se interpretan como CommonJS y no exponen las exportaciones con nombre).
const mod = await import('../src/lib/autoAuditRun.js');
const runAutoAudit = mod.runAutoAudit || mod.default?.runAutoAudit;
if (typeof runAutoAudit !== 'function') {
  console.error('[auto-audit] no se pudo cargar runAutoAudit');
  process.exit(1);
}

try {
  const result = await runAutoAudit({
    budgetMs: 8 * 60 * 1000, // sin el tope de 60 s de Vercel; el job tiene timeout de 20 min
    maxSites: 30,
    maxCandidates: 60,       // cuida el tope diario de 100 getDetails de Google
  });
  console.log('[auto-audit]', JSON.stringify(result));
  // Falla el job solo en errores reales; "skipped" y "sin_resultados" son normales.
  if (result.estado === 'error' || result.estado === 'post_fallido') process.exit(1);
  process.exit(0);
} catch (e) {
  console.error('[auto-audit] error:', e.message);
  process.exit(1);
}
```

- [ ] **Step 3: Crear `.github/workflows/auditoria-auto.yml`**

```yaml
name: Auditoría automática

on:
  # Sin trigger `schedule`: el cron nativo de GitHub Actions demostró ser poco confiable en
  # este repo (ver noticias-bot.yml). El scheduling real lo hace cron-job.org pegándole a la
  # API de despacho de este workflow (POST .../dispatches) martes y viernes a las 09:00 ART.
  workflow_dispatch: {}

concurrency:
  group: auditoria-auto
  cancel-in-progress: false

jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx tsx --tsconfig jsconfig.json scripts/auto-audit.mjs
        env:
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_CLIENT_EMAIL: ${{ secrets.FIREBASE_CLIENT_EMAIL }}
          FIREBASE_PRIVATE_KEY: ${{ secrets.FIREBASE_PRIVATE_KEY }}
          GOOGLE_PLACES_API_KEY: ${{ secrets.GOOGLE_PLACES_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GEMINI_API_KEY_1: ${{ secrets.GEMINI_API_KEY_1 }}
          GEMINI_API_KEY_2: ${{ secrets.GEMINI_API_KEY_2 }}
          GEMINI_API_KEY_3: ${{ secrets.GEMINI_API_KEY_3 }}
          MAKE_SOCIAL_WEBHOOK_URL: ${{ secrets.MAKE_WEBHOOK_URL }}
```

- [ ] **Step 4: Verificar sintaxis sin ejecutar nada contra servicios reales**

Run: `node --check scripts/auto-audit.mjs`
Expected: sin salida (OK).

Run: `npx tsx --tsconfig jsconfig.json -e "const m = await import('./src/lib/autoAuditRun.js'); console.log(typeof (m.runAutoAudit || m.default?.runAutoAudit))"`
Expected: `function` (puede imprimir antes `[firebase-admin] init failed...` si faltan variables; es esperado y no afecta).

NO ejecutar `scripts/auto-audit.mjs` completo en local con credenciales reales: lanzaría una auditoría real (gasta cuota de Google) y, si `activo` está en true, publicaría en redes.

- [ ] **Step 5: Commit**

```bash
git add scripts/auto-audit.mjs .github/workflows/auditoria-auto.yml package.json package-lock.json
git commit -m "feat: ejecucion de la auditoria automatica en GitHub Actions"
```

---

### Task 7: Tarjeta del admin

**Files:**
- Create: `src/components/admin/AutoAuditCard.jsx`
- Modify: `src/data/adminNav.js` (grupo `marketing`)
- Modify: `src/views/AdminPage.jsx` (import + bloque de pestaña)

**Interfaces:**
- Consumes: `GET/PATCH /api/auditoria-auto/`, `POST /api/cron/auditoria/` (Task 5); `useAuthUser` de `@/hooks/useAuthUser` (`{ user, loading, getIdToken, login }`).
- Produces: pestaña admin `auto-auditoria`.

- [ ] **Step 1: Crear `src/components/admin/AutoAuditCard.jsx`**

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

const ESTADO_STYLE = {
  ok: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  sin_resultados: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  cuota_agotada: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  post_fallido: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const NETWORK_LABELS = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook' };

export default function AutoAuditCard() {
  const { user, loading: authLoading, getIdToken, login } = useAuthUser();
  const [config, setConfig] = useState(null);
  const [runs, setRuns] = useState([]);
  const [ciudadesText, setCiudadesText] = useState('');
  const [rubros, setRubros] = useState([]);
  const [newRubro, setNewRubro] = useState({ label: '', kind: 'text', value: '', prioritario: true });
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const authFetch = useCallback(async (url, options = {}) => {
    const token = await getIdToken();
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getIdToken]);

  const load = useCallback(async () => {
    setErrorMsg('');
    try {
      const res = await authFetch('/api/auditoria-auto/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar');
      setConfig(data.config);
      setRuns(data.runs || []);
      setCiudadesText((data.config.ciudades || []).join('\n'));
      setRubros(data.config.rubros || []);
      setImageUrl(data.config.imageUrl || '');
    } catch (e) {
      setErrorMsg(e.message);
    }
  }, [authFetch]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const patch = async (body, okMsg) => {
    setBusy(true); setMsg(''); setErrorMsg('');
    try {
      const res = await authFetch('/api/auditoria-auto/', { method: 'PATCH', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      setMsg(okMsg);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    if (!window.confirm('Esto audita y PUBLICA en redes de verdad. ¿Correr ahora?')) return;
    setRunning(true); setMsg(''); setErrorMsg('');
    try {
      const res = await authFetch('/api/cron/auditoria/', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falló la corrida');
      setMsg(`Corrida: ${data.estado || data.skipped} (${data.auditados ?? 0} sitios)`);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setRunning(false);
    }
  };

  const toggleNetwork = (n) => {
    const current = config.networks || [];
    const next = current.includes(n) ? current.filter(x => x !== n) : [...current, n];
    if (!next.length) return;
    patch({ networks: next }, 'Redes actualizadas');
  };

  const addRubro = () => {
    if (!newRubro.label.trim() || !newRubro.value.trim()) return;
    const next = [...rubros, { ...newRubro, label: newRubro.label.trim(), value: newRubro.value.trim() }];
    setNewRubro({ label: '', kind: 'text', value: '', prioritario: true });
    patch({ rubros: next }, 'Rubro agregado');
  };

  if (authLoading) return <p className="text-sm text-gray-500">Cargando…</p>;
  if (!user) {
    return (
      <button onClick={login} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">
        Iniciar sesión como admin
      </button>
    );
  }

  const input = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100';
  const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Auditoría automática</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Audita un rubro en una ciudad, publica el informe y lo anuncia en redes. Se dispara martes y viernes por GitHub Actions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => patch({ activo: !config?.activo }, config?.activo ? 'Automatización apagada' : 'Automatización encendida')}
              disabled={busy || !config}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${config?.activo ? 'bg-green-600' : 'bg-gray-500'}`}
            >
              {config?.activo ? 'Encendida' : 'Apagada'}
            </button>
            <button onClick={runNow} disabled={running || !config}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white disabled:opacity-50">
              {running ? 'Corriendo…' : 'Correr ahora'}
            </button>
          </div>
        </div>
        {msg && <p className="mt-3 text-sm text-green-700 dark:text-green-400" role="status">{msg}</p>}
        {errorMsg && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{errorMsg}</p>}
      </div>

      {config && (
        <>
          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Redes e imagen</h3>
            <div className="flex flex-wrap gap-4 mb-4">
              {Object.entries(NETWORK_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={(config.networks || []).includes(key)} onChange={() => toggleNetwork(key)} disabled={busy} />
                  {label}
                </label>
              ))}
            </div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1" htmlFor="aa-image">Imagen del post (https, 1080×1080)</label>
            <div className="flex gap-2">
              <input id="aa-image" className={input} value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
              <button onClick={() => patch({ imageUrl }, 'Imagen guardada')} disabled={busy}
                className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm dark:bg-gray-600 disabled:opacity-50">Guardar</button>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Ciudades ({(config.ciudades || []).length})</h3>
            <label className="sr-only" htmlFor="aa-ciudades">Ciudades, una por línea</label>
            <textarea id="aa-ciudades" rows={8} className={input} value={ciudadesText} onChange={e => setCiudadesText(e.target.value)} />
            <button
              onClick={() => patch({ ciudades: ciudadesText.split('\n') }, 'Ciudades guardadas')}
              disabled={busy}
              className="mt-2 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm dark:bg-gray-600 disabled:opacity-50">
              Guardar ciudades
            </button>
          </div>

          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Rubros ({rubros.length})</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Prioritarios (⭐): negocios con etapas constructivas o de fabricación. Salen ~80% de las corridas.
            </p>
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 mb-4">
              {rubros.map((r, i) => (
                <li key={`${r.label}-${i}`} className="flex items-center justify-between py-1.5 text-sm text-gray-800 dark:text-gray-200">
                  <span>{r.prioritario ? '⭐ ' : ''}{r.label} <span className="text-xs text-gray-400">({r.kind === 'type' ? 'tipo Places' : 'texto'})</span></span>
                  <span className="flex gap-2">
                    <button disabled={busy} className="text-xs underline"
                      onClick={() => patch({ rubros: rubros.map((x, j) => j === i ? { ...x, prioritario: !x.prioritario } : x) }, 'Rubro actualizado')}>
                      {r.prioritario ? 'Quitar ⭐' : 'Dar ⭐'}
                    </button>
                    <button disabled={busy || rubros.length <= 1} className="text-xs text-red-600 underline"
                      onClick={() => patch({ rubros: rubros.filter((_, j) => j !== i) }, 'Rubro eliminado')}>
                      Eliminar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input className={input} placeholder="Nombre (ej. Steel framing)" aria-label="Nombre del rubro"
                value={newRubro.label} onChange={e => setNewRubro({ ...newRubro, label: e.target.value })} />
              <input className={input} placeholder="Búsqueda o tipo (ej. steel framing)" aria-label="Término de búsqueda o tipo de Places"
                value={newRubro.value} onChange={e => setNewRubro({ ...newRubro, value: e.target.value })} />
              <select className={input} aria-label="Tipo de búsqueda" value={newRubro.kind}
                onChange={e => setNewRubro({ ...newRubro, kind: e.target.value })}>
                <option value="text">texto</option>
                <option value="type">tipo Places</option>
              </select>
              <button onClick={addRubro} disabled={busy}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">Agregar</button>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Últimas corridas</h3>
            {runs.length === 0 && <p className="text-sm text-gray-500">Todavía no hay corridas.</p>}
            <ul className="space-y-2">
              {runs.map(r => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_STYLE[r.estado] || ESTADO_STYLE.error}`}>{r.estado}</span>
                  <span>{r.combo ? `${r.combo.rubro} · ${r.combo.ciudad}` : '—'}</span>
                  <span className="text-gray-500">{r.auditados ?? 0} sitios</span>
                  {r.createdAt && <span className="text-gray-400 text-xs">{new Date(r.createdAt).toLocaleString('es-AR')}</span>}
                  {r.auditoriaId && <a className="text-indigo-600 underline text-xs" href={`/auditorias/${r.auditoriaId}`} target="_blank" rel="noreferrer">ver informe</a>}
                  {r.error && <span className="text-xs text-red-600 dark:text-red-400">{r.error}</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Agregar el ítem de navegación**

En `src/data/adminNav.js`, dentro del grupo `marketing`, después de la línea `{ id: 'auditorias-todas', ... }`, agregar:

```js
    { id: 'auto-auditoria', label: 'Auditoría automática', icon: '🤖' },
```

- [ ] **Step 3: Conectar la pestaña en `AdminPage.jsx`**

1. Debajo de `import AuditoriasUnificado from '../components/admin/AuditoriasUnificado';` (línea 19) agregar:

```js
import AutoAuditCard from '../components/admin/AutoAuditCard';
```

2. Debajo del bloque `{activeTab === 'auditorias-todas' && ( ... )}` (después de línea 881) agregar:

```jsx
        {activeTab === 'auto-auditoria' && (
          <div>
            <AutoAuditCard />
          </div>
        )}
```

- [ ] **Step 4: Lint y build**

Run: `npx eslint src/components/admin/AutoAuditCard.jsx src/views/AdminPage.jsx src/data/adminNav.js`
Expected: sin errores nuevos (los warnings preexistentes de `AdminPage.jsx` no cuentan).

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Verificación manual en el navegador**

Run: `npm run dev`, entrar a `/admin` con la cuenta admin y abrir Marketing → "Auditoría automática".
Expected: se ve la tarjeta "Apagada", redes marcadas (LinkedIn, Instagram, Facebook), ~41 ciudades, lista de rubros con ⭐ y "Últimas corridas" vacía. Cambiar un campo y recargar confirma que persiste.
Si el ítem no aparece en el menú: el admin guarda su navegación en Firestore (`nav_config/admin`); agregarlo desde Sitio → "Configurar Interfaz".

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AutoAuditCard.jsx src/data/adminNav.js src/views/AdminPage.jsx
git commit -m "feat: tarjeta admin para configurar y probar la auditoria automatica"
```

---

### Task 8: Documentación y puesta en marcha

**Files:**
- Modify: `CLAUDE.md` (secciones "Funcionalidades activas", "Colecciones Firestore")

- [ ] **Step 1: Documentar en `CLAUDE.md`**

En "Funcionalidades activas", después del bloque **Auditorias** agregar:

```md
- **Auditoría automática** (admin → Marketing → Auditoría automática):
  - Audita sola un rubro × ciudad (martes y viernes 09:00 ART), guarda el informe en `auditorias`
    y lo anuncia en LinkedIn/Instagram/Facebook vía Make.com (`type: 'keyword_report'`, con `imageUrl`).
  - Corre en **GitHub Actions** (`.github/workflows/auditoria-auto.yml`, `scripts/auto-audit.mjs`,
    ejecutado con `tsx --tsconfig jsconfig.json`), disparado por cron-job.org vía
    `workflow_dispatch` (igual que el bot de noticias). NO usa el cron de Vercel (plan Hobby: 60 s).
  - El post usa solo datos agregados (sin nombres de negocios). Arranca **apagada**: activar desde
    la tarjeta tras probar "Correr ahora".
  - Rubros prioritarios = negocios con etapas constructivas o de fabricación (candidatos al
    punto 3: oferta de sistema a medida). Cada resultado guarda `rubro` y `aptoSistemaMedida`.
  - Secrets de GitHub necesarios: `FIREBASE_*`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`,
    `GEMINI_API_KEY_1..3`, `MAKE_WEBHOOK_URL`.
```

En la tabla de "Colecciones Firestore" agregar dos filas:

```md
| `auditoria_auto` | Config de la auditoría automática (`config`: activo, ciudades, rubros, puntero, candado) | Admin SDK (server) / admin tab |
| `auditoria_auto_runs` | Historial de corridas de la auditoría automática | Admin SDK (server) |
```

- [ ] **Step 2: Suite completa y lint**

Run: `npx vitest run && npx eslint src/lib src/app/api/cron src/app/api/auditoria-auto scripts/auto-audit.mjs`
Expected: todo en PASS / sin errores.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: auditoria automatica en CLAUDE.md"
```

- [ ] **Step 4: Checklist de puesta en marcha (lo hace Mariano; ningún paso se automatiza sin su OK)**

1. Subir el código (`git push`) y esperar el deploy de Vercel.
2. GitHub → Settings → Secrets: agregar los que falten (`GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`; `FIREBASE_*`, `GEMINI_API_KEY` y `MAKE_WEBHOOK_URL` ya existen por el bot de noticias).
3. Abrir `imageUrl` por defecto en el navegador: debe mostrar una imagen cuadrada. Si da error (Cloudinary puede bloquear `fetch` de dominios no permitidos), subir `public/logo-ma.png` a Cloudinary como 1080×1080 JPG y pegar esa URL en la tarjeta.
4. En el admin, **con la automatización apagada**, tocar "Correr ahora": publica un post real. Verificar en LinkedIn, Instagram y Facebook que salió con imagen y sin nombres de negocios, y que `/auditorias/[id]` abre bien. Si Instagram no recibe la imagen, revisar el router de Make para `type: keyword_report`.
5. Tocar "Encendida" en la tarjeta.
6. En cron-job.org crear el job que hace `POST https://api.github.com/repos/maliandri/marianoaliandri-portfolio-next/actions/workflows/auditoria-auto.yml/dispatches` con body `{"ref":"main"}`, mismo token y headers que el del bot de noticias, martes y viernes 12:00 UTC (09:00 ART).
7. Lanzar el workflow una vez a mano (Actions → "Auditoría automática" → Run workflow) y confirmar en "Últimas corridas" que registró un run.
