# Sincronización de capturas de proyectos a Google Drive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada vez que `/api/capture-projects` sube una captura de un sitio a Cloudinary, que también quede sincronizada (creada o actualizada) en una carpeta de Google Drive personal de Mariano, sin romper el flujo existente si Drive falla.

**Architecture:** Nuevo módulo `src/lib/googleDrive.js` con el mismo patrón de autenticación que `src/lib/gscClient.js` (cuenta de servicio de Firebase Admin, `google.auth.JWT`). Se llama desde `/api/capture-projects/route.js` justo después de cada upload a Cloudinary exitoso, guardando el `driveFileId` devuelto en el doc de Firestore `proyectos/{domain}` para poder actualizar (no duplicar) el mismo archivo en capturas futuras. `AdminPage.jsx` muestra el resultado de la sincronización junto al de Cloudinary que ya existe.

**Tech Stack:** `googleapis` (ya es dependencia del proyecto, usada en `gscClient.js`), Firebase Admin (`firebase-admin.js`, ya existente), Next.js Route Handlers.

**Spec:** `docs/superpowers/specs/2026-09-15-drive-screenshot-sync-design.md`

## Global Constraints

- Alcance: únicamente las capturas de sitios (`MarianWeb/*` en Cloudinary). No tocar ninguna otra carpeta/uso de Cloudinary (reels, zone-analysis, productos).
- Scope de Drive OAuth: `https://www.googleapis.com/auth/drive` (el scope completo) — **no** `drive.file`. Confirmado con una llamada real: `drive.file` devuelve 404 contra una carpeta compartida por el dueño, `drive` funciona.
- Reusar las credenciales de servicio que ya existen (`FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`) — no crear una cuenta de servicio nueva ni pedir credenciales nuevas.
- ID de la carpeta de Drive ya creada y compartida por Mariano: `1WyQjdhJkHIRUjQWhJwdfqMY2jwnqC9em` (nombre: "Capturas Portfolio - Marian Web").
- Un fallo al sincronizar con Drive (permisos, cuota, red, folder no configurado) **nunca** debe hacer fallar la captura/upload a Cloudinary de ese sitio, ni afectar a los demás sitios de la misma corrida.
- Este proyecto no tiene test framework configurado (cero tests/CI). La verificación de cada tarea es contra las APIs reales (scripts temporales que se borran al terminar, o llamadas curl/route reales), no unit tests con mocks.

---

## Task 1: Módulo `src/lib/googleDrive.js`

**Files:**
- Create: `src/lib/googleDrive.js`
- Modify: `.env.local` (agregar la env var nueva)

**Interfaces:**
- Produces: `getDriveAuth(): google.auth.JWT` y `uploadScreenshotToDrive({ domain: string, imageUrl: string, folderId: string, existingFileId?: string|null }): Promise<{ fileId: string }>` — Task 2 los importa desde `'../../../lib/googleDrive'` (misma forma relativa que ya usa `capture-projects/route.js` para importar `gscClient.js` y `firebase-admin.js`).

- [ ] **Step 1: Agregar la env var a `.env.local`**

Agregar esta línea (cerca de las otras vars de Google, p.ej. debajo de `GOOGLE_PLACES_API_KEY`):

```
GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID=1WyQjdhJkHIRUjQWhJwdfqMY2jwnqC9em
```

- [ ] **Step 2: Crear `src/lib/googleDrive.js`**

```js
import { google } from 'googleapis';
import { Readable } from 'stream';

export function getDriveAuth() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Credenciales de service account no configuradas');
  return new google.auth.JWT(clientEmail, null, privateKey, ['https://www.googleapis.com/auth/drive']);
}

/**
 * Sube o actualiza una captura de sitio en la carpeta de Drive compartida.
 * Si existingFileId viene definido, pisa ese archivo (mismo id, mismo link).
 * Si no, crea uno nuevo dentro de folderId.
 */
export async function uploadScreenshotToDrive({ domain, imageUrl, folderId, existingFileId }) {
  if (!folderId) throw new Error('GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID no configurada');

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`No se pudo descargar la imagen (${imageRes.status})`);
  const buffer = Buffer.from(await imageRes.arrayBuffer());

  const auth = getDriveAuth();
  const drive = google.drive({ version: 'v3', auth });
  const media = { mimeType: 'image/jpeg', body: Readable.from(buffer) };

  if (existingFileId) {
    const res = await drive.files.update({ fileId: existingFileId, media, fields: 'id' });
    return { fileId: res.data.id };
  }

  const res = await drive.files.create({
    requestBody: { name: `${domain}.jpg`, parents: [folderId] },
    media,
    fields: 'id',
  });
  return { fileId: res.data.id };
}
```

- [ ] **Step 3: Verificar contra la API real (script temporal, no queda en el repo)**

Crear `/tmp-verify-drive.mjs` en la raíz del proyecto (nombre elegido para que no choque con nada existente):

```js
import fs from 'fs';
import { google } from 'googleapis';
import { uploadScreenshotToDrive, getDriveAuth } from './src/lib/googleDrive.js';

// dotenv no está instalado en este proyecto — cargar .env.local a mano
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
  const idx = line.indexOf('=');
  if (idx === -1) return;
  const key = line.slice(0, idx).trim();
  let val = line.slice(idx + 1);
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  process.env[key] = val;
});

const folderId = process.env.GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID;
const testImageUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'; // imagen pública de demo de Cloudinary, siempre existe

// 1. Crear
const created = await uploadScreenshotToDrive({ domain: 'test-domain-verificacion', imageUrl: testImageUrl, folderId, existingFileId: null });
console.log('Creado:', created.fileId);

// 2. Actualizar (mismo id, no debe crear uno nuevo)
const updated = await uploadScreenshotToDrive({ domain: 'test-domain-verificacion', imageUrl: testImageUrl, folderId, existingFileId: created.fileId });
console.log('Actualizado:', updated.fileId, updated.fileId === created.fileId ? 'OK: mismo id' : 'FALLO: id distinto');

// 3. Limpiar — borrar el archivo de prueba de la carpeta real
const auth = getDriveAuth();
const drive = google.drive({ version: 'v3', auth });
await drive.files.delete({ fileId: created.fileId });
console.log('Archivo de prueba borrado de Drive');
```

Nota: el `import { uploadScreenshotToDrive, getDriveAuth } from './src/lib/googleDrive.js'` funciona ejecutando el script con `node --experimental-vm-modules` no hace falta — como el `package.json` de este proyecto no tiene `"type": "module"` a nivel raíz para scripts sueltos, ejecutar así:

Run: `node --input-type=module /tmp-verify-drive.mjs` (o simplemente darle extensión `.mjs`, que ya fuerza modo ESM en Node sin tocar `package.json`).

Expected output:
```
Creado: <un id de Drive>
Actualizado: <el mismo id> OK: mismo id
Archivo de prueba borrado de Drive
```

Si falla con 404 sobre el folder: revisar que `GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID` esté bien en `.env.local` y que la carpeta siga compartida como Editor con `firebase-adminsdk-fbsvc@marianoaliandri-3b135.iam.gserviceaccount.com`.

- [ ] **Step 4: Borrar el script de verificación**

```bash
rm /tmp-verify-drive.mjs
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/googleDrive.js
git commit -m "feat: agrega helper para subir capturas de sitios a Google Drive"
```

(`.env.local` está en `.gitignore` — no se commitea, la env var solo queda local y hay que cargarla en Vercel aparte, ver Task 2 Step 5.)

---

## Task 2: Enganchar la sincronización en `/api/capture-projects/route.js`

**Files:**
- Modify: `src/app/api/capture-projects/route.js`

**Interfaces:**
- Consumes: `uploadScreenshotToDrive({ domain, imageUrl, folderId, existingFileId }): Promise<{ fileId }>` de Task 1.
- Produces: la respuesta JSON de `POST /api/capture-projects` gana estos campos nuevos, usados por Task 3:
  - cada item de `uploaded[]` incluye `driveFileId: string|null` y `driveError: string|null`
  - la respuesta top-level incluye `driveFailed: Array<{ domain: string, error: string }>`

- [ ] **Step 1: Agregar el import y la constante de folder id**

En `src/app/api/capture-projects/route.js`, después de la línea 6 (`import { getDb } from '../../../lib/firebase-admin';`), agregar:

```js
import { uploadScreenshotToDrive } from '../../../lib/googleDrive';
```

Y después de la línea 10 (`const API_SECRET  = process.env.CLOUDINARY_API_SECRET;`), agregar:

```js
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID;
```

- [ ] **Step 2: Reemplazar el bloque `sites.map(...)` (líneas 80-94 del archivo actual)**

Reemplazar:

```js
    const db = getDb();
    const results = await Promise.allSettled(
      sites.map(async ({ url, domain }) => {
        const screenshotUrl = microlinkScreenshotUrl(url);
        const publicId      = `MarianWeb/${domain}`;

        const cloudinaryUrl = await uploadToCloudinary(screenshotUrl, publicId);
        if (db) {
          await db.collection('proyectos').doc(domain).set(
            { screenshotUpdatedAt: Date.now() },
            { merge: true }
          );
        }
        return { url, domain, cloudinaryUrl };
      })
    );
```

por:

```js
    const db = getDb();
    const results = await Promise.allSettled(
      sites.map(async ({ url, domain }) => {
        const screenshotUrl = microlinkScreenshotUrl(url);
        const publicId      = `MarianWeb/${domain}`;

        const cloudinaryUrl = await uploadToCloudinary(screenshotUrl, publicId);

        // Sincronizar a Drive — un fallo acá nunca debe tumbar la captura de Cloudinary,
        // que ya se completó arriba.
        let driveFileId = null;
        let driveError = null;
        if (DRIVE_FOLDER_ID) {
          try {
            const docRef = db?.collection('proyectos').doc(domain);
            const existingSnap = docRef ? await docRef.get() : null;
            const existingFileId = existingSnap?.data()?.driveFileId || null;

            const driveResult = await uploadScreenshotToDrive({
              domain,
              imageUrl: cloudinaryUrl,
              folderId: DRIVE_FOLDER_ID,
              existingFileId,
            });
            driveFileId = driveResult.fileId;
          } catch (e) {
            driveError = e.message;
          }
        } else {
          driveError = 'GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID no configurada';
        }

        if (db) {
          await db.collection('proyectos').doc(domain).set(
            {
              screenshotUpdatedAt: Date.now(),
              ...(driveFileId ? { driveFileId } : {}),
            },
            { merge: true }
          );
        }
        return { url, domain, cloudinaryUrl, driveFileId, driveError };
      })
    );
```

- [ ] **Step 3: Reemplazar el armado de la respuesta final (líneas 96-104 del archivo actual)**

Reemplazar:

```js
    const uploaded = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = results
      .filter(r => r.status === 'rejected')
      .map((r, i) => ({ url: sites[i]?.url, error: r.reason?.message }));

    return Response.json({ uploaded, failed, total: sites.length });
```

por:

```js
    const uploaded = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = results
      .filter(r => r.status === 'rejected')
      .map((r, i) => ({ url: sites[i]?.url, error: r.reason?.message }));

    const driveFailed = uploaded
      .filter(u => u.driveError)
      .map(u => ({ domain: u.domain, error: u.driveError }));

    return Response.json({ uploaded, failed, total: sites.length, driveFailed });
```

- [ ] **Step 4: Verificar contra la ruta real, en local**

Levantar el server de desarrollo en background:

Run: `npm run dev` (en background)

Esperar a que loguee `✓ Ready`, después pegarle a la ruta filtrando un solo dominio real (uno que ya esté verificado en GSC, p.ej. `marianoaliandri.com.ar`):

Run:
```bash
curl -s -X POST http://localhost:3000/api/capture-projects \
  -H "Content-Type: application/json" \
  -d '{"domain":"marianoaliandri.com.ar"}'
```

Expected: JSON con `uploaded[0].driveFileId` seteado (no `null`) y `driveError: null`, `driveFailed: []`.

Volver a correr el mismo curl una segunda vez. Expected: `uploaded[0].driveFileId` debe ser **el mismo id** que la primera corrida (confirma que actualiza en vez de duplicar — se puede confirmar además abriendo la carpeta de Drive y viendo que sigue habiendo un solo archivo para ese dominio, no dos).

Ahora probar el caso degradado sin Drive configurado: comentar temporalmente la línea de `GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID` en `.env.local`, reiniciar el dev server, y correr el mismo curl de nuevo.

Expected: `uploaded[0].cloudinaryUrl` sigue viniendo seteada (Cloudinary no se rompe), `uploaded[0].driveFileId` es `null`, `uploaded[0].driveError` dice `"GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID no configurada"`, y `driveFailed` tiene una entrada para ese dominio. Status HTTP sigue siendo 200 (no debe fallar la request completa).

Descomentar la línea en `.env.local` para dejarla como estaba y frenar el dev server al terminar.

- [ ] **Step 5: Agregar la env var a Vercel (producción)**

Esto toca configuración de producción — confirmar con el usuario antes de correrlo si no se hizo ya en una tarea anterior de esta sesión.

Run: `vercel env add GOOGLE_DRIVE_SCREENSHOTS_FOLDER_ID production` (pegar `1WyQjdhJkHIRUjQWhJwdfqMY2jwnqC9em` cuando lo pida)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/capture-projects/route.js
git commit -m "feat: sincroniza cada captura de sitio con Google Drive"
```

---

## Task 3: Mostrar el resultado de la sincronización en el admin

**Files:**
- Modify: `src/views/AdminPage.jsx:1103-1113`

**Interfaces:**
- Consumes: la respuesta de `POST /api/capture-projects` de Task 2 — específicamente `captureResult.uploaded[].driveFileId` y `captureResult.driveFailed`.

- [ ] **Step 1: Reemplazar el bloque de resultado**

Reemplazar (líneas 1103-1113 del archivo actual):

```jsx
      {captureResult && (
        <div className={`rounded-xl p-3 text-sm mb-2 ${captureResult.error ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
          {captureResult.error
            ? `❌ ${captureResult.error}`
            : <>
                ✅ {captureResult.uploaded?.length} capturas subidas a Cloudinary / carpeta MarianWeb
                {captureResult.failed?.length > 0 && <span className="text-yellow-400 ml-2">· {captureResult.failed.length} fallidas</span>}
              </>
          }
        </div>
      )}
```

por:

```jsx
      {captureResult && (
        <div className={`rounded-xl p-3 text-sm mb-2 ${captureResult.error ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
          {captureResult.error
            ? `❌ ${captureResult.error}`
            : <>
                ✅ {captureResult.uploaded?.length} capturas subidas a Cloudinary / carpeta MarianWeb
                {captureResult.failed?.length > 0 && <span className="text-yellow-400 ml-2">· {captureResult.failed.length} fallidas</span>}
                {' · '}
                {captureResult.uploaded?.filter(u => u.driveFileId).length ?? 0} sincronizadas a Drive
                {captureResult.driveFailed?.length > 0 && <span className="text-yellow-400 ml-2">· {captureResult.driveFailed.length} fallaron en Drive</span>}
              </>
          }
        </div>
      )}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build exitoso, sin errores en `src/views/AdminPage.jsx`.

- [ ] **Step 3: Verificación visual (si hay credenciales de admin disponibles)**

Si quien ejecuta este plan tiene login de admin disponible (usuario/contraseña de `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`), entrar a `/admin` → tab Proyectos → tocar "Capturar screenshots" → confirmar que el mensaje verde ahora incluye "N sincronizadas a Drive". Si no hay credenciales de admin en la sesión, saltar este paso — el build limpio del Step 2 más la verificación de la respuesta JSON real en el Task 2 Step 4 ya cubren la lógica.

- [ ] **Step 4: Commit**

```bash
git add src/views/AdminPage.jsx
git commit -m "feat: muestra el resultado de la sincronización a Drive en el admin"
```
