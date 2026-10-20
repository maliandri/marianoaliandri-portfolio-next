# Catálogo Mood Fit — copia interna para pedidos (diseño)

Fecha: 2026-10-19

## Intención

Mariano y Johana Belén Reyes le compran ropa por mayor a **Mood Fit**, un vendedor que publica su
catálogo solo dentro de WhatsApp Business. Quieren una **copia propia** de ese catálogo (backup que
no dependa del WhatsApp del vendedor) y desde ahí **armar pedidos y exportarlos a Excel**.

La copia tiene que reflejar los precios del vendedor: cuando él cambia el catálogo, se vuelve a
recorrer y la copia se actualiza.

## Quién lo usa

- **Johana** (`johanabreyes@gmail.com`, ya tiene cuenta en el sitio con Google) — usuaria principal.
- **Mariano** (cuenta admin, `ADMIN_EMAIL`).
- Nadie más. Es una sección privada dentro de marianoaliandri.com.ar.

## Objetivos

1. Guardar los ~166 productos del catálogo de Mood Fit en Firestore, con fotos en Cloudinary.
2. Página privada donde Johana ve el catálogo (por colección, con buscador).
3. Armar un pedido: producto → uno o varios talles con cantidad cada uno → color opcional.
4. Exportar el pedido a Excel (.xlsx), un renglón por producto+talle, con subtotales y total.
5. Re-sincronizar el catálogo a pedido (manual) y mostrar qué cambió.

## No-objetivos

- No se actualiza solo: la sincronización la dispara Mariano pidiéndosela a Claude (Chrome).
- No se manda el pedido al vendedor desde el sitio (se exporta el Excel y lo mandan ellos).
- No es multi-proveedor por ahora (pero los nombres de colecciones no deberían impedirlo).
- No es público: ni SEO, ni sitemap, ni links desde el home.

## Anti-objetivos (sería un fracaso aunque "funcione")

- Que alguien que no sea Johana o Mariano pueda ver el catálogo o los pedidos.
- Que una re-sincronización borre pedidos guardados o cambie el precio de un pedido ya hecho
  (los renglones del pedido guardan el precio del momento).
- Guardar cualquier dato de otros chats de WhatsApp. El scraper solo toca el panel del catálogo.

## Lo que sabemos del catálogo (recon 2026-10-19)

- Contacto "Mood Fit" en el WhatsApp Business de Mariano, abierto en WhatsApp Web (Chrome).
- Ícono de tienda en el header del chat → panel "Catálogo" a la derecha.
- 12 colecciones + "Todos los artículos" (166 ítems):
  Informacion General, moodfit Mujer/Hombre/Niños, COMBOS MOOD, DEPORTIVO MUJER IMPORTADO,
  DEPORTIVO HOMBRE IMPORTADO, Conj Deport Hombre Y Mujer, niños Importado, ABRIGOS HOMBRE Y MUJER,
  casual / camisas dama, PROYEC - SOX, blanqueria/media/bolso/botell, nuevos Ingresos.
- Cada producto (vista "Detalles"): **una imagen** (blob, ~1280 px; verificar si algunos tienen
  más), **título** con código al inicio (`MLL1054 CALZA POCKET I-RUN $21.300 POR MAYOR`, a veces
  con emoji 📦/💗 adelante), **precio** `ARS 21,300.00`, **descripción** libre, ej:
  `TALLE XS AL XL\n\n$21.300 por mayor\n$35.300 por menor`.
- Precio del campo `ARS` = **por mayor** = costo. El **por menor** solo aparece en la descripción.
- Hay ítems que no son productos: "INFORMACION GENERAL", "INFORMACION DE ENVIOS", "INFO DE PRENDAS
  IMPORTADAS", "POLÍTICAS DE CAMBIO…", y combos con `ARS 0.00`.
- La lista es virtualizada (hay que scrollear para que aparezcan) y las miniaturas usan un GIF
  placeholder hasta cargar.

## Decisiones de Mariano

- Precio por mayor = precio de costo, con el que se calcula el pedido.
- Precio por menor = se muestra como **"Precio sugerido de venta"**.
- Sincronización manual (la dispara Mariano), reflejando los precios del vendedor.
- Sección privada dentro de marianoaliandri.com.ar, login con Google.
- En el pedido se elige talle con un **selector**; si se eligen varios talles de un producto, el
  Excel sale como lista: **un renglón por producto+talle**.
- El Excel tiene una columna/fila que calcula el total.

## Diseño

### Datos (Firestore)

Colecciones nuevas (nombres: decisión de Claude):

- `proveedor_productos/{productId}` — un doc por producto. `productId` = id estable del ítem en
  WhatsApp si se puede obtener del DOM/estado; si no, slug del código (`mll1054`) y, sin código,
  hash del título.
  Campos: `proveedor: 'moodfit'`, `codigo`, `titulo` (sin emoji), `tituloOriginal`,
  `descripcion`, `colecciones: string[]`, `precioMayor` (número ARS), `precioSugerido`
  (número o null), `talles: string[]` (parseados, vacío si no se pudo), `tallesTexto`,
  `imagenes: [{ url, publicId }]`, `tipo: 'producto' | 'info'`, `activo` (false si dejó de
  aparecer), `actualizadoEn`, `historialPrecios: [{ fecha, precioMayor, precioSugerido }]`.
- `proveedor_syncs/{syncId}` — log de cada sincronización: fecha, totales, `nuevos`, `cambiados`
  (con precio anterior y nuevo), `desaparecidos`.
- `proveedor_pedidos/{pedidoId}` — pedidos guardados: `creadoPor` (email), `creadoEn`, `nombre`
  opcional, `renglones: [{ productId, codigo, titulo, talle, color, cantidad, precioMayor }]`,
  `total`. El precio queda congelado en el renglón.

Reglas de Firestore: las tres colecciones `allow read, write: if false` desde el cliente.
Todo pasa por API routes con Admin SDK.

### Acceso

- Allowlist de emails: env var `PROVEEDOR_ALLOWED_EMAILS` (separados por coma) **más**
  `ADMIN_EMAIL`. Johana va en la env var. Helper `requireProveedorAccess(request)` en `src/lib/`,
  mismo patrón que `adminAuth.js` (idToken + email verificado + allowlist; falla cerrado).
- API routes (nombres: decisión de Claude):
  - `GET /api/proveedor/catalogo` — productos activos + info, agrupados por colección.
  - `GET/POST /api/proveedor/pedidos`, `GET/DELETE /api/proveedor/pedidos/[id]`.
- Página `/compras/moodfit` (decisión de Claude): client component con `AuthGate` existente;
  si el email no está en la allowlist → mensaje "No tenés acceso". `robots: noindex`, fuera del
  sitemap.

### Página

- Header: "Catálogo Mood Fit", fecha de la última sincronización y resumen de cambios
  (ej. "12 precios cambiaron, 3 productos nuevos") con link a ver el detalle.
- Filtro por colección + buscador por código/título.
- Grilla de cards: foto (Cloudinary con srcSet, ver `CloudinaryImage`), código, título,
  **Precio por mayor** destacado, **Precio sugerido de venta** secundario, talles. Badge
  "Nuevo" / "Cambió de precio" si vino en la última sincronización.
- Los ítems `tipo: 'info'` se muestran en una sección "Información del vendedor" aparte, no se
  pueden agregar al pedido.
- Agregar al pedido: selector de talles (chips multi-select con cantidad por talle), color en
  texto libre opcional. Si el producto no tiene talles parseados → campo de talle en texto libre.
  Debajo, la descripción original como guía.
- Panel de pedido (carrito lateral / drawer en mobile): renglones producto+talle, editar
  cantidad, borrar, total. Botones **Guardar pedido** y **Exportar a Excel**.
- Lista de pedidos guardados para volver a abrir o re-exportar.
- Aplicar skill `frontend-design` al construir la UI.

### Excel

Con `xlsx` (ya está en `package.json`), generado en el cliente.
Columnas: `Código | Producto | Talle | Color | Cantidad | Precio por mayor | Subtotal`.
`Subtotal` como **fórmula** (`=E2*F2`) y última fila `TOTAL` con `=SUM(G2:Gn)`. Nombre de archivo:
`pedido-moodfit-AAAA-MM-DD.xlsx`. Un renglón por producto+talle.

### Parseo de talles

Función pura `parseTalles(texto)` en `src/lib/` con tests Vitest (junto al archivo):
- Rangos numéricos: `1 al 4` → `1,2,3,4`; `24 al 30` → `24..30` (paso 1; ver si los talles de
  pantalón van de 2 en 2 — con los datos reales decidir).
- Rangos de letras sobre la secuencia `XXS, XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL, 6XL`
  (normalizar `XXL`→`2XL`, `XXXL`→`3XL`): `XS AL XL`, `S al 2XL`, `3XL AL 6XL`.
- Talle único: `Talle 1`, `TALLE ESPECIAL`.
- Si hay varios rangos por color (`BORDO TALLE 1 AL 3 GRIS VAPLEX TALLE 2 Y 3…`): unión de todos
  los talles; el color sigue siendo texto libre.
- Si no entiende → `[]` y la UI cae a texto libre.

Parseo de precio sugerido: regex sobre la descripción para `$X por menor` (tolerar `POR MENOR`,
puntos de miles, `$ 12.100`). Si no aparece → `null`.

### Sincronización (scraper)

Corre en dos partes, porque WhatsApp Web corre en el Chrome de Mariano con su sesión:

1. **Extracción en el navegador** (Claude con la extensión de Chrome, `javascript_tool`): abrir
   chat Mood Fit → Catálogo → recorrer cada colección (para saber a qué colecciones pertenece
   cada producto) y abrir el detalle de cada producto para leer título completo, precio,
   descripción e imagen(es) a resolución completa. **Scopear todo el DOM al panel del catálogo**
   — no leer la lista de chats ni ningún otro chat.
2. **Imágenes**: el blob se lee en la página (`fetch(blobUrl)`). WhatsApp Web tiene una CSP
   estricta, así que probablemente **no** deje hacer `fetch` a Cloudinary ni a localhost desde la
   página. **Verificar primero.** Orden de preferencia:
   a. Upload unsigned directo a Cloudinary desde la página (si la CSP lo permite).
   b. Descargar cada imagen como archivo (`<a download>`) a una carpeta local y subirlas desde
      el script local. (Requiere permiso de Mariano para las descargas.)
   c. Devolver las imágenes en base64 por lotes a través del tool y que Claude las guarde en disco.
3. **Script local** `scripts/proveedor-sync.mjs` (Node, credenciales de `.env.local`, Admin SDK):
   recibe el JSON extraído (+ imágenes en disco si es la opción b/c), sube imágenes a Cloudinary
   en carpeta `proveedores/moodfit/` (evitar re-subir si la imagen no cambió: guardar hash),
   hace el diff contra Firestore, escribe productos, marca `activo: false` los que no aparecieron,
   agrega a `historialPrecios` si el precio cambió, y guarda el log en `proveedor_syncs`.
   Upload a Cloudinary: signed con `CLOUDINARY_API_KEY/SECRET` si están en `.env.local`; si no,
   el preset unsigned existente.
4. Documentar en CLAUDE.md el procedimiento ("Sincronizar catálogo Mood Fit") para que una
   futura sesión lo pueda repetir.

## Lo que queda a criterio del constructor

- Nombres exactos de archivos, componentes y rutas (los de arriba son propuesta).
- Cómo obtener un id estable por producto desde WhatsApp Web.
- La opción de subida de imágenes (a/b/c) según lo que permita la CSP.
- Detalles visuales de la página, dentro de la estética del sitio.
