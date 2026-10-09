# Auditoría SEO automática + publicación en redes — Diseño

Fecha: 2026-10-08
Alcance: subsistemas 1 y 2 de la cadena (disparador automático + publicación en redes).
Fuera de alcance (specs futuros): contacto automático de score < 50, oferta diferencial para
sitios aptos para sistema a medida.

## Objetivo

Que el sitio lance solo, dos veces por semana, una auditoría SEO de un rubro en una ciudad
argentina, la publique en `/auditorias/[id]` y anuncie el resultado en las redes (vía Make.com),
sin intervención manual y sin abrir el panel admin.

## Contexto actual

- La auditoría hoy corre **en el navegador**: `LeadFinderPanel.jsx` recorre ciudades y rubros
  llamando a `/api/lead-finder` negocio por negocio. Si se cierra la pestaña, se corta.
- `runLeadFinderAction` (`src/app/api/lead-finder/route.js`) es lógica pura sin auth, invocable
  desde el servidor. Su acción `auditPlace` usa caché por placeId (30 días) y evita pagar Google
  dos veces.
- `POST /api/auditorias` guarda la auditoría y genera el resumen con Gemini (`callGemini`, con
  rotación de `GEMINI_API_KEY_1..5`).
- La publicación en redes hoy es un POST al webhook de Make.com con `type: 'keyword_report'`,
  `text`, `networks`. El router de Make depende de esos nombres de campo: **no cambiarlos**.
- `CRON_SECRET` ya está en Vercel. Vercel envía `Authorization: Bearer $CRON_SECRET` en sus crons.
- Google Places `getDetails` tiene un tope manual de 100/día en GCP.

## Criterio de rubros

El objetivo comercial es negocios con **etapas constructivas o de fabricación** que consumen
insumos (el tipo de sistema que Mariano desarrolló en Almamod: requisiciones, stock, seguimiento
por etapas, cómputo de materiales). Todos estos rubros son `prioritario: true` y salen ~80% de las
corridas; el resto (gastronomía, salud, etc.) ~20%, para variar contenido y detectar nichos.

Rubros por texto libre (`searchText`):
- Construcción en seco: "construcción en seco", "steel framing", "durlock".
- Modular/prefabricada: "casas modulares", "casas prefabricadas", "contenedores habitables".
- Construcción y arquitectura: "constructora", "estudio de arquitectura", "empresa constructora",
  "maestro mayor de obras".
- Fabricación: "metalúrgica", "herrería", "carpintería metálica", "carpintería de aluminio",
  "aberturas de aluminio", "aberturas de PVC", "fábrica de aberturas", "carpintería", "fábrica de muebles a medida", "fábrica de premoldeados", "corralón",
  "vidriería", "confección textil".

Tipos de Places ya existentes en `rubros.js` y también prioritarios: Constructor, Electricista,
Plomero, Pintor, Ferretería.

## Componentes

### Nuevos
- `src/data/auditoriaAuto.js` — semilla: ~40 ciudades argentinas con masa crítica de comercios
  (capitales provinciales y ciudades grandes) y la lista de rubros `{ label, kind: 'type'|'text',
  id|query, prioritario }`. No se usa `localidadesAR.js` (trae localidades diminutas).
- `src/lib/autoAudit.js` — funciones puras y orquestación:
  - `pickNext(config, now)` — elige la próxima combinación ciudad × rubro: respeta la proporción
    80/20 prioritario/secundario y no repite una combinación en menos de 30 días.
  - `runBatch(combo, { budgetMs })` — geocodifica la ciudad, busca candidatos y audita con
    `runLeadFinderAction('auditPlace')` hasta agotar el lote (~15 sitios) o el presupuesto de
    tiempo (~45 s). Corta al recibir `QUOTA_EXCEEDED`.
  - `buildStats(results)` — total, promedio SEO, `lowSeoCount`, `withEmail`.
  - `buildPost({ combo, stats, auditoriaId })` — título y texto para redes, solo agregados.
- `scripts/auto-audit.mjs` + `.github/workflows/auditoria-auto.yml` — ejecución programada en
  **GitHub Actions** (sin el límite de 60 s de Vercel Hobby). Mismo patrón que el bot de noticias:
  `workflow_dispatch` disparado por cron-job.org martes y viernes 09:00 ART (el `schedule`
  nativo de GitHub se demostró poco confiable). El script corre con
  `tsx --tsconfig jsconfig.json` e importa con `import()` dinámico `src/lib/autoAuditRun`
  (verificado: así resuelve los alias `@/` y reutiliza `runLeadFinderAction` sin duplicarlo).
  Presupuesto en Actions: ~8 min / hasta 30 sitios.
- `src/app/api/cron/auditoria/route.js` — solo `POST` admin (`requireAdmin`) para el botón
  "Correr ahora" del admin; corre con el presupuesto de Vercel Hobby (45 s / 15 sitios,
  `maxDuration = 60`). No hay cron en `vercel.json`.
- Tarjeta en el admin: interruptor `activo`, último run, botón "Correr ahora" (llama a la misma
  ruta con la sesión admin), edición de ciudades y rubros.

### Modificados
- La lógica de guardado de `POST /api/auditorias` se extrae a `src/lib/auditoriasStore.js`
  (`saveAuditoria`) para que el panel manual y el cron compartan resumen, sanitizado y campos.
- Cada resultado guardado suma `rubro` y `aptoSistemaMedida` (true si el rubro es prioritario).
  No se muestran en la página pública; los usará el spec del punto 3.

## Datos (Firestore)

- `auditoria_auto/config`: `activo` (bool, interruptor de apagado), `ciudades[]`, `rubros[]`,
  `ultimaCorrida: { "<ciudad>|<rubro>": timestamp }`, `lock: { until }`.
- `auditoria_auto_runs/{id}`: `combo`, `auditados`, `estado` (`ok` | `sin_resultados` |
  `cuota_agotada` | `post_fallido` | `error`), `auditoriaId`, `duracionMs`, `createdAt`.
- Ambas son solo Admin SDK (reglas `write: if false`; lectura solo admin vía API).

## Flujo de una corrida

1. Entrada: el script de Actions (sin auth HTTP, usa credenciales de Firebase Admin de los
   secrets) o el `POST` admin (`requireAdmin`, 401/403 si no).
2. Leer `config` (si no existe, usar la semilla con `activo: false` — la automatización arranca
   apagada hasta que Mariano la active). Si `activo` es false y no es manual → `{ skipped: 'inactivo' }`.
3. Tomar candado (`lock.until` en el futuro → responder `{ skipped: 'en_curso' }`).
4. `pickNext` → combo.
5. `runBatch` → resultados.
6. Si 0 resultados: registrar `sin_resultados`, marcar el combo como corrido, **no publicar**.
7. `saveAuditoria` (resumen con Gemini) → `auditoriaId`.
8. POST a Make (`MAKE_SOCIAL_WEBHOOK_URL`, fallback al webhook vigente) con
   `{ type: 'keyword_report', text, networks }`.
9. Registrar el run, marcar el combo como corrido, liberar candado.

## Contenido del post

Solo datos agregados, **sin nombres de negocios** (publicar automáticamente el score de un
comercio con nombre puede traer problemas): título "Auditoría SEO: N <rubro> de <ciudad>",
promedio, % con SEO débil (< 50), resumen corto y link a `/auditorias/[id]`.
`networks`: `['linkedin', 'instagram', 'facebook']` por defecto; configurable en `config`.
Imagen: Instagram no publica sin imagen, así que el payload siempre lleva `imageUrl`.
En esta primera entrega es una imagen estática de marca en Cloudinary (1080×1080 JPG, mismo
criterio que `serviceLogos.js`); la tarjeta dinámica con el promedio y el % débil (estilo
`noticiaCard`) queda para una segunda entrega.

## Manejo de errores

- Presupuesto de tiempo: se audita lo que alcance; no se aborta la corrida por llegar al límite.
- `QUOTA_EXCEEDED`: se guarda lo auditado hasta ahí (si hay resultados suficientes) y no se
  publica; el run queda `cuota_agotada`.
- Make caído o no-2xx: la auditoría queda guardada; run `post_fallido`; sin reintento automático.
- Excepción inesperada: run `error`, el candado se libera en `finally`.
- Doble disparo: el candado impide duplicados.

## Pruebas (vitest)

- `pickNext`: proporción 80/20, no repite en 30 días, avanza al agotar combos.
- `buildStats` y `buildPost`: agregados correctos y ausencia de nombres de negocios.
- Ruta manual: 401 sin token y 403 sin ser admin. `runAutoAudit`: `skipped` con `activo: false`
  (salvo `force`), `skipped` con candado vigente.
- `runBatch` con `runLeadFinderAction` simulado: corte por `QUOTA_EXCEEDED` y por presupuesto.
- Ruta cron con Make simulado fallando: run `post_fallido` y auditoría guardada.

## Decisiones abiertas (resolver al planificar)

- (Resuelto) El plan de Vercel es Hobby: 60 s por función. Las corridas programadas van por
  GitHub Actions; la manual desde el admin usa el presupuesto corto.
- Cuál es la imagen estática de marca para la primera entrega (hoy el payload actual del panel,
  `keyword_report`, no envía `imageUrl`; confirmar que el router de Make la acepta para ese `type`).
