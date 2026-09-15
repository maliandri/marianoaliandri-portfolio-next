# Páginas de detalle por proyecto + medios subibles/publicables

## Contexto y objetivo

Hoy cada proyecto del portfolio (`ProyectosGrid.jsx`, en el home) es solo una
card en una grilla: captura, descripción corta, 3 métricas de GSC, y un
ícono que abre el sitio real en otra pestaña. No hay ningún lugar donde un
visitante pueda ver el detalle de un proyecto en particular (qué stack usa,
qué funcionalidades tiene, qué impacto tuvo) — esos datos ya existen en
Firestore (`proyectos/{domain}`, editables desde el admin) pero solo se
usan como texto truncado en la card.

Mariano quiere:
1. Una página propia por proyecto (`/proyectos/{domain}/`) con el detalle
   completo, a la que se llega haciendo click en la card del home.
2. Poder subir fotos y videos de cada proyecto desde el admin (además de la
   captura automática que ya existe), con un toggle "publicable" — solo los
   que estén marcados como publicables aparecen en esa página nueva. Los no
   publicables quedan igual descargables desde el admin (por ejemplo para
   subirlos a mano a su ficha de Google Business Profile — ver
   [[project_seo_local_neuquen]]).

Fuera de alcance explícito:
- Google Drive — descartado en esta misma sesión: las cuentas de servicio
  de Google no tienen cuota de almacenamiento propia y no pueden escribir
  en una carpeta de Drive personal (solo funciona con Shared Drives de
  Workspace, que Mariano no tiene). No se vuelve a intentar acá.
- Borrar medios ya subidos — no lo pidió, no se construye.
- Cualquier schema.org más allá de `BreadcrumbList` en la página nueva —
  no hay un tipo de schema.org que encaje limpio para "un proyecto que
  hice"; se deja para si lo pide explícitamente.

## Diseño

### 1. Datos: `proyectos/{domain}.media`

Nuevo campo array en el doc de Firestore que ya existe (mismo doc que
`descripcionCorta`, `stack`, etc.). Cada item:

```
{ id: string, url: string, type: 'image'|'video', publicable: boolean, uploadedAt: number }
```

`id` se genera al crear el item (`crypto.randomUUID()`), para poder
identificar un item individual al togglear `publicable` sin depender de
igualdad exacta de objeto (Firestore `arrayUnion`/`arrayRemove` comparan
por igualdad exacta, así que las escrituras son lectura del doc completo +
modificación del array en JS + `set(..., {merge:true})` con el array
entero — mismo patrón que ya usa `capture-projects/route.js` para
`driveFileId` en la sesión anterior, adaptado sin Drive).

### 2. Subida de medios: reusar `cloudinaryService`

`src/utils/cloudinaryService.js` ya expone `uploadBase64Image(base64, folder)`
y `uploadBase64Video(base64, folder)`, ya usa el preset unsigned existente
(`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`), y ya se usa así en
`LabsPublisher.jsx`. No se toca ese archivo. El flujo nuevo, client-side,
en el admin:

1. Input de archivo → `FileReader.readAsDataURL(file)` para obtener el
   base64.
2. Según `file.type.startsWith('video/')`, llamar
   `uploadBase64Video(base64, `proyectos-media/${domain}`)` o
   `uploadBase64Image(base64, `proyectos-media/${domain}`)`.
3. Con la `url` devuelta, `POST /api/proyectos/media` (ver abajo) para
   persistir el item en Firestore.
4. Refrescar la lista de proyectos del admin.

### 3. Nueva ruta `src/app/api/proyectos/media/route.js`

- `POST { domain, url, type }` → lee el doc `proyectos/{domain}`, arma un
  item nuevo `{ id: crypto.randomUUID(), url, type, publicable: true,
  uploadedAt: Date.now() }`, lo agrega al array `media` existente (o crea
  el array si no existía), `set(..., {merge:true})`. Devuelve el array
  `media` actualizado.
- `PATCH { domain, mediaId, publicable }` → lee el doc, mapea el array
  reemplazando el `publicable` del item con ese `id`, vuelve a guardar el
  array completo. 400 si no encuentra el `mediaId`.

No hay `DELETE` — fuera de alcance (ver arriba).

### 4. Admin: `AdminProyectosPanel` en `src/views/AdminPage.jsx`

Dentro del bloque expandido de cada proyecto (donde ya están los campos de
texto y el botón Guardar, alrededor de la línea 1244-1257 actual), un
bloque nuevo "Fotos y videos":

- Input de archivo (`accept="image/*,video/*"`) + botón "Subir" que corre
  el flujo del punto 2.
- Grid de miniaturas de `p.media` (viene del GET de `/api/proyectos`, ver
  punto 6): imagen → `<img>`, video → `<video muted>` como thumbnail.
  Cada miniatura tiene:
  - Un checkbox/toggle "Publicable" que llama al PATCH del punto 3.
  - Un botón "Descargar" que hace `fetch(url)` → `blob()` → crea un
    `<a>` temporal con `URL.createObjectURL(blob)` y `download` seteado
    al nombre de archivo, lo clickea y lo remueve (descarga real al
    disco del visitante, no solo abre una pestaña — un link directo con
    `download` no fuerza la descarga en URLs de otro origen como
    Cloudinary en todos los navegadores).

Sin componente nuevo separado: es JSX inline dentro de
`AdminProyectosPanel`, igual que el resto del bloque expandido — no se
justifica un archivo aparte para ~40 líneas de JSX que solo se usan ahí.

### 5. `GET /api/proyectos` (existente) devuelve `media`

En `src/app/api/proyectos/route.js`, el `.map()` que arma cada proyecto
(línea ~77) suma `media: fs.media || []` al objeto devuelto. Sin esto ni
el admin ni la página nueva pueden ver los medios subidos.

### 6. Página nueva `src/app/proyectos/[domain]/page.jsx`

Mismo patrón que `src/app/auditorias/[id]/page.jsx` (server component,
`force-dynamic`, trae datos directo con `getDb()`/`getGSCAuth()` — **no**
self-fetch HTTP, regla ya establecida en el CLAUDE.md del proyecto):

- `getProyecto(domain)`: busca el sitio en `getVerifiedSites()` (GSC). Si
  no está, `null`. Si está, trae el doc `proyectos/{domain}` de Firestore
  y una query de `searchanalytics` de los últimos 28 días (mismo cálculo
  de fechas que ya usa `/api/proyectos`) para clicks/impresiones.
- `generateMetadata`: título `${nombre} | Proyectos | Mariano Aliandri`,
  descripción = `descripcionCorta` + `impacto` recortado a 160 chars,
  canonical `https://marianoaliandri.com.ar/proyectos/{domain}/`, OG image
  = el `screenshotUrl` del propio proyecto (mismo cálculo de URL de
  Cloudinary que ya usa `/api/proyectos`).
- Si `getProyecto` devuelve `null` → `notFound()`.
- Contenido: breadcrumb (Inicio > Proyectos > nombre) + schema
  `BreadcrumbList`, captura grande, nombre + descripción corta, stats de
  GSC (clicks/impresiones, mismo estilo de tarjetas que ya usa
  `/auditorias/[id]/page.jsx`), stack técnico, funcionalidades (lista),
  impacto (destacado), galería de `media.filter(m => m.publicable)`
  (imágenes en grid, videos con `<video controls>`), link externo al
  sitio real, y el mismo CTA de "Pedí presupuesto" que ya se repite en
  otras páginas del sitio (`/presupuesto`).
- Campos vacíos (sin descripción cargada todavía) simplemente no
  renderizan esa sección — no hay placeholder ni error.

### 7. `ProyectosGrid.jsx`: la card pasa a ser clickeable

En `ProyectoCard` (línea ~72), envolver el bloque de captura+título+
descripción+stats en un `<Link href={`/proyectos/${domainClean}/`}>`
(`next/link`). La fila inferior con el dominio y la flechita que abre el
sitio real (línea ~120-133) queda **fuera** de ese `Link`, como hermano
dentro del mismo `motion.div` — un `<a>` no puede anidarse dentro de otro
`<a>`, por eso la flechita externa se mantiene aparte en vez de anidada.

## Manejo de errores

- Subida a Cloudinary falla (red, archivo inválido) → mensaje de error en
  el admin, no rompe el resto del panel.
- `POST`/`PATCH` de `/api/proyectos/media` sin Firestore disponible
  (`getDb()` devuelve `null`) → 500 con mensaje claro, igual que ya hacen
  las otras rutas de este proyecto en ese caso.
- Dominio no encontrado en `/proyectos/{domain}/` → `notFound()` (404 de
  Next.js), no un error 500.

## Testing

Manual, no hay framework de tests en el proyecto (igual que la sesión
anterior):

1. Admin → Proyectos → expandir un proyecto → subir una foto → verificar
   que aparece en la miniatura y que el toggle "Publicable" arranca
   prendido.
2. Apagar el toggle → recargar el panel → verificar que se guardó
   apagado.
3. Tocar "Descargar" → verificar que se descarga el archivo real al
   disco (no que abre una pestaña nueva).
4. Subir un video → verificar que sube y que el toggle funciona igual.
5. Entrar a `/proyectos/{un-dominio-real}/` → verificar que carga con los
   datos correctos y que la galería solo muestra los medios publicables.
6. Apagar el único medio publicable de un proyecto → recargar la página →
   verificar que la galería desaparece sin romper el resto de la página.
7. Entrar a `/proyectos/dominio-que-no-existe/` → verificar 404.
8. Desde el home, click en una card de proyecto → verificar que navega a
   su página de detalle; click en la flechita de la esquina → verificar
   que sigue abriendo el sitio real en pestaña nueva (no la página de
   detalle).
