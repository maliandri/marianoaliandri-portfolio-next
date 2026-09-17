# Bot de noticias autónomo (GitHub Actions + Gemini + Make)

## Contexto y objetivo

Mariano quiere un canal de noticias en su sitio, inspirado en el de otro
dev que vio en LinkedIn (agente que actualiza su web todas las mañanas),
pero con su propio ángulo: en vez de noticias genéricas de IA, tópicos que
él elige y puede cambiar. El bot:

1. Sigue una lista de tópicos configurable desde el admin.
2. Cada hora busca noticias nuevas de esos tópicos.
3. Gemini escribe el texto (artículo para el sitio + caption para redes).
4. Se publica solo en el sitio (`/noticias`) y se manda a Make.com, que ya
   tiene programadas Facebook, LinkedIn e Instagram, para que salga como
   post nativo con imagen y caption — **sin link** en el texto (así no arma
   la tarjeta de preview que castiga alcance en LinkedIn/Meta).

Requisito explícito de arquitectura: **no comprometer Vercel**. Todo el
pipeline (buscar, redactar, armar imagen, guardar, publicar) corre dentro
de un GitHub Action, en el runner de GitHub — no le pega a ninguna ruta
`/api/` del sitio. Vercel solo sigue haciendo lo que ya hace: servir
`/noticias` leyendo Firestore directo (mismo patrón que `/auditorias`).

Decisiones explícitas tomadas en la conversación:
- **Frecuencia**: cada hora (`0 * * * *`), sin tope diario por defecto —
  publica cada noticia nueva que encuentre. Se deja un tope diario
  *opcional* configurable desde el admin (apagado = sin límite) como
  válvula de escape, sin forzar nada.
- **Imagen**: Microlink (screenshot de la nota original, gratis, ya se usa
  en `send-biz-email`) → se sube a Cloudinary → esa URL (no la de
  Microlink) es la que se manda a Make, mismo patrón que ya funciona para
  Instagram en reels y zone-analysis.
- **Caption única**: un solo texto para las 3 redes (Facebook, LinkedIn,
  Instagram) en v1 — no hay redacción distinta por red. Si en el uso real
  se nota que conviene diferenciarlas, es un cambio de prompt, no de
  arquitectura.
- **Sin cola de aprobación**: publica solo, de punta a punta. El único
  control humano es un interruptor general on/off en el admin.

Fuera de alcance explícito (no se construye en esta iteración):
- Caption distinta por red social.
- Cola de aprobación / revisión antes de publicar.
- Botón "generar ahora" en el admin que dispare el GitHub Action —
  requeriría exponer un token de GitHub con permiso de escritura en el
  navegador, lo cual es un riesgo de seguridad que no se justifica; para
  probar manualmente se usa el botón "Run workflow" que ya trae GitHub
  Actions.
- Editar o borrar noticias ya publicadas desde el admin.
- Reintentos con backoff — si Gemini, Make o Cloudinary fallan para una
  noticia puntual, se loguea el error y se sigue con la próxima; no hay
  cola de reintento.
- Traer noticias históricas/backfill al armar un tópico nuevo — arranca
  desde cero, solo lo que aparezca de ahí en adelante.

## Diseño

### 1. Disparador: GitHub Actions, no Vercel

`.github/workflows/noticias-bot.yml`:

```yaml
on:
  schedule:
    - cron: '7 * * * *'   # minuto 7 de cada hora, no en punta de hora
  workflow_dispatch: {}    # botón "Run workflow" para probar a mano
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
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

Corre 1 vez/hora → 720 corridas/mes, ~30 min/mes de uso real de runner
(cada corrida dura segundos si no hay noticias nuevas) — muy por debajo de
los 2.000 min/mes gratis de un repo privado.

**Setup manual pendiente (Mariano, no código):**
- Cargar los 7 secrets en GitHub → Settings → Secrets and variables →
  Actions (mismos valores que ya tiene en Vercel, salvo
  `CLOUDINARY_UPLOAD_PRESET` y `MAKE_WEBHOOK_URL`, ver puntos 4 y 5).
- Crear un upload preset *unsigned* nuevo en Cloudinary (ej. `noticias`),
  igual que ya existe `zone_analysis_images`.

### 2. Script autocontenido: `scripts/noticias-bot.mjs`

Un solo archivo, Node 20 (ESM, `fetch` nativo). Nada de esto pasa por
Next.js ni por ninguna ruta `/api/`:

```
main()
  1. initAdmin()              → firebase-admin con las env vars de arriba
  2. config = getConfig()     → doc noticias_config/settings
     si config.active === false → log y salir (freno de mano)
  3. topics = getActiveTopics() → noticias_topics where activo == true
  4. publishedToday = config.dailyCap
       ? contar noticias de hoy (América/Argentina/Buenos_Aires)
       : Infinity
  5. para cada topic (secuencial, no Promise.all — un tópico lento no
     debe pisar el rate limit de Gemini de los demás):
       a. si publishedToday >= config.dailyCap → cortar el loop
       b. items = fetchGoogleNewsRSS(topic.query)
       c. nuevos = filtrar items ya vistos (query a `noticias` por
          sourceUrlHash, ver punto 3)
       d. para cada item nuevo (más viejo primero, así se publican en
          orden cronológico si hay varios):
            try:
              texto = generarConGemini(item, topic)   → punto 4
              imageUrl = screenshotYSubirACloudinary(item.link) → punto 4
              guardarEnFirestore(...)                 → punto 3
              enviarAMake(texto, imageUrl)             → punto 5
              publishedToday++
            catch (e):
              log del error, guardar noticia con status:'error', seguir
  6. log final: cuántas se publicaron, cuántas fallaron
```

Nuevas dependencias (`package.json`): `fast-xml-parser` (parsear el RSS,
liviano, sin dependencias nativas). Todo lo demás (`firebase-admin`,
`fetch` nativo) ya está disponible.

### 3. Datos en Firestore

**`noticias_topics/{id}`** (admin lo gestiona):
```
{ label: string, query: string, activo: boolean, createdAt }
```
`query` es el término de búsqueda tal cual se manda a Google News RSS
(por defecto, el mismo texto que `label`, pero editable por si conviene
una query más específica).

**`noticias/{id}`** (solo el bot escribe):
```
{
  topicId, topicLabel,
  title, body, caption,
  sourceUrl, sourceUrlHash,      // hash del link normalizado, para dedup
  sourceTitle,
  imageUrl,                       // URL de Cloudinary, no de Microlink
  status: 'published' | 'error',
  makeError: string | null,
  publishedAt: serverTimestamp,
}
```
Dedup: antes de procesar un item del RSS, se normaliza la URL (sin
querystring de tracking) y se hashea (`sha256` corto, vía `node:crypto`);
si ya existe un doc en `noticias` con ese `sourceUrlHash`, se descarta sin
gastar una llamada a Gemini.

**`noticias_config/settings`** (un doc único, lo gestiona el admin):
```
{ active: boolean, dailyCap: number | null }
```
`dailyCap: null` = sin tope (default, la decisión que tomamos). El día se
calcula en horario de Argentina, no UTC.

### 4. Contenido: RSS + Gemini + imagen

- **RSS**: `https://news.google.com/rss/search?q=<query>&hl=es-419&gl=AR&ceid=AR:es-419`,
  sin API key. Se parsea con `fast-xml-parser`, se toman `title`, `link`,
  `pubDate` de cada `<item>`.
- **Gemini** (mismo patrón `fetch` a `GEMINI_URL` que ya usan
  `send-biz-email` y `auditorias`, no se agrega el SDK): un prompt por
  noticia que pide devolver JSON estricto
  `{ "title": "...", "body": "...", "caption": "..." }` — título y cuerpo
  para la página del sitio (tono propio, explicando por qué importa, sin
  copiar el artículo original palabra por palabra), caption corta para
  redes **sin ningún link** adentro. Si el JSON no parsea, se loguea el
  error y se descarta esa noticia (no se reintenta).
- **Imagen**: `getScreenshot(item.link)` (la misma función que ya existe
  en `send-biz-email/route.js` — se extrae a un helper compartido, ver
  punto 6) → se sube a Cloudinary pasándole directamente la URL de
  Microlink como `file` en el POST a
  `https://api.cloudinary.com/v1_1/<cloud>/image/upload` con el
  `upload_preset` unsigned — Cloudinary la descarga solo, no hace falta
  bajar los bytes en el script. Si falla, la noticia se publica igual
  pero sin `imageUrl` (y no se manda a Make, porque Instagram/el Router
  necesitan imagen — se loguea como error).

### 5. Publicación a Make

Mismo webhook que ya usa `SocialPublisher`/`CanvasReelGenerator`
(`MAKE_WEBHOOK_URL`, hoy `.../574hhr7jtxm2rsn52ntkghpxohcdhjvi`), mismos
nombres de campo que ya existen (no se inventan nuevos):
```
{ text: caption, networks: { facebook: true, linkedin: true, instagram: true },
  type: 'noticia', useAI: false, imageUrl: <url de Cloudinary> }
```

**Setup manual pendiente (Mariano, en Make, no código):** agregar una
rama al Router existente para `type === 'noticia'` que reparta a
Facebook, LinkedIn e Instagram como post nativo (imagen + texto, sin link
adjunto) — mismo patrón ya usado para `type: 'reel'` y `zone_analysis`.

### 6. Refactor chico: compartir `getScreenshot`

`getScreenshot(url)` vive hoy adentro de
`src/app/api/auditorias/send-biz-email/route.js`. Se mueve a
`src/lib/microlink.js` y se importa desde ahí en ambos lugares — evita
duplicar la misma función en el script del bot. Es el único cambio a
código existente que toca este proyecto.

### 7. Sitio público: `/noticias` y `/noticias/[id]`

Mismo patrón que `/auditorias`: server component, `force-dynamic`, lee
Firestore directo con `getDb()` (nunca self-fetch, regla ya establecida).

- `/noticias`: lista las últimas N (ej. 30) con `status: 'published'`,
  ordenadas por `publishedAt` desc — card con imagen, título, topicLabel,
  fecha.
- `/noticias/[id]`: detalle completo (`title`, `body`, imagen grande,
  link "Fuente" al artículo original — el link **sí** aparece acá, en el
  sitio; lo que no lleva link es el post de redes).
- Metadata SEO básica (title, description, OG image) igual que el resto
  del sitio.

### 8. Admin: tab nuevo "Noticias"

`src/components/admin/NoticiasBotManager.jsx`, agregado a
`ADMIN_NAV_DEFAULT` (grupo `marketing`, al lado de `auditorias`) **y**
insertado también a mano en el `nav_config/admin` guardado en Firestore
(mismo problema que ya pasó con "Todas las Auditorías" — el árbol
guardado no hereda ítems nuevos del default automáticamente).

Contenido:
- Interruptor general on/off (`noticias_config.active`).
- Input de tope diario, vacío = sin tope (`noticias_config.dailyCap`).
- Tabla de tópicos: alta (label + query), activar/desactivar, sin borrar
  en v1 (desactivar alcanza).
- Log de lo publicado: últimas N noticias con estado (✓ publicada / ✗
  error, con el mensaje de error visible), tópico, fecha, link a la nota
  original y al post en el sitio.

Rutas nuevas:
- `src/app/api/noticias/topics/route.js` — GET (lista), POST (alta),
  PATCH (activar/desactivar).
- `src/app/api/noticias/config/route.js` — GET, PATCH (`active`,
  `dailyCap`).
- `src/app/api/noticias/route.js` — GET (lista para el log del admin;
  la página pública NO usa esta ruta, lee Firestore directo).

## Manejo de errores

- Un tópico sin noticias nuevas esa hora → no hace nada, no es un error.
- Falla el RSS de un tópico puntual → se loguea, se sigue con el próximo
  tópico (no aborta la corrida completa).
- Falla Gemini (API key inválida, contenido bloqueado, JSON inválido) →
  esa noticia puntual se descarta, se loguea, se sigue.
- Falla Microlink/Cloudinary → la noticia no se publica (ni sitio ni
  redes) porque no hay imagen; se guarda en Firestore con
  `status: 'error'` para que quede visible en el log del admin.
- Falla el webhook de Make → la noticia queda publicada en el sitio
  (`status: 'published'`) pero con `makeError` seteado, visible en el
  log — no se reintenta el envío a Make automáticamente.
- `noticias_config.active === false` → el script no hace ninguna llamada
  externa, solo lee ese flag y sale.
- Firestore no disponible (`getDb()` null, mismo caso que el resto del
  proyecto) → el script loguea el error y termina con exit code ≠ 0, así
  el run de GitHub Actions queda marcado en rojo y es visible sin entrar
  a mirar logs.

## Testing

Manual, no hay framework de tests en el proyecto:

1. Cargar 1 tópico de prueba desde el admin, dejar `active: true`, sin
   tope diario.
2. Disparar el workflow a mano (`workflow_dispatch` desde la pestaña
   Actions de GitHub) y ver el log de la corrida.
3. Verificar que aparece un doc nuevo en `noticias` con `status:
   'published'`, imagen de Cloudinary (no de Microlink) y sin errores.
4. Entrar a `/noticias` y `/noticias/[id]` y verificar que se ve bien.
5. Revisar en Make el historial del escenario — confirmar que llegó el
   webhook con `type: 'noticia'` y que la rama del Router lo procesó
   (esto último requiere que Mariano haya hecho el setup manual del
   punto 5 antes de probar).
6. Disparar el workflow de nuevo sin que haya noticias nuevas del
   tópico → confirmar que no duplica el mismo item (dedup por
   `sourceUrlHash`).
7. Apagar el interruptor general desde el admin → disparar el workflow →
   confirmar que no hace ninguna llamada externa (log dice "bot
   pausado") y no crea ningún doc nuevo.
8. Poner un tope diario de 1, dejar 2+ tópicos con noticias nuevas →
   confirmar que solo se publica 1 y el resto queda para la próxima
   corrida (no se pierden, se re-evalúan en el siguiente run porque
   siguen sin estar en `noticias`).
9. Forzar un error de Gemini (por ejemplo, con la API key mal puesta
   temporalmente) → confirmar que el run no explota, loguea el error por
   tópico y termina prolijo.
