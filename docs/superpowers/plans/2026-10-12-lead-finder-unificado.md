# Lead Finder unificado — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un solo motor de búsqueda de leads y una sola pantalla para Lead Finder Pro (clientes), el admin y la auditoría automática, con la regla "web → auditar; sin web → solo si tiene WhatsApp" y cobro solo por lead entregado.

**Architecture:** La regla de lead (`src/lib/leadRule.js`) y el motor (`src/lib/leadSearch.js`, generador asíncrono sin React ni HTTP) son JS puro compartido. Las pantallas corren el motor en el navegador contra `/api/lead-finder-pro/run` (que decide el cobro en el servidor); la automática lo corre en GitHub Actions contra `runLeadFinderAction` directo. Un componente `LeadFinder` con `variant="cliente" | "admin"` reemplaza a los dos paneles actuales.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4 (tokens `bg-card`, `text-fg`, `border-fg/10`), Firebase Admin/Firestore, Vitest (entorno node, sin testing-library).

**Spec:** `docs/superpowers/specs/2026-10-12-lead-finder-unificado-design.md`

## Global Constraints

- Rama: `feat/lead-finder-unificado`. Un commit por task. Mensajes en español, estilo `feat: ...` / `fix: ...` / `docs: ...`, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `npm test` (= `vitest run`), archivos `*.test.js` junto al código. Después de cada task, `npm test` completo en verde.
- Cobro: 1 crédito **solo por lead**; descartado = 0 créditos. Tope de descartes gratis: **100 por día UTC por usuario**; usuarios `unlimited` sin tope.
- Regla de lead: web propia → lead `canal: 'web'`; sin web + celular AR (`+54 9` internacional, o `0<área> 15-...` nacional) → lead `canal: 'whatsapp'`; sin web + país ≠ AR + cualquier teléfono (formato internacional) → lead `canal: 'whatsapp'`; si no → descartado. Red social sola no alcanza.
- Motor: hasta **3 páginas** por búsqueda, **1500 ms** entre páginas; `cantidad` = leads; `maxExaminados` por defecto `3 × cantidad`.
- Automática: `cantidad` en `auditoria_auto/config`, default **15**, rango **3–30**, `maxExaminados = 2 × cantidad`; "Correr ahora" usa `min(cantidad, 8)`; mínimo para publicar 3 (`MIN_SITES_TO_PUBLISH`, ya existe).
- Cupo gratis de detalles de Places: 1.000/mes (`PLACES_LIMITS.details.free` en `src/data/placesFreeTier.js`); corridas por mes de la automática: `4 × 4,3`.
- UI: usar tokens de tema (`bg-page`, `bg-card`, `text-fg`, `text-fg-500`, `border-fg/10`, `bg-fg/5`), nunca `bg-[#111]`/`text-white` fijos. Las páginas de Lead Finder Pro son siempre oscuras: el componente recibe `forceDark` y envuelve todo en `<div className="dark">` (la variante `dark` es `&:where(.dark, .dark *)`).
- Webhooks/URLs: no se agregan rutas nuevas; no tocar `trailingSlash`.
- Firestore: solo se **agregan** campos; nada se borra ni se renombra.

## Review Focus

1. **Entradas viejas de caché/historial sin `internationalPhone` ni `esLead`** (hasta 30 días): la regla usa el formato nacional argentino; un teléfono no argentino sin formato internacional se descarta. Lo cubren tests en Task 1 (`'(305) 555-1234'` sin internacional → descartado) y Task 6 (el motor clasifica si el server no manda `esLead`).
2. **Dos pestañas gastando el último crédito a la vez**: la verificación previa pasa en ambas pero el descuento es transaccional; la segunda recibe 402 y no se entrega el lead. Test en Task 3.
3. **Un sitio con web cuya auditoría SEO falló (`seoScore: null`)**: es lead, pero no entra al informe publicado. Test de `filasParaInforme` en Task 5.
4. **Localidad sin coma ("Neuquén")**: `parseZona` devuelve `pais: ''` y la búsqueda sigue. Test en Task 5.
5. **Cancelar en medio de una auditoría**: el negocio en curso termina; no se audita ninguno más. Test en Task 5.

---

## Archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/leadRule.js` (+ test) | Crear | `clasificarLead(audit)` → `{ esLead, canal, whatsapp }` |
| `src/app/api/lead-finder/route.js` (+ test nuevo) | Modificar | `auditPlace` devuelve `internationalPhone` y `socialUrl` |
| `src/app/api/lead-finder-pro/run/route.js` (+ test) | Modificar | Cobro por lead + tope de descartes + historial con clasificación |
| `src/app/api/lead-finder-pro/searches/route.js` (+ test nuevo) | Modificar | Guarda `origen`, `perfil`, `stats` |
| `src/lib/leadSearch.js` (+ test) | Crear | Motor `searchLeads`, `parseZona`, `leadToAuditRow`, `filasParaInforme`, `isFatal` |
| `src/lib/autoAuditBatch.js` (+ test) | Reescribir | Lote de la automática sobre el motor |
| `src/lib/autoAudit.js` (+ test) | Modificar | `cantidad` en `validateConfigPatch`, constantes y `consumoMensual` |
| `src/lib/autoAuditRun.js` (+ test) | Modificar | `cantidad` desde config, `fast` |
| `src/app/api/cron/auditoria/route.js`, `scripts/auto-audit.mjs` | Modificar | Llamar con `fast` / sin topes fijos |
| `src/components/admin/AutoAuditCard.jsx` | Modificar | Campo cantidad + consumo estimado + días reales |
| `src/data/rubros.js` (+ test nuevo) | Modificar | `RUBRO_LABEL_EN`, `CATEGORIA_EN`, `rubroLabel`, `query` en `general_contractor` |
| `src/data/i18n/leadFinderPro.js` | Modificar | Claves nuevas del buscador (ES/EN); textos de cobro en Task 12 |
| `src/components/leadfinder/useLeadSearch.js` | Crear | Hook que corre el motor y guarda el estado |
| `src/components/leadfinder/LeadFinderForm.jsx` | Crear | Formulario |
| `src/components/leadfinder/LeadResultsTable.jsx` | Crear | Tabla + `exportLeadsCSV` |
| `src/components/leadfinder/LeadSearchHistory.jsx` | Crear | Búsquedas anteriores |
| `src/components/leadfinder/admin/LeadFinderAdminExtras.jsx` | Crear | Filtros, log, publicar informe |
| `src/components/leadfinder/LeadFinder.jsx` | Crear | Compone todo, `variant`, `lang`, `forceDark` |
| `src/app/lead-finder-pro/buscar/page.jsx`, `src/app/en/lead-finder-pro/buscar/page.jsx` | Modificar | Usar `LeadFinder` |
| `src/views/AdminPage.jsx` | Modificar | Usar `LeadFinder variant="admin"` |
| `src/app/lead-finder-pro/page.jsx`, `src/views/LeadFinderProTermsPage*.jsx` | Modificar | Textos de cobro |
| `src/components/leadfinderpro/CustomerLeadFinderPanel.jsx`, `src/components/audit/LeadFinderPanel.jsx` | Borrar | Reemplazados |
| `CLAUDE.md` | Modificar | Documentar |

---

### Task 0: Commitear el arreglo de Formosa

Ya está hecho y testeado en el working tree (mínimo 3 sitios + reintento con otra combinación + `intentos` en la tarjeta).

**Files:** `src/lib/autoAuditRun.js`, `src/lib/autoAuditRun.test.js`, `src/lib/autoAuditBatch.js`, `src/components/admin/AutoAuditCard.jsx`, `CLAUDE.md`

- [ ] **Step 1: Verificar**

Run: `npm test`
Expected: PASS (332 tests o más).

- [ ] **Step 2: Commit**

```bash
git add src/lib/autoAuditRun.js src/lib/autoAuditRun.test.js src/lib/autoAuditBatch.js src/components/admin/AutoAuditCard.jsx CLAUDE.md
git commit -m "fix: la auditoria automatica no publica informes de menos de 3 sitios y prueba otra combinacion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Regla de lead

**Files:**
- Create: `src/lib/leadRule.js`
- Test: `src/lib/leadRule.test.js`

**Interfaces:**
- Produces: `clasificarLead(audit) → { esLead: boolean, canal: 'web' | 'whatsapp' | null, whatsapp: string | null }`. `audit` usa los campos de `auditPlace`: `hasWebsite`, `siteUrl`, `phone` (nacional), `internationalPhone`. `whatsapp` = solo dígitos con código de país, listo para `https://wa.me/<whatsapp>`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/leadRule.test.js
import { describe, it, expect } from 'vitest';
import { clasificarLead } from './leadRule.js';

describe('clasificarLead', () => {
  it('con web propia es lead por web (y guarda el WhatsApp si hay celular)', () => {
    expect(clasificarLead({ hasWebsite: true, siteUrl: 'https://x.test', internationalPhone: '+54 9 299 541-4422' }))
      .toEqual({ esLead: true, canal: 'web', whatsapp: '5492995414422' });
    expect(clasificarLead({ hasWebsite: true, siteUrl: 'https://x.test' }))
      .toEqual({ esLead: true, canal: 'web', whatsapp: null });
  });

  it('sin web con celular argentino (+54 9) es lead por WhatsApp', () => {
    expect(clasificarLead({ hasWebsite: false, siteUrl: null, internationalPhone: '+54 9 299 541-4422', phone: '0299 15-541-4422' }))
      .toEqual({ esLead: true, canal: 'whatsapp', whatsapp: '5492995414422' });
  });

  it('sin web con fijo argentino se descarta', () => {
    expect(clasificarLead({ hasWebsite: false, internationalPhone: '+54 299 442-1234', phone: '0299 442-1234' }))
      .toEqual({ esLead: false, canal: null, whatsapp: null });
  });

  it('caché viejo sin internacional: usa el 15 del formato nacional', () => {
    expect(clasificarLead({ hasWebsite: false, phone: '0299 15-541-4422' }))
      .toEqual({ esLead: true, canal: 'whatsapp', whatsapp: '5492995414422' });
    expect(clasificarLead({ hasWebsite: false, phone: '011 15 4444-5555' }).whatsapp).toBe('5491144445555');
    expect(clasificarLead({ hasWebsite: false, phone: '0299 442-1234' }).esLead).toBe(false);
  });

  it('otro país con formato internacional: cualquier teléfono sirve', () => {
    expect(clasificarLead({ hasWebsite: false, internationalPhone: '+1 305-555-1234' }))
      .toEqual({ esLead: true, canal: 'whatsapp', whatsapp: '13055551234' });
  });

  it('otro país sin formato internacional (caché viejo) se descarta', () => {
    expect(clasificarLead({ hasWebsite: false, phone: '(305) 555-1234' }).esLead).toBe(false);
  });

  it('solo red social, o nada, se descarta', () => {
    expect(clasificarLead({ hasWebsite: false, siteUrl: null, socialUrl: 'https://instagram.com/x' }).esLead).toBe(false);
    expect(clasificarLead({}).esLead).toBe(false);
    expect(clasificarLead(null).esLead).toBe(false);
  });

  it('hasWebsite true pero sin siteUrl no cuenta como web', () => {
    expect(clasificarLead({ hasWebsite: true, siteUrl: null }).esLead).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/leadRule.test.js`
Expected: FAIL — `Failed to resolve import "./leadRule.js"`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/leadRule.js
// Regla de lead compartida por el servidor (decide el cobro en /api/lead-finder-pro/run) y por
// el motor de búsqueda (src/lib/leadSearch.js). Ver
// docs/superpowers/specs/2026-10-12-lead-finder-unificado-design.md
//
// tiene web propia → lead por web · sin web → lead solo si tiene WhatsApp · si no → descartado.
// Google Places no devuelve emails (salen de leer el sitio), así que sin web el único canal es
// el teléfono. No hay forma gratis de saber si un número tiene WhatsApp: se deduce del formato.

const digitos = (s) => String(s || '').replace(/\D/g, '');

// Formato internacional de Google: "+54 9 299 541-4422". En Argentina el 9 marca celular; en
// otros países el formato no distingue celular de fijo, así que cualquier número sirve.
function whatsappDesdeInternacional(intl) {
  const d = digitos(intl);
  if (d.length < 8) return null;
  if (d.startsWith('54')) return d.startsWith('549') ? d : null;
  return d;
}

// Entradas viejas del caché (sin internacional): formato nacional argentino "0299 15-541-4422".
function whatsappDesdeNacionalAR(nacional) {
  const m = String(nacional || '').trim().match(/^0(\d{2,4})[\s-]*15[\s-]*([\d\s-]{6,})$/);
  return m ? `549${m[1]}${digitos(m[2])}` : null;
}

function whatsappDe(audit) {
  if (audit?.internationalPhone) return whatsappDesdeInternacional(audit.internationalPhone);
  return whatsappDesdeNacionalAR(audit?.phone);
}

export function clasificarLead(audit) {
  const whatsapp = whatsappDe(audit);
  if (audit?.hasWebsite && audit?.siteUrl) return { esLead: true, canal: 'web', whatsapp };
  if (whatsapp) return { esLead: true, canal: 'whatsapp', whatsapp };
  return { esLead: false, canal: null, whatsapp: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/leadRule.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadRule.js src/lib/leadRule.test.js
git commit -m "feat: regla de lead compartida (web, o WhatsApp si no hay web)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `auditPlace` devuelve teléfono internacional y red social

**Files:**
- Modify: `src/app/api/lead-finder/route.js:55` (`DETAIL_FIELDS`) y el bloque `case 'auditPlace'` (~línea 330)
- Test: `src/app/api/lead-finder/route.test.js` (nuevo)

**Interfaces:**
- Produces: la respuesta de `auditPlace` suma `internationalPhone: string | null` y `socialUrl: string | null` (y los cachea en `places_seo_cache`).

- [ ] **Step 1: Write the failing test**

```js
// src/app/api/lead-finder/route.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: () => null })); // sin caché ni contador
vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));

import { runLeadFinderAction } from './route.js';

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const detalle = (over) => ({ json: async () => ({ id: 'p1', ...over }) });

describe('auditPlace', () => {
  it('pide internationalPhoneNumber y lo devuelve', async () => {
    fetchMock.mockResolvedValueOnce(detalle({ internationalPhoneNumber: '+54 9 299 541-4422', nationalPhoneNumber: '0299 15-541-4422' }));
    const data = await (await runLeadFinderAction('auditPlace', { placeId: 'p1' }, 'k')).json();
    expect(fetchMock.mock.calls[0][1].headers['X-Goog-FieldMask']).toContain('internationalPhoneNumber');
    expect(data).toMatchObject({ ok: true, hasWebsite: false, internationalPhone: '+54 9 299 541-4422', phone: '0299 15-541-4422', socialUrl: null });
  });

  it('una red social cargada como web no cuenta como sitio, pero se guarda como socialUrl', async () => {
    fetchMock.mockResolvedValueOnce(detalle({ websiteUri: 'https://www.instagram.com/negocio' }));
    const data = await (await runLeadFinderAction('auditPlace', { placeId: 'p1' }, 'k')).json();
    expect(data).toMatchObject({ hasWebsite: false, siteUrl: null, socialUrl: 'https://www.instagram.com/negocio', internationalPhone: null });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no intenta auditar el sitio
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/lead-finder/route.test.js`
Expected: FAIL — el FieldMask no contiene `internationalPhoneNumber` / `internationalPhone` es `undefined`.

- [ ] **Step 3: Implement**

En `src/app/api/lead-finder/route.js` reemplazar la línea de `DETAIL_FIELDS`:

```js
// internationalPhoneNumber está en el mismo SKU de contacto que nationalPhoneNumber (sin costo
// extra): con él se distingue un celular argentino (+54 9 …) para la regla de lead (leadRule.js).
const DETAIL_FIELDS  = 'id,websiteUri,nationalPhoneNumber,internationalPhoneNumber,regularOpeningHours,rating,userRatingCount';
```

En `case 'auditPlace'`, reemplazar:

```js
        const websiteUri = detData.websiteUri && !isSocialUrl(detData.websiteUri) ? detData.websiteUri : null;
        let result = {
          hasWebsite: !!websiteUri, siteUrl: websiteUri,
          seoScore: null, hasSitemap: null, hasRobots: null, metaDesc: null, hasOG: false, email: null,
          lastUpdated: null,
          phone: detData.nationalPhoneNumber || null,
```

por:

```js
        const websiteUri = detData.websiteUri && !isSocialUrl(detData.websiteUri) ? detData.websiteUri : null;
        const socialUrl = detData.websiteUri && isSocialUrl(detData.websiteUri) ? detData.websiteUri : null;
        let result = {
          hasWebsite: !!websiteUri, siteUrl: websiteUri, socialUrl,
          seoScore: null, hasSitemap: null, hasRobots: null, metaDesc: null, hasOG: false, email: null,
          lastUpdated: null,
          phone: detData.nationalPhoneNumber || null,
          internationalPhone: detData.internationalPhoneNumber || null,
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/app/api/lead-finder/route.test.js` → PASS. Luego `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lead-finder/route.js src/app/api/lead-finder/route.test.js
git commit -m "feat: auditPlace devuelve telefono internacional y red social

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cobro solo por lead en `/api/lead-finder-pro/run`

**Files:**
- Modify: `src/app/api/lead-finder-pro/run/route.js` (bloque `if (action === PAID_ACTION)` completo)
- Test: `src/app/api/lead-finder-pro/run/route.test.js`

**Interfaces:**
- Consumes: `clasificarLead` (Task 1).
- Produces: respuesta de `auditPlace` = `{ ok: true, ...audit, esLead, canal, whatsapp, fromCache, fromMyHistory }`. Errores: 402 `{ code: 'NO_PLAN' }`, 429 `{ code: 'DISCARD_LIMIT' }`, y los de Google tal cual (`QUOTA_EXCEEDED`). El historial `leadfinder_client_audits/{uid}/audits/{placeId}` guarda también `esLead`, `canal`, `whatsapp`. `leadfinder_entitlements/{uid}.descartesHoy = { fecha: 'YYYY-MM-DD', n }`.

- [ ] **Step 1: Write the failing tests**

En `route.test.js`, dentro de `describe('POST /api/lead-finder-pro/run — gate de créditos')`, reemplazar el test `'con saldo de créditos: audita, descuenta 1 crédito y guarda el historial'` por:

```js
  const WEB = { ok: true, hasWebsite: true, siteUrl: 'https://x.test', seoScore: 80 };
  const SIN_NADA = { ok: true, hasWebsite: false, siteUrl: null, phone: '0299 442-1234', internationalPhone: '+54 299 442-1234' };
  const HOY = new Date().toISOString().slice(0, 10);

  it('un lead (con web) descuenta 1 crédito y guarda el historial con la clasificación', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db, docs } = createFakeDb({ 'leadfinder_entitlements/client-1': { credits: 3 } });
    getDb.mockReturnValue(db);
    runLeadFinderAction.mockResolvedValue(Response.json(WEB));

    const res = await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ ok: true, esLead: true, canal: 'web', fromMyHistory: false });
    expect(docs['leadfinder_entitlements/client-1'].credits).toBe(2);
    expect(docs['leadfinder_client_audits/client-1/audits/p1']).toMatchObject({ esLead: true, canal: 'web', siteUrl: 'https://x.test' });
  });

  it('un descartado (sin web ni WhatsApp) NO descuenta crédito y suma un descarte del día', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db, docs } = createFakeDb({ 'leadfinder_entitlements/client-1': { credits: 3 } });
    getDb.mockReturnValue(db);
    runLeadFinderAction.mockResolvedValue(Response.json(SIN_NADA));

    const data = await (await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }))).json();

    expect(data).toMatchObject({ ok: true, esLead: false, canal: null });
    expect(docs['leadfinder_entitlements/client-1'].credits).toBe(3);
    expect(docs['leadfinder_entitlements/client-1'].descartesHoy).toEqual({ fecha: HOY, n: 1 });
    expect(docs['leadfinder_client_audits/client-1/audits/p1']).toMatchObject({ esLead: false });
  });

  it('con 100 descartes hoy responde 429 DISCARD_LIMIT sin llamar a Google', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    getDb.mockReturnValue(createFakeDb({
      'leadfinder_entitlements/client-1': { credits: 3, descartesHoy: { fecha: HOY, n: 100 } },
    }).db);

    const res = await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('DISCARD_LIMIT');
    expect(runLeadFinderAction).not.toHaveBeenCalled();
  });

  it('los descartes de otro día no cuentan', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db, docs } = createFakeDb({
      'leadfinder_entitlements/client-1': { credits: 3, descartesHoy: { fecha: '2000-01-01', n: 100 } },
    });
    getDb.mockReturnValue(db);
    runLeadFinderAction.mockResolvedValue(Response.json(SIN_NADA));

    const res = await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }));
    expect(res.status).toBe(200);
    expect(docs['leadfinder_entitlements/client-1'].descartesHoy).toEqual({ fecha: HOY, n: 1 });
  });

  it('un usuario ilimitado no tiene tope de descartes', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db, docs } = createFakeDb({
      'leadfinder_entitlements/client-1': { unlimited: true, status: 'active', descartesHoy: { fecha: HOY, n: 500 } },
    });
    getDb.mockReturnValue(db);
    runLeadFinderAction.mockResolvedValue(Response.json(SIN_NADA));

    const res = await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }));
    expect(res.status).toBe(200);
    expect(docs['leadfinder_entitlements/client-1'].descartesHoy.n).toBe(500);
  });

  it('si otra pestaña gastó el último crédito mientras se auditaba: 402 y no se entrega el lead', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db, docs } = createFakeDb({ 'leadfinder_entitlements/client-1': { credits: 1 } });
    getDb.mockReturnValue(db);
    runLeadFinderAction.mockImplementation(async () => {
      docs['leadfinder_entitlements/client-1'] = { credits: 0 }; // la otra pestaña ganó
      return Response.json(WEB);
    });

    const res = await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }));
    expect(res.status).toBe(402);
    expect(docs['leadfinder_client_audits/client-1/audits/p1']).toBeUndefined();
  });

  it('un descartado ya visto antes vuelve gratis desde el historial', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    getDb.mockReturnValue(createFakeDb({
      'leadfinder_entitlements/client-1': { credits: 0 },
      'leadfinder_client_audits/client-1/audits/p1': { esLead: false, canal: null, auditedAt: 'x' },
    }).db);

    const data = await (await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }))).json();
    expect(data).toMatchObject({ ok: true, esLead: false, fromMyHistory: true });
    expect(runLeadFinderAction).not.toHaveBeenCalled();
  });

  it('un error de Google (cuota) se devuelve tal cual y no cobra', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db, docs } = createFakeDb({ 'leadfinder_entitlements/client-1': { credits: 3 } });
    getDb.mockReturnValue(db);
    runLeadFinderAction.mockResolvedValue(Response.json({ ok: false, error: 'cuota', code: 'QUOTA_EXCEEDED' }));

    const data = await (await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }))).json();
    expect(data.code).toBe('QUOTA_EXCEEDED');
    expect(docs['leadfinder_entitlements/client-1'].credits).toBe(3);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/lead-finder-pro/run/route.test.js`
Expected: FAIL — el descartado descuenta crédito, no hay `descartesHoy`, no existe 429.

- [ ] **Step 3: Implement**

En `src/app/api/lead-finder-pro/run/route.js`:

1. Agregar el import: `import { clasificarLead } from '@/lib/leadRule';`
2. Agregar después de `const badRequest = ...`:

```js
// Se cobra solo por lead (ver src/lib/leadRule.js). Un negocio descartado no gasta crédito, pero
// sí una consulta de detalle a Google: este tope evita que alguien con 1 crédito examine miles
// de negocios gratis (100 × US$0,02 ≈ US$2 por usuario y día en el peor caso).
const DISCARD_LIMIT_PER_DAY = 100;

const isUnlimited = (e) => e?.unlimited === true && e?.status === 'active';
const discardsToday = (e, dayKey) => (e?.descartesHoy?.fecha === dayKey ? e.descartesHoy.n || 0 : 0);

// Patch para descontar 1 crédito, o null si no hay saldo. Prioridad: ilimitado → suscripción
// (cupo mensual) → créditos comprados. Se usa tanto para verificar (antes de auditar) como para
// cobrar (en una transacción, después de saber que es lead).
function chargePatch(e, monthKey) {
  if (!e) return null;
  const base = { auditCount: FieldValue.increment(1), lastAuditAt: FieldValue.serverTimestamp() };
  if (isUnlimited(e)) return base;
  if (e.billingType === 'subscription' && e.status === 'active' && e.planCredits > 0) {
    const used = e.usagePeriod === monthKey ? (e.usageCount || 0) : 0;
    if (used < e.planCredits) return { ...base, usagePeriod: monthKey, usageCount: used + 1 };
  }
  if ((e.credits || 0) > 0) return { ...base, credits: FieldValue.increment(-1) };
  return null;
}

const noPlan = () => Response.json({
  ok: false,
  error: 'No tenés un plan activo de Lead Finder Pro. Elegí un plan para auditar negocios.',
  code: 'NO_PLAN',
}, { status: 402 });

const discardLimit = () => Response.json({
  ok: false,
  error: 'Llegaste al límite diario de negocios revisados sin web ni WhatsApp. Se renueva mañana.',
  code: 'DISCARD_LIMIT',
}, { status: 429 });
```

3. Reemplazar TODO el bloque `if (action === PAID_ACTION) { ... }` por:

```js
  if (action === PAID_ACTION) {
    const db = getDb();
    if (!db) return Response.json({ ok: false, error: 'DB no disponible' }, { status: 500 });

    const { placeId } = body;
    if (!placeId) return Response.json({ ok: false, error: 'placeId requerido' }, { status: 400 });

    // Si este cliente ya vio este negocio (lead o descartado), se devuelve gratis y sin Google.
    const myAuditRef = db.collection('leadfinder_client_audits').doc(authUser.uid).collection('audits').doc(placeId);
    const myAuditSnap = await myAuditRef.get();
    if (myAuditSnap.exists) {
      const { auditedAt: _o, ...rest } = myAuditSnap.data();
      return Response.json({ ok: true, ...rest, fromCache: true, fromMyHistory: true });
    }

    const ref = db.collection('leadfinder_entitlements').doc(authUser.uid);
    const now = new Date().toISOString();
    const monthKey = now.slice(0, 7);
    const dayKey = now.slice(0, 10);

    // 1. Verificación previa, sin descontar: tiene saldo y no pasó el tope de descartes.
    const entSnap = await ref.get();
    const ent = entSnap.exists ? entSnap.data() : null;
    if (!chargePatch(ent, monthKey)) return noPlan();
    if (!isUnlimited(ent) && discardsToday(ent, dayKey) >= DISCARD_LIMIT_PER_DAY) return discardLimit();

    // 2. Auditoría (Places + sitio, con caché global de 30 días).
    const { action: _a, apiKey, ...params } = body;
    const resp = await runLeadFinderAction(action, params, apiKey);
    const data = await resp.json();
    if (!data.ok) return Response.json(data, { status: resp.status });

    const { ok: _ok, fromCache, ...audit } = data;
    const cls = clasificarLead(audit);

    // 3. Cobro: lead → 1 crédito (transacción: otra pestaña pudo gastar el último); descartado →
    //    suma al tope diario.
    if (cls.esLead) {
      const charged = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const patch = chargePatch(snap.exists ? snap.data() : null, monthKey);
        if (!patch) return false;
        tx.set(ref, patch, { merge: true });
        return true;
      });
      if (!charged) return noPlan();
    } else {
      const allowed = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const e = snap.exists ? snap.data() : null;
        if (isUnlimited(e)) return true;
        const n = discardsToday(e, dayKey);
        if (n >= DISCARD_LIMIT_PER_DAY) return false;
        tx.set(ref, { descartesHoy: { fecha: dayKey, n: n + 1 } }, { merge: true });
        return true;
      });
      if (!allowed) return discardLimit();
    }

    // 4. Historial personal (también los descartados, para no volver a pagarlos).
    try {
      await myAuditRef.set({ ...audit, ...cls, placeId, auditedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch { /* no romper la respuesta si falla el guardado del historial */ }

    return Response.json({ ok: true, ...audit, ...cls, fromCache: !!fromCache, fromMyHistory: false });
  }
```

4. Actualizar el comentario de arriba del archivo (`// ... La única acción que gasta 1 crédito es 'auditPlace' ...`) a: `// La única acción que puede gastar 1 crédito es 'auditPlace', y solo si el negocio resulta lead.`

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/app/api/lead-finder-pro/run/route.test.js` → PASS. Luego `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lead-finder-pro/run/route.js src/app/api/lead-finder-pro/run/route.test.js
git commit -m "feat: Lead Finder Pro cobra solo por lead entregado, con tope diario de descartes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Historial con origen, perfil y totales

**Files:**
- Modify: `src/app/api/lead-finder-pro/searches/route.js` (POST y el `map` del GET)
- Test: `src/app/api/lead-finder-pro/searches/route.test.js` (nuevo)

**Interfaces:**
- Produces: POST acepta `{ ciudades, tipos, terminos, radioKm, perfil, stats, origen, results }`. Guarda `origen: 'admin'` solo si `user.email === process.env.ADMIN_EMAIL`; si no `'cliente'`. `perfil` ∈ `'dev' | 'empresa'`. `stats` = `{ encontrados, examinados, leads, conWeb, descartados }` (enteros ≥ 0, los faltantes en 0). GET (lista) devuelve además `origen`, `perfil`, `stats`.

- [ ] **Step 1: Write the failing test**

```js
// src/app/api/lead-finder-pro/searches/route.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { POST } from './route.js';

function fakeDb() {
  const added = [];
  const items = { add: async (doc) => { added.push(doc); return { id: `s${added.length}` }; } };
  return { added, db: { collection: () => ({ doc: () => ({ collection: () => items }) }) } };
}
const req = (body) => ({ json: async () => body });
const BASE = { ciudades: ['Neuquén, Argentina'], terminos: ['gomería'], tipos: [], radioKm: 10, results: [{ id: 'p1' }] };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = 'admin@example.com';
});

describe('POST /api/lead-finder-pro/searches', () => {
  it('guarda origen admin solo si el usuario es el admin', async () => {
    const { db, added } = fakeDb();
    getDb.mockReturnValue(db);
    getUserFromRequest.mockResolvedValue({ uid: 'a', email: 'admin@example.com' });
    await POST(req({ ...BASE, origen: 'admin' }));
    expect(added[0].origen).toBe('admin');
  });

  it('un cliente que manda origen admin queda como cliente', async () => {
    const { db, added } = fakeDb();
    getDb.mockReturnValue(db);
    getUserFromRequest.mockResolvedValue({ uid: 'c', email: 'cliente@example.com' });
    await POST(req({ ...BASE, origen: 'admin' }));
    expect(added[0].origen).toBe('cliente');
  });

  it('normaliza perfil y stats', async () => {
    const { db, added } = fakeDb();
    getDb.mockReturnValue(db);
    getUserFromRequest.mockResolvedValue({ uid: 'c', email: 'cliente@example.com' });
    await POST(req({ ...BASE, perfil: 'raro', stats: { leads: 4, conWeb: '2', descartados: -1, otro: 9 } }));
    expect(added[0].perfil).toBe('dev');
    expect(added[0].stats).toEqual({ encontrados: 0, examinados: 0, leads: 4, conWeb: 0, descartados: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/lead-finder-pro/searches/route.test.js`
Expected: FAIL — `origen`/`perfil`/`stats` son `undefined`.

- [ ] **Step 3: Implement**

En `searches/route.js`, agregar arriba de `export async function GET`:

```js
const STAT_KEYS = ['encontrados', 'examinados', 'leads', 'conWeb', 'descartados'];
function cleanStats(s) {
  const out = {};
  for (const k of STAT_KEYS) out[k] = Number.isInteger(s?.[k]) && s[k] >= 0 ? s[k] : 0;
  return out;
}
```

En el `map` del GET, agregar al objeto devuelto: `origen: data.origen || 'cliente', perfil: data.perfil || 'dev', stats: data.stats || null,`.

En POST, reemplazar desde `const { ciudades, tipos, terminos, radioKm, results } = body;` hasta el `add({...})` por:

```js
  const { ciudades, tipos, terminos, radioKm, results, perfil, stats, origen } = body;
  if (!Array.isArray(results) || !results.length) return Response.json({ error: 'results vacío' }, { status: 400 });

  // El origen "admin" solo lo puede marcar la cuenta admin: así el historial distingue las
  // búsquedas del panel de las que Mariano hace como cliente de prueba.
  const esAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;

  const ref = await db.collection(COL).doc(user.uid).collection('items').add({
    ciudades: ciudades || [], tipos: tipos || [], terminos: terminos || [], radioKm: radioKm || null,
    perfil: perfil === 'empresa' ? 'empresa' : 'dev',
    origen: origen === 'admin' && esAdmin ? 'admin' : 'cliente',
    stats: cleanStats(stats),
    results: results.slice(0, MAX_RESULTS_STORED),
    createdAt: FieldValue.serverTimestamp(),
  });
```

- [ ] **Step 4: Run tests** — `npx vitest run src/app/api/lead-finder-pro/searches/route.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lead-finder-pro/searches/
git commit -m "feat: el historial de Lead Finder guarda origen, perfil y totales

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Motor `searchLeads`

**Files:**
- Create: `src/lib/leadSearch.js`
- Test: `src/lib/leadSearch.test.js`

**Interfaces:**
- Consumes: `clasificarLead` (Task 1).
- Produces:
  - `searchLeads(params, deps)` — async generator. `params = { zonas: [{ ciudad, pais }], terminos: string[], tipos: [{ id, label, query? }], radioKm, cantidad, maxExaminados?, perfil: 'dev'|'empresa', producto, soloConWeb }`. `deps = { call(action, params) → Promise<data>, sleep?(ms), isCancelled?() }`. `call` debe lanzar `Error` con `.code` para errores del server.
  - Eventos: `{type:'zona', ciudad}`, `{type:'busqueda', ciudad, etiqueta}`, `{type:'negocio', negocio}`, `{type:'lead', lead}`, `{type:'descartado', negocio}`, `{type:'productos', id, prodState, prodCount?, prodConfidence?, prodPartial?}`, `{type:'aviso', mensaje, ciudad?, etiqueta?, negocioId?}`, `{type:'fin', totals:{encontrados, examinados, leads, conWeb, descartados}}`.
  - Ficha de lead/negocio: `{ id, nombre, ciudad, tipo, lat, lon, previewRating, ...camposDeAuditPlace, esLead, canal, whatsapp, prodState? }`.
  - `FATAL_CODES = ['NO_AUTH','NO_PLAN','QUOTA_EXCEEDED','DISCARD_LIMIT']`, `isFatal(err)`.
  - `parseZona(raw) → { ciudad, pais }`.
  - `leadToAuditRow(lead)` → fila de `/api/auditorias`.
  - `filasParaInforme(leads)` → solo `canal === 'web'` con `seoScore` numérico, mapeadas con `leadToAuditRow`.
  - `MAX_PAGINAS = 3`, `PAUSA_PAGINA_MS = 1500`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/leadSearch.test.js
import { describe, it, expect, vi } from 'vitest';
import { searchLeads, parseZona, filasParaInforme, leadToAuditRow, isFatal, PAUSA_PAGINA_MS } from './leadSearch.js';

const WEB = { hasWebsite: true, siteUrl: 'https://x.test', seoScore: 40 };
const NADA = { hasWebsite: false, siteUrl: null, phone: '0299 442-1234', internationalPhone: '+54 299 442-1234' };
const CEL = { hasWebsite: false, siteUrl: null, internationalPhone: '+54 9 299 541-4422' };
const fatal = (code) => Object.assign(new Error(code), { code });

// places: { '<query o tipo>': [[ids página 0], [ids página 1]] } · audits: { id: audit | Error }
function fakeCall({ places = {}, audits = {}, geoError = {}, counts = {} } = {}) {
  const fn = vi.fn(async (action, p) => {
    if (action === 'geocode') {
      if (geoError[p.city]) throw geoError[p.city];
      return { ok: true, lat: 1, lon: 2 };
    }
    if (action === 'searchText' || action === 'searchNearby') {
      const pages = places[action === 'searchText' ? p.query : p.type] || [[]];
      const i = p.pageToken ? Number(p.pageToken) : 0;
      return {
        ok: true,
        places: pages[i].map(id => ({ id, displayName: { text: `N-${id}` }, location: { latitude: 3, longitude: 4 } })),
        nextPageToken: i + 1 < pages.length ? String(i + 1) : null,
      };
    }
    if (action === 'auditPlace') {
      const a = audits[p.placeId];
      if (a instanceof Error) throw a;
      return { ok: true, ...(a || NADA) };
    }
    if (action === 'countProducts') return counts[p.placeId] || { ok: true, applicable: true, count: 7, confidence: 'catalogo', partial: false };
    throw new Error(`acción inesperada ${action}`);
  });
  return fn;
}
const audited = (call) => call.mock.calls.filter(c => c[0] === 'auditPlace').map(c => c[1].placeId);
async function collect(gen) {
  const evs = [];
  try { for await (const e of gen) evs.push(e); } catch (error) { return { evs, error }; }
  return { evs, error: null };
}
const base = (over = {}) => ({ zonas: [{ ciudad: 'Neuquén', pais: 'Argentina' }], terminos: ['gomería'], tipos: [], radioKm: 10, cantidad: 10, ...over });
const deps = (call, over = {}) => ({ call, sleep: async () => {}, ...over });
const fin = (evs) => evs.find(e => e.type === 'fin').totals;
const leads = (evs) => evs.filter(e => e.type === 'lead').map(e => e.lead);

describe('searchLeads', () => {
  it('cantidad = leads entregados: corta al llegar, sin auditar de más', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b', 'c', 'd']] }, audits: { a: WEB, b: WEB, c: WEB, d: WEB } });
    const { evs } = await collect(searchLeads(base({ cantidad: 2 }), deps(call)));
    expect(leads(evs).map(l => l.id)).toEqual(['a', 'b']);
    expect(audited(call)).toEqual(['a', 'b']);
    expect(fin(evs)).toMatchObject({ encontrados: 4, examinados: 2, leads: 2, conWeb: 2, descartados: 0 });
  });

  it('los descartados no cuentan para la cantidad pero sí para el tope de examinados', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b', 'c']] }, audits: { a: NADA, b: WEB, c: CEL } });
    const { evs } = await collect(searchLeads(base({ cantidad: 2 }), deps(call)));
    expect(leads(evs).map(l => [l.id, l.canal])).toEqual([['b', 'web'], ['c', 'whatsapp']]);
    expect(leads(evs)[1].whatsapp).toBe('5492995414422');
    expect(evs.filter(e => e.type === 'descartado').map(e => e.negocio.id)).toEqual(['a']);
    expect(fin(evs)).toMatchObject({ examinados: 3, leads: 2, descartados: 1 });
  });

  it('maxExaminados por defecto es 3 × cantidad', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const call = fakeCall({ places: { 'gomería, Neuquén': [ids] } });
    const { evs } = await collect(searchLeads(base({ cantidad: 2 }), deps(call)));
    expect(audited(call)).toHaveLength(6);
    expect(fin(evs)).toMatchObject({ examinados: 6, leads: 0, descartados: 6 });
  });

  it('soloConWeb: un lead por WhatsApp cuenta como descartado', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b']] }, audits: { a: CEL, b: WEB } });
    const { evs } = await collect(searchLeads(base({ soloConWeb: true }), deps(call)));
    expect(leads(evs).map(l => l.id)).toEqual(['b']);
    expect(fin(evs).descartados).toBe(1);
  });

  it('tipos usan searchNearby con su etiqueta; un tipo con query usa searchText', async () => {
    const call = fakeCall({ places: { plumber: [['a']], 'constructora, Neuquén': [['b']] }, audits: { a: WEB, b: WEB } });
    const { evs } = await collect(searchLeads(base({
      terminos: [], tipos: [{ id: 'plumber', label: 'Plomero' }, { id: 'general_contractor', label: 'Constructor', query: 'constructora' }],
    }), deps(call)));
    expect(call).toHaveBeenCalledWith('searchNearby', expect.objectContaining({ type: 'plumber', radiusM: 10000 }));
    expect(leads(evs).map(l => [l.id, l.tipo])).toEqual([['a', 'Plomero'], ['b', 'Constructor']]);
  });

  it('no repite un negocio entre búsquedas ni entre zonas', async () => {
    const call = fakeCall({
      places: { 'gomería, Neuquén': [['a', 'b']], 'neumáticos, Neuquén': [['b', 'c']], 'gomería, Plottier': [['a', 'd']], 'neumáticos, Plottier': [[]] },
      audits: { a: WEB, b: WEB, c: WEB, d: WEB },
    });
    const { evs } = await collect(searchLeads(base({
      zonas: [{ ciudad: 'Neuquén', pais: 'Argentina' }, { ciudad: 'Plottier', pais: 'Argentina' }], terminos: ['gomería', 'neumáticos'],
    }), deps(call)));
    expect(audited(call)).toEqual(['a', 'b', 'c', 'd']);
    expect(fin(evs).encontrados).toBe(4);
  });

  it('pagina hasta 3 veces con pausa entre páginas', async () => {
    const sleep = vi.fn(async () => {});
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a'], ['b'], ['c'], ['d']] }, audits: { a: WEB, b: WEB, c: WEB, d: WEB } });
    const { evs } = await collect(searchLeads(base(), deps(call, { sleep })));
    expect(leads(evs).map(l => l.id)).toEqual(['a', 'b', 'c']); // la 4ª página no se pide
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(PAUSA_PAGINA_MS);
  });

  it('cancelar: termina el negocio en curso y no audita más', async () => {
    let cancel = false;
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b', 'c']] }, audits: { a: WEB, b: WEB, c: WEB } });
    const evs = [];
    for await (const e of searchLeads(base(), deps(call, { isCancelled: () => cancel }))) {
      evs.push(e);
      if (e.type === 'negocio') cancel = true; // se cancela mientras "a" se audita
    }
    expect(audited(call)).toEqual(['a']);
    expect(leads(evs).map(l => l.id)).toEqual(['a']);
    expect(evs.at(-1).type).toBe('fin');
  });

  it('un error fatal corta todo pero los leads ya entregados quedan', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b', 'c']] }, audits: { a: WEB, b: fatal('NO_PLAN'), c: WEB } });
    const { evs, error } = await collect(searchLeads(base(), deps(call)));
    expect(error.code).toBe('NO_PLAN');
    expect(leads(evs).map(l => l.id)).toEqual(['a']);
    expect(audited(call)).toEqual(['a', 'b']);
  });

  it('una ciudad que no se ubica avisa y sigue con la próxima', async () => {
    const call = fakeCall({
      places: { 'gomería, Plottier': [['a']] }, audits: { a: WEB },
      geoError: { Atlantis: new Error('no existe') },
    });
    const { evs, error } = await collect(searchLeads(base({
      zonas: [{ ciudad: 'Atlantis', pais: '' }, { ciudad: 'Plottier', pais: 'Argentina' }],
    }), deps(call)));
    expect(error).toBeNull();
    expect(evs.find(e => e.type === 'aviso').mensaje).toContain('Atlantis');
    expect(leads(evs).map(l => l.id)).toEqual(['a']);
  });

  it('un negocio que no se pudo auditar avisa con su id y sigue', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b']] }, audits: { a: new Error('timeout'), b: WEB } });
    const { evs } = await collect(searchLeads(base(), deps(call)));
    expect(evs.find(e => e.type === 'aviso')).toMatchObject({ negocioId: 'a' });
    expect(leads(evs).map(l => l.id)).toEqual(['b']);
  });

  it('perfil empresa: cuenta productos solo de los leads con web y entrega el conteo antes del fin', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b']] }, audits: { a: WEB, b: CEL } });
    const { evs } = await collect(searchLeads(base({ perfil: 'empresa', producto: ' cubierta ' }), deps(call)));
    expect(call).toHaveBeenCalledWith('countProducts', { placeId: 'a', keyword: 'cubierta' });
    expect(call.mock.calls.filter(c => c[0] === 'countProducts')).toHaveLength(1);
    expect(leads(evs)[0].prodState).toBe('loading');
    const iProd = evs.findIndex(e => e.type === 'productos');
    expect(evs[iProd]).toMatchObject({ id: 'a', prodState: 'done', prodCount: 7, prodConfidence: 'catalogo' });
    expect(iProd).toBeLessThan(evs.findIndex(e => e.type === 'fin'));
  });

  it('usa la clasificación del server si viene; si no (historial viejo), la calcula', async () => {
    const call = fakeCall({
      places: { 'gomería, Neuquén': [['a', 'b']] },
      audits: { a: { ...WEB, esLead: false, canal: null }, b: CEL },
    });
    const { evs } = await collect(searchLeads(base(), deps(call)));
    expect(leads(evs).map(l => l.id)).toEqual(['b']);
  });
});

describe('isFatal', () => {
  it('reconoce los códigos que cortan la búsqueda', () => {
    for (const c of ['NO_AUTH', 'NO_PLAN', 'QUOTA_EXCEEDED', 'DISCARD_LIMIT']) expect(isFatal(fatal(c))).toBe(true);
    expect(isFatal(new Error('x'))).toBe(false);
  });
});

describe('parseZona', () => {
  it('separa ciudad y país por la última coma', () => {
    expect(parseZona('Neuquén, Argentina')).toEqual({ ciudad: 'Neuquén', pais: 'Argentina' });
    expect(parseZona('San Carlos de Bariloche, Río Negro, Argentina')).toEqual({ ciudad: 'San Carlos de Bariloche, Río Negro', pais: 'Argentina' });
  });
  it('sin coma devuelve país vacío', () => {
    expect(parseZona(' Neuquén ')).toEqual({ ciudad: 'Neuquén', pais: '' });
  });
});

describe('filasParaInforme / leadToAuditRow', () => {
  const lead = { id: 'a', nombre: 'A', ciudad: 'Neuquén', tipo: 'Gomería', lat: 1, lon: 2, siteUrl: 'https://a.test', email: 'a@a.test',
    seoScore: 30, hasSitemap: true, hasRobots: false, metaDesc: null, hasOG: false, lastUpdated: '2025-01-01', rating: 4.5, canal: 'web', phone: '123' };

  it('solo leads con web y puntaje SEO, sin teléfono', () => {
    const filas = filasParaInforme([lead, { ...lead, id: 'b', seoScore: null }, { ...lead, id: 'c', canal: 'whatsapp' }]);
    expect(filas.map(f => f.id)).toEqual(['a']);
    expect(filas[0]).toEqual(leadToAuditRow(lead));
    expect(filas[0].phone).toBeUndefined();
    expect(filas[0].lastModified).toBe('2025-01-01');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/leadSearch.test.js`
Expected: FAIL — `Failed to resolve import "./leadSearch.js"`.

- [ ] **Step 3: Write implementation**

```js
// src/lib/leadSearch.js
// Motor único de búsqueda de leads: lo usan la pantalla de Lead Finder (cliente y admin, en el
// navegador) y la auditoría automática (GitHub Actions). No sabe de React ni de HTTP: recibe
// `call(action, params)`, que habla con /api/lead-finder-pro/run o con runLeadFinderAction.
// Ver docs/superpowers/specs/2026-10-12-lead-finder-unificado-design.md
import { clasificarLead } from './leadRule.js';

export const MAX_PAGINAS = 3;
export const PAUSA_PAGINA_MS = 1500; // Google tarda un instante en habilitar el token de la página siguiente
export const FATAL_CODES = ['NO_AUTH', 'NO_PLAN', 'QUOTA_EXCEEDED', 'DISCARD_LIMIT'];
export const isFatal = (e) => FATAL_CODES.includes(e?.code);

const defaultSleep = (ms) => new Promise(r => setTimeout(r, ms));

// "Ciudad, País" → { ciudad, pais }. Sin coma, país vacío (el geocoder igual la resuelve).
export function parseZona(raw) {
  const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return { ciudad: String(raw).trim(), pais: '' };
  return { ciudad: parts.slice(0, -1).join(', '), pais: parts[parts.length - 1] };
}

// Fila de un informe público de /auditorias: sin teléfono ni dirección (privacidad).
export function leadToAuditRow(lead) {
  return {
    id: lead.id, nombre: lead.nombre, ciudad: lead.ciudad, tipo: lead.tipo,
    lat: lead.lat ?? null, lon: lead.lon ?? null,
    siteUrl: lead.siteUrl, email: lead.email || null, seoScore: lead.seoScore,
    hasSitemap: lead.hasSitemap ?? null, hasRobots: lead.hasRobots ?? null,
    metaDesc: lead.metaDesc ?? null, hasOG: lead.hasOG ?? null,
    lastModified: lead.lastUpdated || lead.lastModified || null,
    rating: lead.rating ?? null,
  };
}

// El informe es de SEO: solo leads con web cuya auditoría dio un puntaje.
export function filasParaInforme(leads) {
  return leads.filter(l => l.canal === 'web' && typeof l.seoScore === 'number').map(leadToAuditRow);
}

export async function* searchLeads(params, deps) {
  const {
    zonas = [], terminos = [], tipos = [], radioKm = 10, cantidad = 10,
    perfil = 'dev', producto = '', soloConWeb = false,
  } = params;
  const maxExaminados = params.maxExaminados ?? cantidad * 3;
  const { call, sleep = defaultSleep, isCancelled = () => false } = deps;
  const keyword = perfil === 'empresa' ? String(producto || '').trim() : '';
  const radiusM = radioKm * 1000;

  const seen = new Set();
  const totals = { encontrados: 0, examinados: 0, leads: 0, conWeb: 0, descartados: 0 };
  const listo = () => totals.leads >= cantidad || totals.examinados >= maxExaminados || isCancelled();

  // Conteos de productos: corren en paralelo a la búsqueda; cada uno deja su evento listo y se
  // entrega en el próximo punto de la búsqueda (o al final).
  const pendientes = [];
  const contar = (lead) => {
    const item = { ev: null };
    item.promise = call('countProducts', { placeId: lead.id, keyword })
      .then(d => (d.applicable === false || d.count === null || d.count === undefined)
        ? { prodState: d.partial ? 'error' : 'none' }
        : { prodState: 'done', prodCount: d.count, prodConfidence: d.confidence, prodPartial: !!d.partial })
      .catch(() => ({ prodState: 'error' }))
      .then(patch => { item.ev = { type: 'productos', id: lead.id, ...patch }; });
    pendientes.push(item);
  };
  function* drenar() {
    for (let i = 0; i < pendientes.length;) {
      if (pendientes[i].ev) yield pendientes.splice(i, 1)[0].ev;
      else i++;
    }
  }

  const busquedas = [
    ...tipos.map(t => (t.query
      ? { etiqueta: t.label, action: 'searchText', texto: t.query }
      : { etiqueta: t.label, action: 'searchNearby', tipo: t.id })),
    ...terminos.map(term => ({ etiqueta: term, action: 'searchText', texto: term })),
  ];

  for (const zona of zonas) {
    if (listo()) break;
    yield { type: 'zona', ciudad: zona.ciudad };

    let geo;
    try {
      geo = await call('geocode', { city: zona.ciudad, country: zona.pais || '' });
    } catch (e) {
      if (isFatal(e)) throw e;
      yield { type: 'aviso', ciudad: zona.ciudad, mensaje: `No se pudo ubicar "${zona.ciudad}": ${e.message}` };
      continue;
    }

    for (const b of busquedas) {
      if (listo()) break;
      yield { type: 'busqueda', ciudad: zona.ciudad, etiqueta: b.etiqueta };

      let pageToken = null;
      for (let page = 0; page < MAX_PAGINAS && !listo(); page++) {
        let res;
        try {
          res = await call(b.action, b.action === 'searchText'
            ? { lat: geo.lat, lon: geo.lon, query: `${b.texto}, ${zona.ciudad}`, radiusM, pageToken }
            : { lat: geo.lat, lon: geo.lon, type: b.tipo, radiusM, pageToken });
        } catch (e) {
          if (isFatal(e)) throw e;
          yield { type: 'aviso', ciudad: zona.ciudad, etiqueta: b.etiqueta, mensaje: `Falló la búsqueda "${b.etiqueta}" en ${zona.ciudad}: ${e.message}` };
          break;
        }

        const nuevos = (res.places || []).filter(p => !seen.has(p.id));
        nuevos.forEach(p => seen.add(p.id));
        totals.encontrados += nuevos.length;

        for (const place of nuevos) {
          if (listo()) break;
          const negocio = {
            id: place.id,
            nombre: place.displayName?.text || 'Sin nombre',
            ciudad: zona.ciudad,
            tipo: b.etiqueta,
            lat: place.location?.latitude ?? null,
            lon: place.location?.longitude ?? null,
            previewRating: place.rating ? Number(place.rating).toFixed(1) : null,
          };
          yield { type: 'negocio', negocio };
          totals.examinados++;

          let audit;
          try {
            audit = await call('auditPlace', { placeId: place.id });
          } catch (e) {
            if (isFatal(e)) throw e;
            yield { type: 'aviso', negocioId: place.id, mensaje: `No se pudo auditar "${negocio.nombre}": ${e.message}` };
            continue;
          }

          // El server de Lead Finder Pro ya clasifica (y cobra según eso); la automática y las
          // entradas viejas del historial no traen clasificación, se calcula acá con la misma regla.
          const { ok: _ok, fromCache: _fc, esLead, canal, whatsapp, placeId: _p, auditedAt: _a, ...datos } = audit;
          const cls = esLead === undefined
            ? clasificarLead(audit)
            : { esLead, canal: canal ?? null, whatsapp: whatsapp ?? null };
          const ficha = { ...negocio, ...datos, ...cls };

          if (!cls.esLead || (soloConWeb && cls.canal !== 'web')) {
            totals.descartados++;
            yield { type: 'descartado', negocio: ficha };
          } else {
            totals.leads++;
            if (cls.canal === 'web') totals.conWeb++;
            const cuenta = !!keyword && cls.canal === 'web';
            yield { type: 'lead', lead: cuenta ? { ...ficha, prodState: 'loading' } : ficha };
            if (cuenta) contar(ficha);
          }
          yield* drenar();
        }

        pageToken = res.nextPageToken || null;
        if (!pageToken) break;
        if (page < MAX_PAGINAS - 1 && !listo()) await sleep(PAUSA_PAGINA_MS);
      }
    }
  }

  await Promise.all(pendientes.map(p => p.promise));
  yield* drenar();
  yield { type: 'fin', totals: { ...totals } };
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/leadSearch.test.js` → PASS (17 tests); `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadSearch.js src/lib/leadSearch.test.js
git commit -m "feat: motor unico de busqueda de leads (searchLeads)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: La auditoría automática usa el motor

**Files:**
- Rewrite: `src/lib/autoAuditBatch.js`
- Rewrite: `src/lib/autoAuditBatch.test.js`

**Interfaces:**
- Consumes: `searchLeads`, `leadToAuditRow` (Task 5).
- Produces (sin cambios para `autoAuditRun.js`): `runBatch(combo, { budgetMs, maxSites, maxCandidates, run, now, sleep }) → { results, status: 'ok'|'error'|'cuota_agotada', error?, examined, found }`. `results[i]` = `leadToAuditRow(lead)` + `{ tipo: rubro.label, rubro: rubro.label, aptoSistemaMedida }`. `RADIO_KM = 15`.

- [ ] **Step 1: Write the failing test (archivo completo)**

```js
// src/lib/autoAuditBatch.test.js
import { describe, it, expect, vi } from 'vitest';

// Evita cargar firebase-admin/authServer reales; runBatch recibe `run` inyectado.
vi.mock('@/app/api/lead-finder/route', () => ({ runLeadFinderAction: vi.fn() }));

import { runBatch } from './autoAuditBatch.js';

const TYPE = { ciudad: 'Mendoza', rubro: { label: 'Ferretería', kind: 'type', value: 'hardware_store', prioritario: true } };
const TEXT = { ciudad: 'Salta', rubro: { label: 'Steel framing', kind: 'text', value: 'steel framing', prioritario: false } };
const place = (id, name = id) => ({ id, displayName: { text: name }, location: { latitude: 1, longitude: 2 } });
const audited = (over = {}) => ({
  ok: true, hasWebsite: true, siteUrl: 'https://x.com', seoScore: 40, hasSitemap: false, hasRobots: true,
  metaDesc: null, hasOG: false, email: null, lastUpdated: null, rating: 4.2, ...over,
});
const noWeb = { ok: true, hasWebsite: false, siteUrl: null, internationalPhone: '+54 9 261 555-1234' };
const makeRun = (h) => vi.fn(async (action, params) => Response.json(await h[action](params)));
const noSleep = async () => {};
const geoOk = () => ({ ok: true, lat: -32.9, lon: -68.8 });

describe('runBatch', () => {
  it('rubro type: usa searchNearby con el tipo y arma los resultados con rubro y apto', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: [place('p1', 'Ferretería Uno')], nextPageToken: null }),
      auditPlace: () => audited({ siteUrl: 'https://uno.com', email: 'a@uno.com' }),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(run).toHaveBeenCalledWith('geocode', { city: 'Mendoza', country: 'Argentina' });
    expect(run).toHaveBeenCalledWith('searchNearby', expect.objectContaining({ type: 'hardware_store', radiusM: 15000 }));
    expect(out).toMatchObject({ status: 'ok', examined: 1, found: 1 });
    expect(out.results[0]).toMatchObject({
      id: 'p1', nombre: 'Ferretería Uno', ciudad: 'Mendoza', tipo: 'Ferretería', rubro: 'Ferretería',
      aptoSistemaMedida: true, siteUrl: 'https://uno.com', email: 'a@uno.com', seoScore: 40,
    });
  });

  it('rubro text: usa searchText con "<término>, <ciudad>"', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchText: () => ({ ok: true, places: [place('p1')], nextPageToken: null }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(TEXT, { run, sleep: noSleep });
    expect(run).toHaveBeenCalledWith('searchText', expect.objectContaining({ query: 'steel framing, Salta' }));
    expect(out.results[0]).toMatchObject({ tipo: 'Steel framing', aptoSistemaMedida: false });
  });

  it('descarta los sin web (aunque tengan WhatsApp) y los de seoScore nulo', async () => {
    const audits = { a: noWeb, b: audited({ seoScore: null }), c: audited() };
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: ({ placeId }) => audits[placeId],
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.results.map(r => r.id)).toEqual(['c']);
    expect(out.examined).toBe(3);
  });

  it('respeta maxSites', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: ['a', 'b', 'c'].map(id => place(id)), nextPageToken: null }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, maxSites: 2 });
    expect(out.results).toHaveLength(2);
  });

  it('respeta maxCandidates (cuida el cupo de getDetails)', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: ['a', 'b', 'c', 'd'].map(id => place(id)), nextPageToken: null }),
      auditPlace: () => noWeb,
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, maxCandidates: 3 });
    expect(out.examined).toBe(3);
    expect(run.mock.calls.filter(c => c[0] === 'auditPlace')).toHaveLength(3);
  });

  it('QUOTA_EXCEEDED corta y conserva lo auditado hasta ahí', async () => {
    const audits = { a: audited(), b: { ok: false, error: 'cuota', code: 'QUOTA_EXCEEDED' } };
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: ({ placeId }) => audits[placeId] || audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('cuota_agotada');
    expect(out.results.map(r => r.id)).toEqual(['a']);
    expect(out.examined).toBe(2);
  });

  it('un error de auditPlace que no es de cuota se saltea y sigue', async () => {
    const audits = { a: { ok: false, error: 'timeout' }, b: audited() };
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: [place('a'), place('b')], nextPageToken: null }),
      auditPlace: ({ placeId }) => audits[placeId],
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('ok');
    expect(out.results.map(r => r.id)).toEqual(['b']);
  });

  it('corta al agotar el presupuesto de tiempo', async () => {
    let t = 0;
    const now = () => t;
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: ['a', 'b', 'c'].map(id => place(id)), nextPageToken: null }),
      auditPlace: () => { t += 20000; return audited(); },
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, now, budgetMs: 30000 });
    expect(out.results.map(r => r.id)).toEqual(['a', 'b']);
  });

  it('si la ciudad no se geocodifica devuelve status error sin buscar', async () => {
    const run = makeRun({ geocode: () => ({ ok: false, error: 'Ciudad no encontrada: Mendoza' }) });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('error');
    expect(out.error).toContain('Mendoza');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('si la búsqueda falla en la primera página devuelve status error', async () => {
    const run = makeRun({ geocode: geoOk, searchNearby: () => ({ ok: false, error: 'Unsupported types: x.' }) });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('error');
    expect(out.error).toContain('Unsupported types');
  });

  it('pagina con nextPageToken y deduplica por id', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchNearby: ({ pageToken }) => (pageToken
        ? { ok: true, places: [place('b'), place('c')], nextPageToken: null }
        : { ok: true, places: [place('a'), place('b')], nextPageToken: 'T1' }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.results.map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(out.found).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/autoAuditBatch.test.js`
Expected: FAIL (al menos "descarta los sin web (aunque tengan WhatsApp)" y "si la búsqueda falla… Unsupported types" con el código viejo; si alguno pasa por casualidad, seguir igual).

- [ ] **Step 3: Write implementation (archivo completo)**

```js
// src/lib/autoAuditBatch.js
import { runLeadFinderAction } from '@/app/api/lead-finder/route';
import { searchLeads, leadToAuditRow } from '@/lib/leadSearch';

export const RADIO_KM = 15;

// runLeadFinderAction devuelve un Response; el motor espera datos o un Error con .code.
function makeCall(run) {
  return async (action, params) => {
    const data = await (await run(action, params)).json();
    if (!data.ok) throw Object.assign(new Error(data.error || 'Error'), { code: data.code });
    return data;
  };
}

// Audita un lote de negocios de una combinación ciudad × rubro con el motor compartido
// (src/lib/leadSearch.js), sin pasar por HTTP. El informe es de SEO: solo leads con web.
export async function runBatch(combo, opts = {}) {
  const {
    budgetMs = 45000, maxSites = 15, maxCandidates = 30,
    run = runLeadFinderAction, now = Date.now, sleep,
  } = opts;
  const deadline = now() + budgetMs;
  const { ciudad, rubro } = combo;

  const results = [];
  let examined = 0;
  let found = null;
  let primerAviso = null;
  let status = 'ok';
  let error;

  try {
    const gen = searchLeads({
      zonas: [{ ciudad, pais: 'Argentina' }],
      terminos: rubro.kind === 'text' ? [rubro.value] : [],
      tipos: rubro.kind === 'text' ? [] : [{ id: rubro.value, label: rubro.label }],
      radioKm: RADIO_KM, cantidad: maxSites, maxExaminados: maxCandidates, soloConWeb: true,
    }, { call: makeCall(run), isCancelled: () => now() >= deadline, ...(sleep ? { sleep } : {}) });

    for await (const ev of gen) {
      if (ev.type === 'negocio') examined++;
      if (ev.type === 'aviso' && !ev.negocioId && !primerAviso) primerAviso = ev.mensaje;
      if (ev.type === 'fin') found = ev.totals.encontrados;
      if (ev.type === 'lead' && typeof ev.lead.seoScore === 'number') {
        results.push({
          ...leadToAuditRow(ev.lead),
          tipo: rubro.label,
          rubro: rubro.label,
          aptoSistemaMedida: rubro.prioritario === true,
        });
      }
    }
  } catch (e) {
    if (e.code === 'QUOTA_EXCEEDED') status = 'cuota_agotada';
    else { status = 'error'; error = e.message; }
  }

  // Sin ningún negocio examinado y con un aviso de ciudad/búsqueda: la combinación falló.
  if (status === 'ok' && examined === 0 && primerAviso) { status = 'error'; error = primerAviso; }

  return { results, status, ...(status === 'error' ? { error } : {}), examined, found: found ?? examined };
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/autoAuditBatch.test.js src/lib/autoAuditRun.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autoAuditBatch.js src/lib/autoAuditBatch.test.js
git commit -m "refactor: la auditoria automatica usa el motor compartido de leads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Cantidad configurable en la auditoría automática

**Files:**
- Modify: `src/lib/autoAudit.js` (`validateConfigPatch` + constantes)
- Modify: `src/lib/autoAudit.test.js`
- Modify: `src/lib/autoAuditRun.js` (`defaultConfig`, `loadConfig`, firma de `runAutoAudit`, cálculo de topes)
- Modify: `src/lib/autoAuditRun.test.js`
- Modify: `src/app/api/cron/auditoria/route.js`, `scripts/auto-audit.mjs`
- Modify: `src/components/admin/AutoAuditCard.jsx`

**Interfaces:**
- Produces: en `autoAudit.js`: `CANTIDAD_DEFAULT = 15`, `CANTIDAD_MIN = 3`, `CANTIDAD_MAX = 30`, `FAST_MAX_SITES = 8`, `CORRIDAS_POR_MES = 4 * 4.3`, `consumoMensual(cantidad) → Math.round(2 * cantidad * CORRIDAS_POR_MES)`. `validateConfigPatch` acepta `cantidad`. `runAutoAudit({ force, now, budgetMs, fast, useGemini })` (se eliminan `maxSites`/`maxCandidates`).

- [ ] **Step 1: Write the failing tests**

En `src/lib/autoAudit.test.js`, agregar `consumoMensual` al import existente y, dentro de `describe('validateConfigPatch', ...)`:

```js
  it('acepta cantidad entera entre 3 y 30', () => {
    expect(validateConfigPatch({ cantidad: 20 })).toEqual({ update: { cantidad: 20 } });
    expect(validateConfigPatch({ cantidad: 3 })).toEqual({ update: { cantidad: 3 } });
    expect(validateConfigPatch({ cantidad: 30 })).toEqual({ update: { cantidad: 30 } });
  });

  it('rechaza cantidad fuera de rango o no entera', () => {
    for (const c of [2, 31, 10.5, '15', null]) expect(validateConfigPatch({ cantidad: c }).error).toMatch(/cantidad/);
  });
```

y al final del archivo:

```js
describe('consumoMensual', () => {
  it('estima las consultas de detalle por mes (2 × cantidad × 4 corridas × 4,3 semanas)', () => {
    expect(consumoMensual(15)).toBe(516);
    expect(consumoMensual(30)).toBe(1032);
  });
});
```

En `src/lib/autoAuditRun.test.js`:

1. Reemplazar el test `'pasa budgetMs/maxSites/maxCandidates al lote'` por:

```js
  it('toma la cantidad de la config: maxSites = cantidad, maxCandidates = 2 × cantidad', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, cantidad: 20 }));
    await runAutoAudit({ now: () => NOW, budgetMs: 480000 });
    expect(runBatch).toHaveBeenCalledWith(
      expect.objectContaining({ ciudad: 'Neuquén' }),
      { budgetMs: 480000, maxSites: 20, maxCandidates: 40 },
    );
  });

  it('sin cantidad en la config usa 15 (30 examinados)', async () => {
    getDb.mockReturnValue(createFakeDb(BASE_CONFIG));
    await runAutoAudit({ now: () => NOW });
    expect(runBatch.mock.calls[0][1]).toMatchObject({ maxSites: 15, maxCandidates: 30 });
  });

  it('fast ("Correr ahora") usa como máximo 8 sitios', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, cantidad: 20 }));
    await runAutoAudit({ now: () => NOW, fast: true });
    expect(runBatch.mock.calls[0][1]).toMatchObject({ maxSites: 8, maxCandidates: 16 });
  });
```

2. En el `describe('combinación con muy pocos sitios ...')`, cambiar `runAutoAudit({ now: () => NOW, maxCandidates: 30 })` por `runAutoAudit({ now: () => NOW })` en los dos tests que lo usan (el default de 15 da 30 examinados, así que las expectativas `28` y "no reintenta" siguen valiendo).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/autoAudit.test.js src/lib/autoAuditRun.test.js`
Expected: FAIL — `consumoMensual` no existe, `cantidad` rechazada como "Nada para actualizar", `maxSites` sigue en 15/40.

- [ ] **Step 3: Implement**

En `src/lib/autoAudit.js`, después de `const SUMMARY_MAX = 240;`:

```js
// Sitios con web por corrida (configurable desde la tarjeta del admin). El tope de comercios
// examinados es el doble: cada uno es una consulta de detalle paga de Google Places.
export const CANTIDAD_DEFAULT = 15;
export const CANTIDAD_MIN = 3;
export const CANTIDAD_MAX = 30;
export const FAST_MAX_SITES = 8; // "Correr ahora" corre en Vercel Hobby (corte a los 60 s)
export const CORRIDAS_POR_MES = 4 * 4.3; // cron-job.org: lun/mié/vie/sáb

export function consumoMensual(cantidad) {
  return Math.round(2 * cantidad * CORRIDAS_POR_MES);
}
```

En `validateConfigPatch`, antes de `if (!Object.keys(update).length) {`:

```js
  if ('cantidad' in body) {
    const c = body.cantidad;
    if (!Number.isInteger(c) || c < CANTIDAD_MIN || c > CANTIDAD_MAX) {
      return { error: `cantidad: debe ser un entero entre ${CANTIDAD_MIN} y ${CANTIDAD_MAX}` };
    }
    update.cantidad = c;
  }
```

y cambiar el mensaje final a `'Nada para actualizar (activo, ciudades, rubros, networks o cantidad)'`.

En `src/lib/autoAuditRun.js`:

1. Import: `import { pickNext, comboKey, buildStats, buildPost, DEFAULT_NETWORKS, CANTIDAD_DEFAULT, FAST_MAX_SITES } from '@/lib/autoAudit';`
2. En `defaultConfig()` agregar `cantidad: CANTIDAD_DEFAULT,`.
3. En `loadConfig`, en el objeto devuelto agregar `cantidad: Number.isInteger(d.cantidad) ? d.cantidad : base.cantidad,`.
4. Cambiar la firma:

```js
export async function runAutoAudit({
  force = false, now = Date.now, budgetMs = 45000, fast = false, useGemini = true,
} = {}) {
```

5. Reemplazar `let candidatesLeft = maxCandidates;` por:

```js
    const cantidad = fast ? Math.min(config.cantidad, FAST_MAX_SITES) : config.cantidad;
    let candidatesLeft = 2 * cantidad;
```

6. En la llamada a `runBatch` dentro del loop, cambiar `maxSites,` por `maxSites: cantidad,` (queda `runBatch(combo, { budgetMs: deadline - now(), maxSites: cantidad, maxCandidates: candidatesLeft })`).

En `src/app/api/cron/auditoria/route.js`, reemplazar el `try` por:

```js
  try {
    // Modo rápido: Vercel Hobby corta a los 60 s, así que lote corto (como máximo 8 sitios) y
    // resumen de plantilla (sin Gemini). La corrida programada va por GitHub Actions.
    const result = await runAutoAudit({ force: true, budgetMs: 15000, fast: true, useGemini: false });
    return Response.json({ ok: true, ...result });
  } catch (e) {
```

En `scripts/auto-audit.mjs`, reemplazar el objeto de `runAutoAudit({...})` por:

```js
  const result = await runAutoAudit({
    budgetMs: 8 * 60 * 1000, // sin el tope de 60 s de Vercel; el job tiene timeout de 20 min
    // La cantidad de sitios por corrida (y el tope de 2× examinados) sale de auditoria_auto/config.
  });
```

En `src/components/admin/AutoAuditCard.jsx`:

1. Imports: `import { CANTIDAD_DEFAULT, CANTIDAD_MIN, CANTIDAD_MAX, consumoMensual } from '@/lib/autoAudit';` y `import { PLACES_LIMITS } from '@/data/placesFreeTier';`
2. Estado: `const [cantidad, setCantidad] = useState(CANTIDAD_DEFAULT);` y en `load`, después de `setRubros(...)`: `setCantidad(data.config.cantidad ?? CANTIDAD_DEFAULT);`
3. Reemplazar el texto `Audita un rubro en una ciudad, publica el informe y lo anuncia en redes. Se dispara martes y viernes por GitHub Actions.` por `Audita un rubro en una ciudad, publica el informe y lo anuncia en redes. Corre lunes, miércoles, viernes y sábado (cron-job.org → GitHub Actions).`
4. Antes de `if (authLoading)` agregar: `const consumo = consumoMensual(cantidad); const cupo = PLACES_LIMITS.details.free;`
5. Insertar, justo después del `<div className={card}>` de "Redes" (antes de la tarjeta de Ciudades):

```jsx
          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Cantidad de sitios por corrida</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Sitios con web que entran al informe. Se examinan hasta el doble de comercios.
            </p>
            <div className="flex items-center gap-3">
              <label className="sr-only" htmlFor="aa-cantidad">Cantidad de sitios por corrida</label>
              <input id="aa-cantidad" type="number" min={CANTIDAD_MIN} max={CANTIDAD_MAX} value={cantidad}
                onChange={e => setCantidad(Math.min(CANTIDAD_MAX, Math.max(CANTIDAD_MIN, parseInt(e.target.value, 10) || CANTIDAD_MIN)))}
                className={`${input} w-24`} />
              <button onClick={() => patch({ cantidad }, 'Cantidad guardada')} disabled={busy || cantidad === config.cantidad}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">Guardar</button>
            </div>
            <p className={`mt-2 text-sm ${consumo > cupo ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
              Hasta {2 * cantidad} comercios por corrida ≈ {consumo} consultas de detalle por mes
              (cupo gratis: {cupo.toLocaleString('es-AR')}{consumo > cupo ? ' — lo supera, Google empieza a cobrar' : ''}).
            </p>
          </div>
```

En `CLAUDE.md`, en la sección "Auditoría automática", reemplazar `(martes y viernes 09:00 ART)` por `(lun/mié/vie/sáb 11:00 ART vía cron-job.org)` y reemplazar la línea que empieza con `- La corrida programada examina como máximo 30 comercios` por:

```
  - Cantidad de sitios por corrida: `cantidad` en `auditoria_auto/config` (default 15, rango 3–30, se edita en la tarjeta). Se examinan hasta `2 × cantidad` comercios (getDetails); con 15 son ~516/mes con 4 corridas por semana, la mitad del cupo gratis de Places. La tarjeta muestra el consumo estimado y lo pinta en rojo si supera 1.000/mes.
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/autoAudit.test.js src/lib/autoAuditRun.test.js src/app/api/auditoria-auto/route.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autoAudit.js src/lib/autoAudit.test.js src/lib/autoAuditRun.js src/lib/autoAuditRun.test.js src/app/api/cron/auditoria/route.js scripts/auto-audit.mjs src/components/admin/AutoAuditCard.jsx CLAUDE.md
git commit -m "feat: cantidad de sitios por corrida configurable en la auditoria automatica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Rubros en inglés y "Constructor" por texto

**Files:**
- Modify: `src/data/rubros.js`
- Test: `src/data/rubros.test.js` (nuevo)

**Interfaces:**
- Produces: `RUBRO_LABEL_EN` (id → nombre EN), `CATEGORIA_EN` (cat → nombre EN), `rubroLabel(rubro, lang)`, `categoriaLabel(cat, lang)`. El rubro `general_contractor` gana `query: 'constructora'` (Places API New no acepta ese tipo: el motor lo busca por texto).

- [ ] **Step 1: Write the failing test**

```js
// src/data/rubros.test.js
import { describe, it, expect } from 'vitest';
import { RUBROS, CATEGORIAS_RUBROS, RUBRO_LABEL_EN, CATEGORIA_EN, rubroLabel, categoriaLabel } from './rubros.js';

describe('rubros', () => {
  it('todos los rubros y categorías tienen nombre en inglés', () => {
    expect(RUBROS.filter(r => !RUBRO_LABEL_EN[r.id]).map(r => r.id)).toEqual([]);
    expect(CATEGORIAS_RUBROS.filter(c => !CATEGORIA_EN[c])).toEqual([]);
  });

  it('rubroLabel y categoriaLabel según idioma', () => {
    const plomero = RUBROS.find(r => r.id === 'plumber');
    expect(rubroLabel(plomero, 'es')).toBe('Plomero');
    expect(rubroLabel(plomero, 'en')).toBe('Plumber');
    expect(rubroLabel(undefined, 'es')).toBe('');
    expect(categoriaLabel('Automotor', 'en')).toBe('Automotive');
    expect(categoriaLabel('Automotor', 'es')).toBe('Automotor');
  });

  it('Constructor se busca por texto (general_contractor no existe en Places API New)', () => {
    expect(RUBROS.find(r => r.id === 'general_contractor').query).toBe('constructora');
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/data/rubros.test.js` → FAIL (`RUBRO_LABEL_EN` undefined).

- [ ] **Step 3: Implement**

En `src/data/rubros.js`:

1. Cambiar la línea de `general_contractor` a:
```js
  { id: 'general_contractor',   label: 'Constructor',       cat: 'Hogar & Oficios', query: 'constructora' }, // tipo no soportado por Places API New → búsqueda por texto
```
2. Actualizar el comentario de cabecera: agregar `// \`query\` (opcional) = el rubro se busca por texto en vez de por tipo de Places.` y en "Usado por" sumar `el buscador de Lead Finder (src/components/leadfinder) y la auditoría automática`.
3. Agregar al final del archivo:

```js
// Nombres en inglés para /en/lead-finder-pro (el resto del sitio usa `label`).
export const RUBRO_LABEL_EN = {
  restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar', bakery: 'Bakery', pizza_restaurant: 'Pizzeria',
  ice_cream_shop: 'Ice cream shop', meal_takeaway: 'Takeaway', meal_delivery: 'Delivery',
  store: 'Store', clothing_store: 'Clothing', shoe_store: 'Shoe store', jewelry_store: 'Jewelry',
  hardware_store: 'Hardware store', florist: 'Florist', pet_store: 'Pet store', supermarket: 'Supermarket',
  convenience_store: 'Convenience store', furniture_store: 'Furniture', electronics_store: 'Electronics',
  home_goods_store: 'Home goods', book_store: 'Bookstore', gift_shop: 'Gift shop',
  sporting_goods_store: 'Sporting goods', bicycle_store: 'Bike shop', cell_phone_store: 'Phone store',
  liquor_store: 'Liquor store', shopping_mall: 'Shopping mall',
  hair_care: 'Hair salon', beauty_salon: 'Beauty salon', barber_shop: 'Barber shop', nail_salon: 'Nail salon',
  spa: 'Spa', gym: 'Gym', dentist: 'Dentist', doctor: 'Doctor', physiotherapist: 'Physiotherapist',
  pharmacy: 'Pharmacy', veterinary_care: 'Veterinarian',
  real_estate_agency: 'Real estate', lawyer: 'Lawyer', accounting: 'Accounting', insurance_agency: 'Insurance',
  travel_agency: 'Travel agency', photographer: 'Photographer',
  car_repair: 'Auto repair', car_dealer: 'Car dealer', car_wash: 'Car wash', car_rental: 'Car rental',
  gas_station: 'Gas station',
  electrician: 'Electrician', plumber: 'Plumber', painter: 'Painter', general_contractor: 'Contractor',
  locksmith: 'Locksmith', laundry: 'Laundry', moving_company: 'Moving company',
  school: 'School', primary_school: 'Primary school', secondary_school: 'Secondary school',
  preschool: 'Preschool', university: 'University',
  lodging: 'Lodging', hotel: 'Hotel', motel: 'Motel', campground: 'Campground',
};

export const CATEGORIA_EN = {
  'Gastronomía': 'Food & drink', 'Comercios': 'Retail', 'Salud & Belleza': 'Health & beauty',
  'Serv. Profesionales': 'Professional services', 'Automotor': 'Automotive', 'Hogar & Oficios': 'Home & trades',
  'Educación': 'Education', 'Alojamiento': 'Lodging & travel',
};

export function rubroLabel(rubro, lang = 'es') {
  if (!rubro) return '';
  return lang === 'en' ? (RUBRO_LABEL_EN[rubro.id] || rubro.label) : rubro.label;
}

export function categoriaLabel(cat, lang = 'es') {
  return lang === 'en' ? (CATEGORIA_EN[cat] || cat) : cat;
}
```

- [ ] **Step 4: Run** — `npx vitest run src/data/rubros.test.js` → PASS. Si el primer test lista ids o categorías faltantes (porque `rubros.js` tiene alguno que no aparece arriba), agregarlos al mapa con su traducción y volver a correr. `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/rubros.js src/data/rubros.test.js
git commit -m "feat: rubros con nombre en ingles y Constructor por busqueda de texto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Textos nuevos del buscador (ES/EN)

**Files:**
- Modify: `src/data/i18n/leadFinderPro.js` (objetos `panel` de ES y de EN)

**Interfaces:**
- Produces (en `lfpT(lang).panel`): `tiposLabel`, `tiposHint`, `tiposToggle(n)`, `tiposCatAll`, `tiposCatNone`, `needCriteria`, `colRubro`, `colWeb`, `colContacto`, `noSiteShort`, `whatsappBtn`, `socialLink`, `summary(totals)`, `progress({ ciudad, etiqueta, leads, cantidad, examinados })`, `checking(nombre)`, `discardTitle`, `discardDesc`, `warningsTitle(n)`, `adminTag`, `csvHeadersLeads` (array), `channelWeb`, `channelWhatsapp`.

- [ ] **Step 1: Agregar al `panel` de ES** (antes de `mail: {`):

```js
      tiposLabel: 'Rubros de Google Maps',
      tiposHint: '(opcional — se suman a los términos)',
      tiposToggle: (n) => (n ? `${n} rubro${n === 1 ? '' : 's'} elegido${n === 1 ? '' : 's'}` : 'Elegir rubros'),
      tiposCatAll: 'todos',
      tiposCatNone: 'quitar',
      needCriteria: 'Agregá al menos un término o un rubro',
      colRubro: 'Rubro',
      colWeb: 'Web',
      colContacto: 'Contacto',
      noSiteShort: 'Sin web',
      whatsappBtn: 'WhatsApp',
      socialLink: 'Red social',
      summary: (s) => `${s.leads} lead${s.leads === 1 ? '' : 's'} · ${s.conWeb} con web · ${s.leads - s.conWeb} por WhatsApp · ${s.descartados} descartado${s.descartados === 1 ? '' : 's'}`,
      progress: (p) => `📍 ${p.ciudad || '…'} · ${p.etiqueta || '…'} · ${p.leads}/${p.cantidad} leads · ${p.examinados} revisados`,
      checking: (nombre) => `Revisando ${nombre}…`,
      discardTitle: 'Límite diario de negocios revisados',
      discardDesc: 'Hoy revisaste muchos negocios sin web ni WhatsApp (esos no se cobran). El límite se renueva mañana.',
      warningsTitle: (n) => `${n} aviso${n === 1 ? '' : 's'} durante la búsqueda`,
      adminTag: 'admin',
      channelWeb: 'web',
      channelWhatsapp: 'WhatsApp',
      csvHeadersLeads: ['Nombre', 'Ciudad', 'Rubro', 'Canal', 'WhatsApp', 'Teléfono', 'Email', 'Sitio web', 'SEO', 'Red social', 'Rating', 'Reseñas', 'Horarios', 'Última actualización', 'Productos', 'Confianza del conteo'],
```

- [ ] **Step 2: Agregar al `panel` de EN** (antes de `mail: {`):

```js
      tiposLabel: 'Google Maps categories',
      tiposHint: '(optional — added to the search terms)',
      tiposToggle: (n) => (n ? `${n} categor${n === 1 ? 'y' : 'ies'} selected` : 'Choose categories'),
      tiposCatAll: 'all',
      tiposCatNone: 'clear',
      needCriteria: 'Add at least one search term or category',
      colRubro: 'Category',
      colWeb: 'Website',
      colContacto: 'Contact',
      noSiteShort: 'No website',
      whatsappBtn: 'WhatsApp',
      socialLink: 'Social',
      summary: (s) => `${s.leads} lead${s.leads === 1 ? '' : 's'} · ${s.conWeb} with website · ${s.leads - s.conWeb} via WhatsApp · ${s.descartados} discarded`,
      progress: (p) => `📍 ${p.ciudad || '…'} · ${p.etiqueta || '…'} · ${p.leads}/${p.cantidad} leads · ${p.examinados} checked`,
      checking: (nombre) => `Checking ${nombre}…`,
      discardTitle: 'Daily review limit reached',
      discardDesc: 'Today you reviewed many businesses with no website or WhatsApp (those are not charged). The limit resets tomorrow.',
      warningsTitle: (n) => `${n} warning${n === 1 ? '' : 's'} during the search`,
      adminTag: 'admin',
      channelWeb: 'website',
      channelWhatsapp: 'WhatsApp',
      csvHeadersLeads: ['Name', 'City', 'Category', 'Channel', 'WhatsApp', 'Phone', 'Email', 'Website', 'SEO', 'Social', 'Rating', 'Reviews', 'Opening hours', 'Last updated', 'Products', 'Count confidence'],
```

- [ ] **Step 3: Test de paridad ES/EN**

```js
// src/data/i18n/leadFinderPro.test.js
import { describe, it, expect } from 'vitest';
import { lfpT } from './leadFinderPro.js';

describe('lfpT panel', () => {
  it('ES y EN tienen las mismas claves', () => {
    const es = Object.keys(lfpT('es').panel).sort();
    const en = Object.keys(lfpT('en').panel).sort();
    expect(es.filter(k => !en.includes(k))).toEqual([]);
    expect(en.filter(k => !es.includes(k))).toEqual([]);
  });

  it('summary y progress arman el texto', () => {
    const t = lfpT('es').panel;
    expect(t.summary({ leads: 5, conWeb: 3, descartados: 1 })).toBe('5 leads · 3 con web · 2 por WhatsApp · 1 descartado');
    expect(t.progress({ ciudad: 'Neuquén', etiqueta: 'gomería', leads: 2, cantidad: 10, examinados: 4 })).toContain('2/10 leads');
  });
});
```

Run: `npx vitest run src/data/i18n/leadFinderPro.test.js` → PASS. Luego `npm test` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/i18n/leadFinderPro.js src/data/i18n/leadFinderPro.test.js
git commit -m "feat: textos ES/EN del buscador unificado de Lead Finder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Pantalla única (`src/components/leadfinder/`) en Lead Finder Pro

**Files:**
- Create: `src/components/leadfinder/useLeadSearch.js`
- Create: `src/components/leadfinder/LeadFinderForm.jsx`
- Create: `src/components/leadfinder/LeadResultsTable.jsx`
- Create: `src/components/leadfinder/LeadSearchHistory.jsx`
- Create: `src/components/leadfinder/admin/LeadFinderAdminExtras.jsx`
- Create: `src/components/leadfinder/LeadFinder.jsx`
- Modify: `src/app/lead-finder-pro/buscar/page.jsx`, `src/app/en/lead-finder-pro/buscar/page.jsx`

**Interfaces:**
- Consumes: `searchLeads`, `parseZona`, `filasParaInforme` (Task 5); `RUBROS`, `CATEGORIAS_RUBROS`, `rubroLabel`, `categoriaLabel` (Task 8); claves de Task 9; `MailBatchPanel` (`src/components/leadfinderpro/MailBatchPanel.jsx`, props `{ emails, userEmail, t }`); `buildAuditPublishPayload` (`src/lib/socialAuditPost.js`); `PROVINCIAS_AR` (`src/data/localidadesAR.js`); `useAuthUser()` → `{ user, getIdToken, login }`.
- Produces: `<LeadFinder variant="cliente" | "admin" lang="es" | "en" forceDark={bool} />` (default export).

No hay testing-library en el repo (Vitest corre en node): esta task se verifica con `npm run build` y en el navegador (Task 13). La lógica ya está testeada en el motor.

- [ ] **Step 1: `useLeadSearch.js`**

```js
// src/components/leadfinder/useLeadSearch.js
'use client';

import { useState, useRef, useCallback } from 'react';
import { searchLeads } from '@/lib/leadSearch';

const CERO = { encontrados: 0, examinados: 0, leads: 0, conWeb: 0, descartados: 0 };
const MAX_LOG = 200;
const hora = () => new Date().toLocaleTimeString('es-AR', { hour12: false });

// Corre el motor y guarda el estado de la pantalla. `call` habla con /api/lead-finder-pro/run.
export function useLeadSearch(call) {
  const [phase, setPhase] = useState('idle'); // idle | searching | done | error
  const [leads, setLeads] = useState([]);
  const [pendiente, setPendiente] = useState(null); // negocio que se está revisando ahora
  const [progress, setProgress] = useState({ ciudad: '', etiqueta: '' });
  const [totals, setTotals] = useState(CERO);
  const [avisos, setAvisos] = useState([]);
  const [stop, setStop] = useState(null); // { code, message } si la búsqueda se cortó
  const [log, setLog] = useState([]);
  const cancelRef = useRef(false);
  const leadsRef = useRef([]);

  const commit = (fn) => { leadsRef.current = fn(leadsRef.current); setLeads(leadsRef.current); };
  const addLog = (msg, level = 'info') => setLog(prev => [...prev.slice(-(MAX_LOG - 1)), { time: hora(), msg, level }]);

  const run = useCallback(async (params) => {
    cancelRef.current = false;
    commit(() => []);
    setAvisos([]); setStop(null); setPendiente(null); setLog([]);
    setTotals(CERO); setProgress({ ciudad: '', etiqueta: '' });
    setPhase('searching');
    const local = { ...CERO };

    try {
      for await (const ev of searchLeads(params, { call, isCancelled: () => cancelRef.current })) {
        switch (ev.type) {
          case 'zona':
            setProgress(p => ({ ...p, ciudad: ev.ciudad }));
            addLog(`Ciudad: ${ev.ciudad}`);
            break;
          case 'busqueda':
            setProgress(p => ({ ...p, etiqueta: ev.etiqueta }));
            addLog(`  Buscando "${ev.etiqueta}"…`);
            break;
          case 'negocio':
            local.examinados++;
            setPendiente(ev.negocio);
            break;
          case 'lead':
            local.leads++;
            if (ev.lead.canal === 'web') local.conWeb++;
            setPendiente(null);
            commit(prev => [...prev, ev.lead]);
            addLog(`  ✓ ${ev.lead.nombre} (${ev.lead.canal}${ev.lead.seoScore != null ? `, SEO ${ev.lead.seoScore}` : ''})`, 'success');
            break;
          case 'descartado':
            local.descartados++;
            setPendiente(null);
            addLog(`  · ${ev.negocio.nombre}: sin web ni WhatsApp`);
            break;
          case 'productos': {
            const { type: _t, id, ...patch } = ev;
            commit(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
            break;
          }
          case 'aviso':
            setPendiente(null);
            setAvisos(a => [...a, ev]);
            addLog(`  ⚠ ${ev.mensaje}`, 'warn');
            break;
          case 'fin':
            Object.assign(local, ev.totals);
            addLog(`Listo: ${local.leads} leads, ${local.descartados} descartados.`, 'success');
            break;
          default:
        }
        setTotals({ ...local });
      }
      setPhase('done');
    } catch (e) {
      setStop({ code: e.code || null, message: e.message });
      addLog(`Búsqueda cortada: ${e.message}`, 'error');
      setPhase(e.code ? 'done' : 'error');
    }
    setPendiente(null);
    return { leads: leadsRef.current, totals: { ...local } };
  }, [call]);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  // Muestra una búsqueda guardada del historial.
  const load = useCallback((saved, savedTotals) => {
    commit(() => saved || []);
    setTotals(savedTotals || { ...CERO, leads: (saved || []).length, conWeb: (saved || []).filter(l => l.canal === 'web' || l.hasWebsite).length });
    setAvisos([]); setStop(null); setLog([]);
    setPhase('done');
  }, []);

  return { phase, leads, pendiente, progress, totals, avisos, stop, log, run, cancel, load };
}
```

- [ ] **Step 2: `LeadFinderForm.jsx`**

```jsx
// src/components/leadfinder/LeadFinderForm.jsx
'use client';

import { useState } from 'react';
import { RUBROS, CATEGORIAS_RUBROS, rubroLabel, categoriaLabel } from '@/data/rubros';
import { PROVINCIAS_AR } from '@/data/localidadesAR';

const field = 'px-3 py-2 bg-page border border-fg/10 rounded-lg text-fg text-sm placeholder:text-fg-600 disabled:opacity-60';
const label = 'block text-xs font-medium text-fg-400 mb-2';

// Lista de chips con su input (localidades y términos).
function ChipInput({ items, onChange, placeholder, addLabel, disabled, icon, chipClass }) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setText('');
  };
  return (
    <div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map(it => (
            <span key={it} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${chipClass}`}>
              {icon} {it}
              {!disabled && (
                <button type="button" onClick={() => onChange(items.filter(x => x !== it))} className="ml-0.5 hover:text-red-500" aria-label={`Quitar ${it}`}>×</button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input type="text" value={text} onChange={e => setText(e.target.value)} disabled={disabled} placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className={`flex-1 min-w-0 ${field}`} />
        <button type="button" onClick={add} disabled={disabled || !text.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium">
          {addLabel}
        </button>
      </div>
    </div>
  );
}

// Selector provincia → localidad (solo admin): agrega "Localidad, Argentina".
function ProvinciaPicker({ onAdd, disabled }) {
  const [prov, setProv] = useState('');
  const [loc, setLoc] = useState('');
  const localidades = PROVINCIAS_AR.find(p => p.provincia === prov)?.localidades || [];
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <select value={prov} onChange={e => { setProv(e.target.value); setLoc(''); }} disabled={disabled} className={`flex-1 min-w-[140px] ${field}`} aria-label="Provincia">
        <option value="">— Provincia —</option>
        {PROVINCIAS_AR.map(p => <option key={p.provincia} value={p.provincia}>{p.provincia}</option>)}
      </select>
      <select value={loc} onChange={e => setLoc(e.target.value)} disabled={disabled || !prov} className={`flex-1 min-w-[140px] ${field}`} aria-label="Localidad">
        <option value="">— Localidad —</option>
        {localidades.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <button type="button" disabled={disabled || !loc} onClick={() => { onAdd(`${loc}, Argentina`); setLoc(''); }}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium">+</button>
    </div>
  );
}

// value = { perfil, producto, zonas: string[], terminos: string[], tipos: string[], radioKm, cantidad }
export default function LeadFinderForm({ value, onChange, disabled, lang, variant, balance, t }) {
  const [showTipos, setShowTipos] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });
  const maxCantidad = balance === null || balance === Infinity ? undefined : Math.max(1, balance);

  return (
    <div className="space-y-4">
      <div>
        <span className={label}>{t.perfilLabel}</span>
        <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label={t.perfilLabel}>
          {[
            { id: 'dev', label: t.perfilDev, hint: t.perfilDevHint },
            { id: 'empresa', label: t.perfilEmpresa, hint: t.perfilEmpresaHint },
          ].map(opt => (
            <button key={opt.id} type="button" role="radio" aria-checked={value.perfil === opt.id}
              disabled={disabled} onClick={() => set({ perfil: opt.id })}
              className={`text-left px-4 py-3 rounded-xl border transition-colors disabled:opacity-60 ${value.perfil === opt.id
                ? 'bg-indigo-500/10 border-indigo-500/60' : 'bg-page border-fg/10 hover:border-fg/20'}`}>
              <span className="block text-fg text-sm font-semibold">{opt.label}</span>
              <span className="block text-fg-500 text-xs mt-0.5">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {value.perfil === 'empresa' && (
        <div>
          <label className={label} htmlFor="lf-producto">{t.productoLabel} <span className="text-fg-600 font-normal">{t.productoHint}</span></label>
          <input id="lf-producto" type="text" value={value.producto} onChange={e => set({ producto: e.target.value })}
            disabled={disabled} maxLength={60} placeholder={t.productoPlaceholder} className={`w-full ${field}`} />
        </div>
      )}

      <div>
        <span className={label}>{t.zonaLabel} <span className="text-fg-600 font-normal">{t.zonaHint}</span></span>
        <ChipInput items={value.zonas} onChange={zonas => set({ zonas })} placeholder={t.zonaPlaceholder}
          addLabel={t.addBtn} disabled={disabled} icon="📍" chipClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" />
        {variant === 'admin' && (
          <ProvinciaPicker disabled={disabled} onAdd={z => !value.zonas.includes(z) && set({ zonas: [...value.zonas, z] })} />
        )}
      </div>

      <div>
        <span className={label}>{t.terminosLabel} <span className="text-fg-600 font-normal">{t.terminosHint}</span></span>
        <ChipInput items={value.terminos} onChange={terminos => set({ terminos })} placeholder={t.terminosPlaceholder}
          addLabel={t.addBtn} disabled={disabled} icon="🔎" chipClass="bg-blue-500/10 text-blue-600 dark:text-blue-300" />
      </div>

      <div>
        <button type="button" onClick={() => setShowTipos(v => !v)} aria-expanded={showTipos}
          className="flex items-center gap-2 text-xs font-medium text-fg-400 hover:text-fg">
          <span>{showTipos ? '▾' : '▸'}</span>
          {t.tiposLabel} <span className="text-fg-600 font-normal">{t.tiposHint}</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-fg/5 text-fg-300">{t.tiposToggle(value.tipos.length)}</span>
        </button>
        {showTipos && (
          <div className="mt-3 space-y-3">
            {CATEGORIAS_RUBROS.map(cat => {
              const ids = RUBROS.filter(r => r.cat === cat).map(r => r.id);
              const allOn = ids.every(id => value.tipos.includes(id));
              return (
                <div key={cat}>
                  <button type="button" disabled={disabled}
                    onClick={() => set({ tipos: allOn ? value.tipos.filter(id => !ids.includes(id)) : [...new Set([...value.tipos, ...ids])] })}
                    className="text-[11px] font-semibold uppercase tracking-wide text-fg-500 mb-1.5 hover:text-indigo-500">
                    {categoriaLabel(cat, lang)} <span className="font-normal">({allOn ? t.tiposCatNone : t.tiposCatAll})</span>
                  </button>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {RUBROS.filter(r => r.cat === cat).map(r => {
                      const checked = value.tipos.includes(r.id);
                      return (
                        <label key={r.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none
                          ${checked ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-fg/10 text-fg-400 hover:border-fg/20'}
                          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input type="checkbox" checked={checked} disabled={disabled} className="accent-indigo-600 w-3 h-3"
                            onChange={e => set({ tipos: e.target.checked ? [...value.tipos, r.id] : value.tipos.filter(id => id !== r.id) })} />
                          {rubroLabel(r, lang)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className={label} htmlFor="lf-radio">{t.radioLabel}</label>
          <input id="lf-radio" type="number" min={1} max={50} value={value.radioKm} disabled={disabled}
            onChange={e => set({ radioKm: Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)) })} className={`w-28 ${field}`} />
        </div>
        <div>
          <label className={label} htmlFor="lf-cantidad">{t.cantidadLabel} <span className="text-fg-600 font-normal">{t.cantidadHint}</span></label>
          <input id="lf-cantidad" type="number" min={1} max={maxCantidad} value={value.cantidad} disabled={disabled}
            onChange={e => {
              const v = Math.max(1, parseInt(e.target.value, 10) || 1);
              set({ cantidad: maxCantidad ? Math.min(v, maxCantidad) : v });
            }}
            className={`w-28 ${field}`} />
        </div>
        <span className="pb-2 text-xs text-fg-500">
          {balance === null ? '' : balance === Infinity ? t.balanceUnlimited : balance <= 0 ? t.balanceZero : t.balanceAvailable(balance)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `LeadResultsTable.jsx`**

```jsx
// src/components/leadfinder/LeadResultsTable.jsx
'use client';

const OUTDATED_MS = 18 * 30 * 24 * 60 * 60 * 1000; // ~18 meses

const shortUrl = (url) => (url ? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 35) : '');
const isOutdated = (iso) => { const ms = Date.parse(iso); return Number.isFinite(ms) && Date.now() - ms > OUTDATED_MS; };
const fmtMonth = (iso, locale) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
};

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="text-fg-600 text-xs">—</span>;
  const cls = score >= 70 ? 'bg-green-500/15 text-green-700 dark:text-green-400'
    : score >= 40 ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
    : 'bg-red-500/15 text-red-700 dark:text-red-400';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>{score}</span>;
}

export function exportLeadsCSV(rows, t) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map(r => [
    r.nombre, r.ciudad, r.tipo, r.canal === 'web' ? t.channelWeb : t.channelWhatsapp,
    r.whatsapp ? `+${r.whatsapp}` : '', r.phone || '', r.email || '', r.siteUrl || '', r.seoScore ?? '',
    r.socialUrl || '', r.rating ?? '', r.ratingCount ?? '', (r.openingHours || []).join(' | '),
    r.lastUpdated ? String(r.lastUpdated).slice(0, 10) : '',
    r.prodState === 'done' ? r.prodCount : '',
    r.prodState === 'done' ? (r.prodConfidence === 'catalogo' ? t.productsCatalog : t.productsEstimated) : '',
  ]);
  const csv = [t.csvHeadersLeads, ...body].map(row => row.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `leads_${Date.now()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function LeadResultsTable({ rows, perfil, t }) {
  const headers = [t.tableHeaders[0], t.tableHeaders[1], t.colRubro, t.colWeb, 'SEO', t.colContacto, t.colUpdated,
    ...(perfil === 'empresa' ? [t.colProducts] : []), '★', 'Maps'];

  return (
    <div className="bg-card border border-fg/10 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto" style={{ maxHeight: 560, overflowY: 'auto' }}>
        <table className="min-w-full text-sm">
          <thead className="bg-card sticky top-0 z-10">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left text-xs font-medium text-fg-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-fg/5">
            {rows.map(neg => (
              <tr key={neg.id} className="hover:bg-fg/5">
                <td className="px-3 py-2.5 max-w-[180px]"><div className="text-fg truncate text-xs font-medium" title={neg.nombre}>{neg.nombre}</div></td>
                <td className="px-3 py-2.5 text-xs text-fg-500 whitespace-nowrap">{neg.ciudad}</td>
                <td className="px-3 py-2.5"><span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 rounded-full text-xs whitespace-nowrap">{neg.tipo}</span></td>
                <td className="px-3 py-2.5 max-w-[160px]">
                  {neg.siteUrl
                    ? <a href={neg.siteUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs truncate block" title={neg.siteUrl}>{shortUrl(neg.siteUrl)}</a>
                    : <span className="text-purple-600 dark:text-purple-400 text-xs font-medium">{t.noSiteShort}</span>}
                </td>
                <td className="px-3 py-2.5 text-center"><ScoreBadge score={neg.seoScore} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 max-w-[260px]">
                    {neg.whatsapp && (
                      <a href={`https://wa.me/${neg.whatsapp}`} target="_blank" rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-medium">{t.whatsappBtn}</a>
                    )}
                    {neg.email && <a href={`mailto:${neg.email}`} title={neg.email} className="text-indigo-600 dark:text-indigo-400 text-xs truncate max-w-[160px]">{neg.email}</a>}
                    {!neg.whatsapp && neg.phone && <span className="text-fg-400 text-xs whitespace-nowrap">{neg.phone}</span>}
                    {neg.socialUrl && <a href={neg.socialUrl} target="_blank" rel="noopener noreferrer" className="text-fg-500 hover:text-fg text-xs underline">{t.socialLink}</a>}
                    {!neg.whatsapp && !neg.email && !neg.phone && !neg.socialUrl && <span className="text-fg-600 text-xs">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                  {neg.lastUpdated
                    ? <span className={isOutdated(neg.lastUpdated) ? 'text-orange-500' : 'text-fg-400'} title={isOutdated(neg.lastUpdated) ? t.outdatedTitle : undefined}>{fmtMonth(neg.lastUpdated, t.locale)}</span>
                    : <span className="text-fg-600">—</span>}
                </td>
                {perfil === 'empresa' && (
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {neg.prodState === 'loading' ? <span className="text-fg-500">{t.countingProducts}</span>
                      : neg.prodState === 'done' ? (
                        <span title={neg.prodConfidence === 'catalogo' ? t.productsCatalogTitle : t.productsEstimatedTitle}>
                          <span className="text-fg font-semibold">{neg.prodCount}{neg.prodPartial ? '+' : ''}</span>{' '}
                          <span className={neg.prodConfidence === 'catalogo' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-500'}>
                            {neg.prodConfidence === 'catalogo' ? t.productsCatalog : t.productsEstimated}
                          </span>
                        </span>
                      ) : neg.prodState === 'error' ? <span className="text-red-500">—</span>
                      : <span className="text-fg-600">—</span>}
                  </td>
                )}
                <td className="px-3 py-2.5 text-xs text-yellow-600 dark:text-yellow-500 whitespace-nowrap">{neg.rating ? `★${neg.rating}` : neg.previewRating ? `★${neg.previewRating}` : '—'}</td>
                <td className="px-3 py-2.5">
                  <a href={`https://www.google.com/maps/place/?q=place_id:${neg.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-fg-500 hover:text-fg">Maps</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `LeadSearchHistory.jsx`**

```jsx
// src/components/leadfinder/LeadSearchHistory.jsx
'use client';

import { useState } from 'react';

export default function LeadSearchHistory({ items, onOpen, onDelete, loadingId, t }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="bg-card border border-fg/10 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center justify-between px-5 py-4 hover:bg-fg/5">
        <span className="text-fg font-semibold text-sm">{t.historyToggle(items.length)}</span>
        <span className="text-fg-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="divide-y divide-fg/5 border-t border-fg/10">
          {items.map(h => (
            <div key={h.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-fg text-sm truncate">
                  {(h.ciudades || []).join(', ') || t.noLocation}
                  {h.origen === 'admin' && <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[10px] font-semibold uppercase">{t.adminTag}</span>}
                </p>
                <p className="text-fg-500 text-xs">
                  {h.stats ? t.summary(h.stats) : h.resultCount} · {h.createdAt ? new Date(h.createdAt).toLocaleDateString(t.locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onOpen(h.id)} disabled={loadingId === h.id}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg">
                  {loadingId === h.id ? '⏳' : t.historyView}
                </button>
                <button onClick={() => onDelete(h.id)} className="px-2 py-1.5 text-fg-500 hover:text-red-500 text-xs" aria-label="Borrar">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `admin/LeadFinderAdminExtras.jsx`**

```jsx
// src/components/leadfinder/admin/LeadFinderAdminExtras.jsx
// Lo que solo ve el admin en el buscador: filtros, log en vivo y publicar informe + redes.
'use client';

import { useState, useEffect, useRef } from 'react';
import { filasParaInforme, parseZona } from '@/lib/leadSearch';
import { buildAuditPublishPayload } from '@/lib/socialAuditPost';

export const EMPTY_FILTERS = { tipo: '', email: false, seoBajo: false, texto: '' };
export const MIN_SITIOS_INFORME = 3; // misma regla que la auditoría automática

export function applyAdminFilters(rows, f) {
  return rows.filter(r => {
    if (f.tipo && r.tipo !== f.tipo) return false;
    if (f.email && !r.email) return false;
    if (f.seoBajo && (typeof r.seoScore !== 'number' || r.seoScore >= 50)) return false;
    if (f.texto && !r.nombre.toLowerCase().includes(f.texto.toLowerCase())) return false;
    return true;
  });
}

const ctl = 'px-2.5 py-1.5 border border-fg/10 rounded-lg bg-page text-fg text-sm';

export function AdminFilters({ rows, filters, setFilters, shown }) {
  const tipos = [...new Set(rows.map(r => r.tipo))];
  return (
    <div className="flex flex-wrap items-center gap-3 bg-card border border-fg/10 rounded-2xl p-4">
      <span className="text-sm font-semibold text-fg">{shown}/{rows.length} resultados</span>
      <select value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })} className={ctl} aria-label="Filtrar por rubro">
        <option value="">Todos los rubros</option>
        {tipos.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-sm text-fg-400">
        <input type="checkbox" checked={filters.email} onChange={e => setFilters({ ...filters, email: e.target.checked })} className="accent-indigo-600" /> Con email
      </label>
      <label className="flex items-center gap-1.5 text-sm text-fg-400">
        <input type="checkbox" checked={filters.seoBajo} onChange={e => setFilters({ ...filters, seoBajo: e.target.checked })} className="accent-red-500" /> SEO bajo (&lt; 50)
      </label>
      <input type="text" value={filters.texto} onChange={e => setFilters({ ...filters, texto: e.target.value })} placeholder="Buscar nombre…" aria-label="Buscar nombre" className={`${ctl} w-40`} />
    </div>
  );
}

export function AdminLog({ log }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log, open]);
  if (!log.length) return null;
  return (
    <div className="bg-card border border-fg/10 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-fg-500 uppercase tracking-wide hover:bg-fg/5">
        Log ({log.length}) <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div ref={ref} className="h-44 overflow-y-auto px-4 py-2 space-y-0.5 font-mono text-xs border-t border-fg/10">
          {log.map((l, i) => (
            <div key={i} className={l.level === 'error' ? 'text-red-500' : l.level === 'success' ? 'text-green-600 dark:text-green-400' : l.level === 'warn' ? 'text-yellow-600 dark:text-yellow-400' : 'text-fg-500'}>
              <span className="text-fg-600 mr-2 select-none">{l.time}</span>{l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function rubrosTexto(labels) {
  if (!labels.length) return 'negocios locales';
  if (labels.length === 1) return labels[0];
  if (labels.length <= 3) return `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`;
  return `${labels.slice(0, 3).join(', ')} y ${labels.length - 3} más`;
}

// form = valor del formulario; tipoLabels = etiquetas de los tipos elegidos.
export function PublishReport({ leads, form, tipoLabels, disabled }) {
  const filas = filasParaInforme(leads);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [toSocial, setToSocial] = useState(true);
  const [nets, setNets] = useState({ linkedin: true, instagram: true, facebook: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [url, setUrl] = useState(null);

  const ciudades = form.zonas.map(z => parseZona(z).ciudad);
  const rubros = [...tipoLabels, ...form.terminos];
  const total = filas.length;
  const low = filas.filter(f => f.seoScore < 50).length;
  const withEmail = filas.filter(f => f.email).length;
  const avg = total ? Math.round(filas.reduce((s, f) => s + f.seoScore, 0) / total) : null;

  const abrir = () => {
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    const r = rubrosTexto(rubros);
    const pct = total ? Math.round((low / total) * 100) : 0;
    setTitle(`Auditoría SEO de páginas web de ${r} (${fecha})`);
    setDesc(
      `Auditoría SEO de ${total} sitios web de ${r} en ${ciudades.join(', ') || 'varias ciudades'}. ` +
      `El ${pct}% (${low}) tiene un posicionamiento web débil y el promedio general es ${avg ?? '—'}/100. ` +
      `${withEmail} cuentan con un email público de contacto. ` +
      `El relevamiento evidencia oportunidades concretas de mejora en la presencia digital de los comercios de la zona.\n\n` +
      `🔍 Conocé el servicio Lead Finder Pro: https://marianoaliandri.com.ar/keywords`
    );
    setMsg('');
    setModal(true);
  };

  const publicar = async () => {
    setBusy(true); setMsg('');
    try {
      const resp = await fetch('/api/auditorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), summary: desc.trim(), results: filas,
          stats: { total, withEmail, lowSeoCount: low, avgSeoScore: avg },
          config: { ciudades, pais: 'Argentina', radioKm: form.radioKm, tiposLabels: rubros },
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.id) throw new Error(data.error || 'Error al publicar');
      setUrl(`/auditorias/${data.id}`);

      const networks = Object.keys(nets).filter(k => nets[k]);
      if (toSocial && networks.length) {
        const res = await fetch('/api/publish-social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildAuditPublishPayload({ caption: `${title}\n\n${desc}`, networks, auditoriaId: data.id })),
        });
        const pub = await res.json().catch(() => ({}));
        if (!res.ok || pub.success === false) {
          setMsg(`Informe guardado, pero falló la publicación en redes: ${pub.error || `HTTP ${res.status}`}`);
          setBusy(false);
          return;
        }
      }
      setModal(false);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (url) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold">Ver informe</a>;
  }

  const puede = total >= MIN_SITIOS_INFORME;
  return (
    <>
      <button onClick={abrir} disabled={disabled || !puede}
        title={puede ? undefined : `Hacen falta al menos ${MIN_SITIOS_INFORME} leads con web y puntaje SEO (hay ${total})`}
        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold">
        Publicar informe ({total})
      </button>
      {!puede && !disabled && <span className="text-xs text-fg-500">Mínimo {MIN_SITIOS_INFORME} sitios con web para publicar</span>}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setModal(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="pub-title" className="bg-card text-fg rounded-2xl border border-fg/10 w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 id="pub-title" className="font-semibold mb-1">Publicar auditoría</h3>
            <p className="text-xs text-fg-500 mb-4">Incluye solo los {total} leads con web. Revisá el título y la descripción.</p>
            <label htmlFor="pub-t" className="block text-[11px] font-bold uppercase tracking-widest text-fg-500 mb-1">Título</label>
            <input id="pub-t" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} className="w-full mb-4 px-3 py-2 bg-page border border-fg/10 rounded-lg text-sm" />
            <label htmlFor="pub-d" className="block text-[11px] font-bold uppercase tracking-widest text-fg-500 mb-1">Descripción del informe</label>
            <textarea id="pub-d" value={desc} onChange={e => setDesc(e.target.value)} rows={6} disabled={busy} className="w-full px-3 py-2 bg-page border border-fg/10 rounded-lg text-sm leading-relaxed resize-y" />
            <div className="mt-4 p-3 rounded-xl bg-fg/5 border border-fg/10 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={toSocial} onChange={e => setToSocial(e.target.checked)} className="w-4 h-4" /> Publicar también en redes sociales
              </label>
              {toSocial && (
                <div className="flex gap-4 pl-6">
                  {['linkedin', 'instagram', 'facebook'].map(n => (
                    <label key={n} className="flex items-center gap-1.5 text-xs text-fg-400 capitalize">
                      <input type="checkbox" checked={nets[n]} onChange={() => setNets(p => ({ ...p, [n]: !p[n] }))} className="w-3.5 h-3.5" /> {n}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {msg && <p className="mt-3 text-sm text-red-500" role="alert">{msg}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModal(false)} disabled={busy} className="px-4 py-2 text-sm text-fg-400 hover:bg-fg/5 rounded-lg">Cancelar</button>
              <button onClick={publicar} disabled={busy || !title.trim()} className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50">
                {busy ? 'Publicando…' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 6: `LeadFinder.jsx`**

```jsx
// src/components/leadfinder/LeadFinder.jsx
// Buscador único de Lead Finder: lo usan /lead-finder-pro/buscar (variant="cliente") y la pestaña
// Lead Finder del admin (variant="admin"). Ver docs/superpowers/specs/2026-10-12-lead-finder-unificado-design.md
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebaseservice';
import { useAuthUser } from '@/hooks/useAuthUser';
import { lfpT } from '@/data/i18n/leadFinderPro';
import { RUBROS, rubroLabel } from '@/data/rubros';
import { parseZona } from '@/lib/leadSearch';
import { useLeadSearch } from './useLeadSearch';
import LeadFinderForm from './LeadFinderForm';
import LeadResultsTable, { exportLeadsCSV } from './LeadResultsTable';
import LeadSearchHistory from './LeadSearchHistory';
import MailBatchPanel from '@/components/leadfinderpro/MailBatchPanel';
import { AdminFilters, AdminLog, PublishReport, applyAdminFilters, EMPTY_FILTERS } from './admin/LeadFinderAdminExtras';

const FORM_CLIENTE = { perfil: 'dev', producto: '', zonas: [], terminos: [], tipos: [], radioKm: 10, cantidad: 10 };
const FORM_ADMIN = { ...FORM_CLIENTE, zonas: ['Neuquén, Argentina'], cantidad: 20 };
const ADMIN_FORM_KEY = 'admin_lf_form_v2';

// Mismo cálculo que el gate del server, solo para mostrar el saldo (nunca decide el cobro).
function computeBalance(e) {
  if (!e) return 0;
  if (e.unlimited === true && e.status === 'active') return Infinity;
  if (e.billingType === 'subscription' && e.status === 'active' && e.planCredits > 0) {
    const used = e.usagePeriod === new Date().toISOString().slice(0, 7) ? (e.usageCount || 0) : 0;
    return Math.max(0, e.planCredits - used);
  }
  return e.credits || 0;
}

function loadAdminForm() {
  try {
    const s = localStorage.getItem(ADMIN_FORM_KEY);
    if (s) return { ...FORM_ADMIN, ...JSON.parse(s) };
  } catch { /* sin storage */ }
  return FORM_ADMIN;
}

function tipoParams(ids, lang) {
  return ids.map(id => {
    const r = RUBROS.find(x => x.id === id);
    return { id, label: rubroLabel(r, lang) || id, ...(r?.query ? { query: r.query } : {}) };
  });
}

export default function LeadFinder({ variant = 'cliente', lang = 'es', forceDark = false }) {
  const t = lfpT(lang).panel;
  const isAdmin = variant === 'admin';
  const { user, getIdToken, login } = useAuthUser();

  const [form, setForm] = useState(isAdmin ? FORM_ADMIN : FORM_CLIENTE);
  const [showForm, setShowForm] = useState(true);
  const [balance, setBalance] = useState(null); // null = sin cargar, Infinity = ilimitado
  const [history, setHistory] = useState([]);
  const [loadingSavedId, setLoadingSavedId] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => { if (isAdmin) setForm(loadAdminForm()); }, [isAdmin]);

  const call = useCallback(async (action, params = {}) => {
    const idToken = await getIdToken();
    const resp = await fetch('/api/lead-finder-pro/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify({ action, ...params }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      const code = resp.status === 401 ? 'NO_AUTH' : resp.status === 402 ? 'NO_PLAN' : (data.code || null);
      throw Object.assign(new Error(data.error || `Error ${resp.status}`), { code });
    }
    return data;
  }, [getIdToken]);

  const search = useLeadSearch(call);
  const isRunning = search.phase === 'searching';

  const refreshBalance = useCallback(() => {
    if (!user) { setBalance(null); return; }
    getDoc(doc(db, 'leadfinder_entitlements', user.uid))
      .then(snap => setBalance(computeBalance(snap.data())))
      .catch(() => setBalance(0));
  }, [user]);
  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  const authHeaders = useCallback(async () => {
    const idToken = await getIdToken();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  }, [getIdToken]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const resp = await fetch('/api/lead-finder-pro/searches', { headers: await authHeaders() });
      const data = await resp.json().catch(() => ({}));
      setHistory(data.items || []);
    } catch { /* noop */ }
  }, [user, authHeaders]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const start = async () => {
    if (isAdmin) { try { localStorage.setItem(ADMIN_FORM_KEY, JSON.stringify(form)); } catch { /* sin storage */ } }
    setShowForm(false);
    setFilters(EMPTY_FILTERS);
    const { leads, totals } = await search.run({
      zonas: form.zonas.map(parseZona),
      terminos: form.terminos,
      tipos: tipoParams(form.tipos, lang),
      radioKm: form.radioKm,
      cantidad: form.cantidad,
      perfil: form.perfil,
      producto: form.producto,
    });
    refreshBalance();
    if (leads.length) {
      try {
        await fetch('/api/lead-finder-pro/searches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({
            ciudades: form.zonas, terminos: form.terminos, tipos: form.tipos, radioKm: form.radioKm,
            perfil: form.perfil, stats: totals, origen: isAdmin ? 'admin' : 'cliente', results: leads,
          }),
        });
        loadHistory();
      } catch { /* el historial no bloquea la búsqueda */ }
    }
  };

  const openSaved = async (id) => {
    setLoadingSavedId(id);
    try {
      const resp = await fetch(`/api/lead-finder-pro/searches?id=${id}`, { headers: await authHeaders() });
      const data = await resp.json().catch(() => ({}));
      if (data.results) {
        search.load(data.results, data.stats || null);
        setForm(f => ({
          ...f, zonas: data.ciudades || [], terminos: data.terminos || [], tipos: data.tipos || [],
          radioKm: data.radioKm || 10, perfil: data.perfil || 'dev',
        }));
        setShowForm(false);
      }
    } finally {
      setLoadingSavedId(null);
    }
  };

  const deleteSaved = async (id) => {
    await fetch(`/api/lead-finder-pro/searches?id=${id}`, { method: 'DELETE', headers: await authHeaders() });
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const rows = useMemo(() => (isAdmin ? applyAdminFilters(search.leads, filters) : search.leads), [isAdmin, search.leads, filters]);
  const emails = useMemo(() => search.leads.map(r => r.email).filter(Boolean), [search.leads]);
  const tipoLabels = form.tipos.map(id => rubroLabel(RUBROS.find(r => r.id === id), lang) || id);
  const hasCriteria = form.terminos.length > 0 || form.tipos.length > 0;
  const canStart = form.zonas.length > 0 && hasCriteria && form.cantidad > 0 && (form.perfil !== 'empresa' || form.producto.trim());
  const noCredits = !isAdmin && balance !== null && balance !== Infinity && balance <= 0;
  const stopCode = search.stop?.code;

  let content;
  if (isAdmin && !user) {
    content = (
      <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
        <p className="text-sm text-amber-700 dark:text-amber-400">Iniciá sesión con la cuenta admin para buscar: esta herramienta gasta cuota de Google.</p>
        <button onClick={login} className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg">Iniciar sesión</button>
      </div>
    );
  } else if (!isAdmin && (noCredits || stopCode === 'NO_PLAN') && !search.leads.length) {
    content = (
      <div className="bg-card border border-amber-500/30 rounded-2xl p-8 text-center">
        <p className="text-3xl mb-3">🔒</p>
        <h3 className="text-fg font-bold text-lg mb-2">{t.blockedTitle}</h3>
        <p className="text-fg-400 text-sm mb-5">{t.blockedDesc}</p>
        <a href={lang === 'en' ? '/en/lead-finder-pro#planes' : '/lead-finder-pro#planes'} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl text-sm">{t.blockedCta}</a>
      </div>
    );
  } else {
    content = (
      <div className="space-y-5">
        {stopCode === 'QUOTA_EXCEEDED' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4" role="alert">
            <p className="text-amber-700 dark:text-amber-300 font-semibold text-sm">⏳ {t.quotaTitle}</p>
            <p className="text-fg-400 text-xs mt-0.5">{t.quotaDesc}</p>
          </div>
        )}
        {stopCode === 'DISCARD_LIMIT' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4" role="alert">
            <p className="text-amber-700 dark:text-amber-300 font-semibold text-sm">⏳ {t.discardTitle}</p>
            <p className="text-fg-400 text-xs mt-0.5">{t.discardDesc}</p>
          </div>
        )}
        {stopCode === 'NO_PLAN' && search.leads.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 text-sm text-amber-700 dark:text-amber-300" role="alert">{t.blockedTitle}</div>
        )}

        <LeadSearchHistory items={history} onOpen={openSaved} onDelete={deleteSaved} loadingId={loadingSavedId} t={t} />

        <div className="bg-card border border-fg/10 rounded-2xl overflow-hidden">
          <button onClick={() => setShowForm(v => !v)} aria-expanded={showForm} className="w-full flex items-center justify-between px-5 py-4 hover:bg-fg/5">
            <span className="text-fg font-semibold text-sm">{t.sectionHeader}</span>
            <span className="text-fg-500 text-xs">{showForm ? '▲' : '▼'}</span>
          </button>
          {showForm && (
            <div className="p-5 border-t border-fg/10">
              <LeadFinderForm value={form} onChange={setForm} disabled={isRunning} lang={lang} variant={variant} balance={balance} t={t} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 bg-fg/5 border-t border-fg/10">
            {!isRunning ? (
              <button onClick={start} disabled={!canStart}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm">{t.searchBtn}</button>
            ) : (
              <button onClick={search.cancel} className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold text-sm">{t.stopBtn}</button>
            )}
            {search.leads.length > 0 && (
              <button onClick={() => exportLeadsCSV(search.leads, t)} className="px-4 py-2.5 bg-fg/5 hover:bg-fg/10 text-fg rounded-xl text-sm font-medium">{t.csvBtn}</button>
            )}
            {isAdmin && search.leads.length > 0 && (
              <PublishReport leads={search.leads} form={form} tipoLabels={tipoLabels} disabled={isRunning} />
            )}
            {!canStart && !isRunning && form.zonas.length > 0 && !hasCriteria && <span className="text-xs text-fg-500">{t.needCriteria}</span>}
            {search.phase === 'error' && search.stop && <span className="text-xs text-red-500 ml-auto" role="alert">{search.stop.message}</span>}
          </div>
        </div>

        {isRunning && (
          <div className="bg-card border border-fg/10 rounded-2xl p-4 text-xs text-fg-400 space-y-1" aria-live="polite">
            <p>{t.progress({ ciudad: search.progress.ciudad, etiqueta: search.progress.etiqueta, leads: search.totals.leads, cantidad: form.cantidad, examinados: search.totals.examinados })}</p>
            {search.pendiente && <p className="text-fg-500">{t.checking(search.pendiente.nombre)}</p>}
          </div>
        )}

        {(search.leads.length > 0 || search.phase === 'done') && (
          <p className="text-sm text-fg-300" aria-live="polite">{t.summary(search.totals)}</p>
        )}

        {search.avisos.length > 0 && !isRunning && (
          <details className="bg-card border border-fg/10 rounded-2xl px-5 py-3 text-xs text-fg-400">
            <summary className="cursor-pointer">{t.warningsTitle(search.avisos.length)}</summary>
            <ul className="mt-2 space-y-1 list-disc pl-5">{search.avisos.map((a, i) => <li key={i}>{a.mensaje}</li>)}</ul>
          </details>
        )}

        {emails.length > 0 && !isRunning && <MailBatchPanel emails={emails} userEmail={user?.email} t={t.mail} />}

        {isAdmin && search.leads.length > 0 && (
          <AdminFilters rows={search.leads} filters={filters} setFilters={setFilters} shown={rows.length} />
        )}

        {rows.length > 0 && <LeadResultsTable rows={rows} perfil={form.perfil} t={t} />}

        {isAdmin && <AdminLog log={search.log} />}
      </div>
    );
  }

  return forceDark ? <div className="dark text-fg">{content}</div> : content;
}
```

Nota: `PublishReport` se desmonta cuando arranca otra búsqueda (los leads vuelven a 0), así que su estado ("Ver informe") se reinicia solo.

- [ ] **Step 7: Usar `LeadFinder` en las páginas de Lead Finder Pro**

En `src/app/lead-finder-pro/buscar/page.jsx`: cambiar el import de `CustomerLeadFinderPanel` por `import LeadFinder from '@/components/leadfinder/LeadFinder';` y `<CustomerLeadFinderPanel />` por `<LeadFinder variant="cliente" lang="es" forceDark />`.

En `src/app/en/lead-finder-pro/buscar/page.jsx`: igual, con `<LeadFinder variant="cliente" lang="en" forceDark />`.

- [ ] **Step 8: Verificar**

Run: `npm test` → PASS. Run: `npm run build` → compila sin errores (warnings de lint preexistentes OK; ninguno nuevo de los archivos creados).

- [ ] **Step 9: Commit**

```bash
git add src/components/leadfinder src/app/lead-finder-pro/buscar/page.jsx src/app/en/lead-finder-pro/buscar/page.jsx
git commit -m "feat: buscador unificado de Lead Finder en /lead-finder-pro/buscar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: El admin usa el buscador unificado

**Files:**
- Modify: `src/views/AdminPage.jsx:31` (import) y `:762` (render)

- [ ] **Step 1: Reemplazar**

Línea 31: `import LeadFinderPanel from '../components/audit/LeadFinderPanel';` → `import LeadFinder from '../components/leadfinder/LeadFinder';`

Línea 762: `<LeadFinderPanel />` → `<LeadFinder variant="admin" lang="es" />`

- [ ] **Step 2: Verificar** — `grep -rn "audit/LeadFinderPanel" src` → sin resultados. `npm run build` → OK.

- [ ] **Step 3: Commit**

```bash
git add src/views/AdminPage.jsx
git commit -m "feat: el admin usa el buscador unificado de Lead Finder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Textos de cobro por lead (revisión del usuario)

**Files:**
- Modify: `src/data/i18n/leadFinderPro.js` (`cantidadLabel`, `cantidadHint`, `blockedDesc`, `statsCreditsUsed` no se usa más — dejarlo), ES y EN
- Modify: `src/app/lead-finder-pro/buscar/page.jsx`, `src/app/en/lead-finder-pro/buscar/page.jsx` (subtítulo)
- Modify: `src/app/lead-finder-pro/page.jsx:53-64` (sección "¿Cómo funcionan los créditos?") y su equivalente en `src/app/en/lead-finder-pro/page.jsx` si existe la misma sección
- Modify: `src/views/LeadFinderProTermsPage.jsx:40-42`, `src/views/LeadFinderProTermsPageEn.jsx:40-42`

- [ ] **Step 1: Leer los textos actuales** de cada archivo listado (las líneas indicadas y su contexto) para reemplazarlos respetando el marcado.

- [ ] **Step 2: Mostrarle al usuario esta propuesta y esperar su OK antes de editar**

| Dónde | Hoy | Propuesta ES | Propuesta EN |
|---|---|---|---|
| Subtítulo del buscador | Elegí cuántos resultados querés — esa cantidad es la que se gasta de tus créditos. | Elegí cuántos leads querés. Pagás solo por los que te entregamos: los negocios sin web ni WhatsApp no se cobran. | Choose how many leads you want. You only pay for the ones we deliver: businesses with no website or WhatsApp are free. |
| `cantidadLabel` / `cantidadHint` | Cantidad de resultados / (cada resultado = 1 crédito) | Cantidad de leads / (cada lead = 1 crédito) | Number of leads / (each lead = 1 credit) |
| `blockedDesc` | …cada resultado que pedís gasta 1 crédito. | Elegí un plan para buscar negocios: cada lead que te entregamos usa 1 crédito. | Pick a plan to search businesses: each lead we deliver uses 1 credit. |
| Landing, "¿Cómo funcionan los créditos?" | …cada resultado llega directo con website, teléfono… | Cada lead llega con su web y puntaje SEO, o con su WhatsApp si no tiene web. Los negocios sin web ni WhatsApp se descartan solos y no se cobran. Si ya habías visto un negocio, no se vuelve a cobrar. | Each lead comes with its website and SEO score, or its WhatsApp if it has no website. Businesses with neither are discarded automatically and not charged. Businesses you already saw are never charged twice. |
| Términos (cláusula de cobro) | …cantidad de créditos de tu plan. Si un negocio ya lo habías auditado antes, no vuelve a consumir un crédito. | …créditos de tu plan: se consume 1 crédito por cada negocio entregado como lead (con sitio web, o con un teléfono celular apto para WhatsApp cuando no tiene sitio). Los negocios descartados no consumen créditos; para evitar abusos, se pueden revisar hasta 100 negocios descartados por día. Un negocio que ya habías visto no vuelve a consumir un crédito. | …credits from your plan: 1 credit is used for each business delivered as a lead (with a website, or with a mobile phone usable for WhatsApp when it has no website). Discarded businesses use no credits; to prevent abuse, up to 100 discarded businesses can be reviewed per day. A business you already saw never uses another credit. |

- [ ] **Step 3: Aplicar los textos aprobados** (con los cambios que pida el usuario) en cada archivo.

- [ ] **Step 4: Verificar** — `npm test` → PASS; `npm run build` → OK.

- [ ] **Step 5: Commit**

```bash
git add src/data/i18n/leadFinderPro.js src/app/lead-finder-pro src/app/en/lead-finder-pro src/views/LeadFinderProTermsPage.jsx src/views/LeadFinderProTermsPageEn.jsx
git commit -m "docs: Lead Finder Pro explica el cobro solo por lead entregado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Limpieza, documentación y prueba en el navegador

**Files:**
- Delete: `src/components/leadfinderpro/CustomerLeadFinderPanel.jsx`, `src/components/audit/LeadFinderPanel.jsx`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Verificar que nadie los importa y borrarlos**

Run: `grep -rn "CustomerLeadFinderPanel\|audit/LeadFinderPanel" src` → sin resultados (salvo los propios archivos).
Run: `git rm src/components/leadfinderpro/CustomerLeadFinderPanel.jsx src/components/audit/LeadFinderPanel.jsx`

- [ ] **Step 2: CLAUDE.md**

1. En "Estructura de carpetas", reemplazar la línea `    LeadFinderPanel.jsx # Lead finder multi-ciudad con progreso, log, CSV, publicar a Firestore` por:
```
    leadfinder/         # Buscador unico de Lead Finder (cliente y admin): LeadFinder.jsx (variant),
                        # useLeadSearch, LeadFinderForm, LeadResultsTable, LeadSearchHistory, admin/
```
2. En `lib/`, agregar:
```
    leadRule.js         # Regla de lead: web → lead; sin web → solo si tiene WhatsApp (celular AR +54 9)
    leadSearch.js       # Motor unico de busqueda (generador): pantallas + auditoria automatica
```
3. Reemplazar el bloque **Lead Finder** de "Funcionalidades activas" por:
```
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
```
4. En "Que NO tocar o romper", reemplazar el bullet "**Lead Finder — campo `ciudad`**" por:
```
- **Lead Finder — cobro por lead**: la regla de lead se decide en el server
  (`/api/lead-finder-pro/run` usa `clasificarLead`); nunca mover esa decisión al cliente. Cada
  lead tiene `ciudad`, `canal` y `whatsapp`; el `seen` del motor evita duplicados entre ciudades.
```

- [ ] **Step 3: Verificación completa**

Run: `npm test` → PASS (todos).
Run: `npm run build` → OK.

- [ ] **Step 4: Prueba en el navegador** (gasta unas pocas consultas de detalle a Google)

Con `npm run dev` corriendo y la skill `agent-browser`:
1. `/lead-finder-pro/buscar` logueado como admin (credenciales en `.env.local`): perfil dev, localidad "Neuquén, Argentina", término "gomería", cantidad 3 → aparecen hasta 3 leads, cada uno con web o botón WhatsApp; el resumen muestra leads/descartados; el CSV descarga.
2. Mismo flujo con perfil empresa, producto "cubierta" → la columna Productos se completa en los leads con web.
3. Rubros de Google Maps: elegir "Plomero" (sin términos) → busca y entrega leads.
4. `/en/lead-finder-pro/buscar` → textos y rubros en inglés.
5. Admin → pestaña Lead Finder: mismo buscador + filtros + log + selector de provincia; "Publicar informe" deshabilitado con menos de 3 leads con web (no publicar de verdad).
6. Tema claro y oscuro en el admin; Lead Finder Pro siempre oscuro.
7. Historial: la búsqueda del admin aparece con la etiqueta "admin".
8. Admin → Auditoría automática: el campo "Cantidad de sitios por corrida" muestra 15 y "≈ 516 consultas"; poner 30 → el texto se pone en rojo; volver a 15 y guardar.

Anotar cualquier problema y corregirlo antes de cerrar.

- [ ] **Step 5: Commit**

```bash
git add -A src/components CLAUDE.md
git commit -m "chore: borra los paneles viejos de Lead Finder y documenta el buscador unificado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
