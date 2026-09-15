# Sincronización de capturas de proyectos a Google Drive

## Contexto y objetivo

`/api/capture-projects` ya captura un screenshot de cada sitio verificado en
Google Search Console (vía Microlink) y lo sube a Cloudinary bajo
`MarianWeb/{domain}`. Mariano quiere que esas mismas capturas queden también
disponibles en una carpeta de su Google Drive personal, de forma automática,
para poder usarlas en otros lugares (por ejemplo, al cargar imágenes en su
Google Business Profile).

Fuera de alcance: cualquier otra imagen de Cloudinary que no sea
`MarianWeb/*` (reels, zone-analysis, productos de la tienda, etc.). Si en el
futuro se quiere sincronizar otra carpeta, es una extensión del mismo patrón,
no parte de este trabajo.

## Diseño

### Autenticación

Se reutiliza la cuenta de servicio que ya usa Firebase Admin
(`FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`, proyecto de Google Cloud
`marianoaliandri-3b135`), con el mismo patrón que ya existe en
`src/lib/gscClient.js` (`google.auth.JWT`), con scope
`https://www.googleapis.com/auth/drive` (**no** `drive.file`: ese scope
restringido solo ve archivos creados por la propia app, no carpetas
compartidas vía el diálogo normal de Drive — confirmado con una prueba
real contra la carpeta de Mariano: con `drive.file` da 404, con `drive`
completo funciona).

Prerrequisitos (a cargo de Mariano, fuera del código) — **ya completados y
verificados el 2026-09-15** con una llamada real a la API:
1. ~~Habilitar Google Drive API en el proyecto `marianoaliandri-3b135`.~~ Hecho.
2. ~~Crear la carpeta "Capturas Portfolio - Marian Web" y compartirla como
   Editor con la cuenta de servicio.~~ Hecho — confirmado que la cuenta de
   servicio puede leer la carpeta (`drive.files.get` devolvió el folder,
   owner `marianoaliandri@gmail.com`).
3. Falta cargar la env var nueva `GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID` =
   `1WyQjdhJkHIRUjQWhJwdfqMY2jwnqC9em` en Vercel (y en `.env.local` para
   desarrollo) — esto se hace junto con el resto de la implementación, no
   es necesario que Mariano lo haga a mano.

### Nuevo módulo: `src/lib/googleDrive.js`

- `getDriveAuth()`: igual patrón que `getGSCAuth()` en `gscClient.js`, scope
  `drive` (ver nota de autenticación arriba).
- `uploadScreenshotToDrive({ domain, imageUrl, folderId, existingFileId })`:
  - Descarga los bytes de `imageUrl` (la URL de Cloudinary ya subida).
  - Si `existingFileId` está definido → `drive.files.update(fileId, media)`
    (pisa el mismo archivo, mantiene el mismo link para siempre).
  - Si no → `drive.files.create({ name: `${domain}.jpg`, parents:
    [folderId] }, media)` y devuelve el `id` nuevo.

### Cambios en `/api/capture-projects/route.js`

Dentro del `sites.map(...)` existente, después de `uploadToCloudinary`:

1. Leer `driveFileId` del doc `proyectos/{domain}` en Firestore (ya se lee/
   escribe ese doc para `screenshotUpdatedAt`).
2. Llamar a `uploadScreenshotToDrive` con la URL de Cloudinary recién
   subida.
3. Guardar/actualizar `driveFileId` en el mismo `set(..., {merge:true})`
   que ya escribe `screenshotUpdatedAt`.
4. Si falla el paso de Drive, no debe romper la captura de ese sitio — se
   captura el error aparte y se agrega a un array `driveFailed` en la
   respuesta (mismo patrón que ya usa la ruta para `failed`).

Respuesta de la ruta gana dos campos nuevos: cada item de `uploaded` incluye
`driveFileId` (o `driveSynced: false` si falló), y la respuesta top-level
suma `driveFailed`.

### Cambios en `src/views/AdminPage.jsx`

El mensaje de resultado que ya existe ("✅ N capturas subidas a Cloudinary /
carpeta MarianWeb") se extiende para mostrar también cuántas se
sincronizaron a Drive y cuántas fallaron ese paso, sin tocar el resto del
flujo de captura.

### Manejo de errores

- Sin `GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID` configurada → la ruta sigue
  funcionando igual que hoy (solo Cloudinary), y cada intento de Drive cae
  directo a `driveFailed` con un mensaje claro ("Drive no configurado").
- Cualquier error de la API de Drive (permisos, cuota, red) se captura por
  sitio individualmente — un fallo no debe afectar a los demás sitios ni al
  upload a Cloudinary, que ya se completó antes de intentar Drive.

### Testing

Manual, en el admin:
1. Tocar "Capturar todos" con la carpeta de Drive ya compartida y la env
   var configurada → verificar que aparecen los archivos en la carpeta de
   Drive (uno por dominio).
2. Tocar "Capturar todos" una segunda vez → verificar que actualiza los
   mismos archivos (mismo `driveFileId`) en vez de duplicarlos.
3. Recapturar un solo sitio (botón individual ya existente) → verificar que
   también sincroniza a Drive.
4. Probar sin la env var configurada → verificar que Cloudinary sigue
   funcionando y no rompe la respuesta.
